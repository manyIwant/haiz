using System.Net.Http.Headers;
using System.Text.Json;
using Avalonia.Threading;
using ClassIsland.Core.Abstractions.Services;
using Microsoft.Extensions.Hosting;

namespace Haiz.ClassIsland;

public sealed class HomeworkService(ILessonsService lessons, IProfileService profiles, BridgeOptions options) : BackgroundService
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true, WriteIndented = true };
    private readonly HttpClient _http = new(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(4) };
    private HomeworkWindow? _window;
    private string? _dismissed, _shown, _signature;
    private Assignment[] _cache = [];
    private DateTimeOffset? _lastReceived;
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Opt-in only. The host's original timetable is never mutated.
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var file = Path.Combine(options.Folder, "haiz.settings.json");
                var config = File.Exists(file) ? JsonSerializer.Deserialize<Settings>(await File.ReadAllTextAsync(file, stoppingToken), Json) : null;
                if (config is not { Enabled: true } || string.IsNullOrWhiteSpace(config.DisplayToken)) { await Hide(); await Task.Delay(2000, stoppingToken); continue; }
                var now = DateTimeOffset.Now;
                var slot = await Dispatcher.UIThread.InvokeAsync(() => ReadEveningSlot(now, config));
                if (slot is null) { await Hide(); await Task.Delay(2000, stoppingToken); continue; }
                var online = false;
                // Deliberately loopback only for this experimental build. No school-network access.
                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Get, "http://127.0.0.1:8787/api/snapshot");
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.DisplayToken);
                    using var response = await _http.SendAsync(request, stoppingToken);
                    response.EnsureSuccessStatusCode();
                    var snapshot = JsonSerializer.Deserialize<Snapshot>(await response.Content.ReadAsStringAsync(stoppingToken), Json);
                    if (snapshot?.Identity?.Role != "display" || snapshot.Identity.Scope != config.Scope) throw new InvalidDataException("Display identity/scope mismatch");
                    _cache = snapshot.Assignments ?? []; _lastReceived = now; online = true;
                    Directory.CreateDirectory(options.Folder);
                    await File.WriteAllTextAsync(Path.Combine(options.Folder, "public-homework-cache.json"), JsonSerializer.Serialize(_cache, Json), stoppingToken);
                }
                catch (HttpRequestException) { }
                catch (TaskCanceledException) when (!stoppingToken.IsCancellationRequested) { }
                if (_cache.Length == 0)
                {
                    var cacheFile = Path.Combine(options.Folder, "public-homework-cache.json");
                    if (File.Exists(cacheFile)) _cache = JsonSerializer.Deserialize<Assignment[]>(await File.ReadAllTextAsync(cacheFile, stoppingToken), Json) ?? [];
                }
                var date = now.ToString("yyyy-MM-dd");
                var items = _cache.Where(x => x.Scope == config.Scope && x.StudyDate == date && x.Status == "published" && x.Review == "approved").Take(100).ToArray();
                var key = date + ":" + slot;
                var signature = JsonSerializer.Serialize(new { key, items, online });
                await Dispatcher.UIThread.InvokeAsync(() =>
                {
                    if (_dismissed == key || signature == _signature) return;
                    _signature = signature;
                    if (_window is null)
                    {
                        _window = new HomeworkWindow();
                        _window.Closed += (_, _) => { _dismissed = _shown; _window = null; _signature = null; };
                    }
                    _shown = key;
                    _window.Update(config.Scope, slot, items, online ? "本地服务已连接" : $"离线缓存 · 最近接收 {_lastReceived:HH:mm}");
                    if (!_window.IsVisible) _window.Show();
                });
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                // Plugin failure never stops ClassIsland's lesson timer or host.
                try { Directory.CreateDirectory(options.Folder); await File.WriteAllTextAsync(Path.Combine(options.Folder, "last-error.txt"), error.GetType().Name, stoppingToken); } catch { }
                await Hide();
            }
            try { await Task.Delay(2000, stoppingToken); } catch (OperationCanceledException) { break; }
        }
        await Hide(); _http.Dispose();
    }
    private string? ReadEveningSlot(DateTimeOffset now, Settings config)
    {
        if (!lessons.IsClassPlanEnabled || !lessons.IsClassPlanLoaded) return null;
        // Current plan accounts for temporary lesson changes; GetClassPlanByDate is the documented fallback.
        var plan = lessons.CurrentClassPlan ?? lessons.GetClassPlanByDate(now.LocalDateTime.Date, out _);
        if (plan is null || !plan.IsEnabled) return null;
        var rows = plan.Classes.Where(c => c.IsEnabled && !c.IsEmpty).Select(c => new {
            Subject = profiles.Profile.Subjects.TryGetValue(c.SubjectId, out var s) ? s.Name : "",
            Id = c.SubjectId,
            Start = c.CurrentTimeLayoutItem.StartTime, End = c.CurrentTimeLayoutItem.EndTime
        }).Where(c => c.End > c.Start && (config.SelfStudySubjectIds.Contains(c.Id) || c.Subject.Contains("自习") || c.Subject.Contains("晚修"))).OrderBy(c => c.Start).TakeLast(2).ToArray();
        if (rows.Length != 2 || rows[0].End > rows[1].Start) return null;
        for (var i = 0; i < rows.Length; i++) if (now.LocalDateTime.TimeOfDay >= rows[i].Start && now.LocalDateTime.TimeOfDay < rows[i].End) return $"晚修第{i + 1}节 · {rows[i].Start:hh\\:mm}—{rows[i].End:hh\\:mm}";
        return null;
    }
    private async Task Hide() => await Dispatcher.UIThread.InvokeAsync(() => { _window?.Hide(); _signature = null; });
}
public sealed record Settings(bool Enabled, string Scope, string DisplayToken, Guid[] SelfStudySubjectIds);
public sealed record Identity(string Role, string Scope);
public sealed record Snapshot(Identity? Identity, Assignment[]? Assignments);
public sealed record Assignment(string Id, int Version, string Scope, string StudyDate, string Subject, string Content, string Materials, string Due, string Status, string Review);
