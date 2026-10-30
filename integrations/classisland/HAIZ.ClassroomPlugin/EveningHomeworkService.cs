using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Threading;
using ClassIsland.Core.Abstractions.Services;
using Microsoft.Extensions.Hosting;

namespace HAIZ.ClassroomPlugin;

/// <summary>
/// Optional, classroom-safe auto display triggered by real ClassIsland timetable.
/// Does not mutate lessons, show student identities, or retain credentials in logs.
/// Fails closed on network errors; never displays stale withdrawn homework.
/// </summary>
public sealed class EveningHomeworkService(
    ILessonsService lessons, IProfileService profiles) : BackgroundService
{
    public static string ConfigFile { get; set; } = "";
    public sealed record TaskRow(string Subject, string Title, string? Due);
    private sealed class DisplayConfig
    {
        public bool Enabled { get; init; }
        public bool EveningAutoShow { get; init; }
        public string? ServerUrl { get; init; }
        public string? ScreenKey { get; init; }
        public Guid[] SelfStudySubjectIds { get; init; } = Array.Empty<Guid>();
    }
    private static readonly HttpClient Http = new(new HttpClientHandler
    {
        AllowAutoRedirect = false
    })
    {
        Timeout = TimeSpan.FromSeconds(7)
    };
    private EveningHomeworkWindow? _window;
    private string? _activeKey;
    private string? _dismissedKey;
    private DateTimeOffset _lastFetch = DateTimeOffset.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try { await Tick(stoppingToken); }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (Exception) { await Hide(); } // isolated from ClassIsland main loop
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        finally { await Hide(); }
    }

    private async Task Tick(CancellationToken cancellation)
    {
        // Configuration can be disabled instantly without touching ClassIsland.
        if (!File.Exists(ConfigFile)) { await Hide(); return; }
        DisplayConfig? settings;
        try
        {
            using var config = JsonDocument.Parse(await File.ReadAllTextAsync(ConfigFile, cancellation));
            settings = config.RootElement.Deserialize<DisplayConfig>(new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (Exception) when (!cancellation.IsCancellationRequested) { await Hide(); return; }
        if (settings is not { Enabled: true, EveningAutoShow: true })
        {
            await Hide(); return;
        }

        var local = DateTime.Now;
        var slot = await Dispatcher.UIThread.InvokeAsync(() => ReadSlot(local, settings));
        if (slot == null) { await Hide(); return; }
        var key = slot.Key(local);
        if (_dismissedKey == key) { await Hide(); return; }
        if (key == _activeKey && DateTimeOffset.Now - _lastFetch < TimeSpan.FromSeconds(45))
            return;
        _lastFetch = DateTimeOffset.Now;

        var result = await ReadPublicFeed(settings, local, cancellation);
        if (result == null) { await Hide(); return; }
        await Dispatcher.UIThread.InvokeAsync(() =>
        {
            if (_dismissedKey == key) return;
            if (_window == null)
            {
                _window = new EveningHomeworkWindow();
                _window.Closed += (_, _) =>
                {
                    _dismissedKey = _activeKey;
                    _window = null;
                };
            }
            _activeKey = key;
            _window.Update(result.Value.ClassName, slot.Label, result.Value.Items);
            if (!_window.IsVisible) _window.Show();
        });
    }

    private EveningPolicy.Slot? ReadSlot(DateTime local, DisplayConfig config)
    {
        if (!lessons.IsClassPlanEnabled || !lessons.IsClassPlanLoaded) return null;
        var plan = lessons.CurrentClassPlan ?? lessons.GetClassPlanByDate(local.Date, out _);
        if (plan is not { IsEnabled: true }) return null;
        var subjectIds = config.SelfStudySubjectIds ?? Array.Empty<Guid>();
        var rows = plan.Classes
            .Where(x => x.IsEnabled)
            .Select(x => new EveningPolicy.Lesson(
                x.SubjectId,
                profiles.Profile.Subjects.TryGetValue(x.SubjectId, out var subject) ? subject.Name : "",
                x.CurrentTimeLayoutItem.StartTime,
                x.CurrentTimeLayoutItem.EndTime,
                x.IsEnabled));
        return EveningPolicy.Active(rows, subjectIds, local.TimeOfDay);
    }

    private static async Task<(string ClassName, TaskRow[] Items)?> ReadPublicFeed(
        DisplayConfig config, DateTime local, CancellationToken cancellation)
    {
        if (string.IsNullOrWhiteSpace(config.ServerUrl) ||
            string.IsNullOrWhiteSpace(config.ScreenKey) || config.ScreenKey.Length != 96)
            return null;
        if (!Uri.TryCreate(config.ServerUrl.TrimEnd('/') + "/api/screens/" +
            Uri.EscapeDataString(config.ScreenKey), UriKind.Absolute, out var uri))
            return null;
        if ((uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback))
            || !string.IsNullOrEmpty(uri.UserInfo)) return null;

        using var response = await Http.GetAsync(uri, cancellation);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellation);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellation);
        var root = json.RootElement;
        // Existing HAIZ Academic contract explicitly excludes student identity.
        if (!root.TryGetProperty("readOnly", out var readOnly) || readOnly.ValueKind != JsonValueKind.True ||
            !root.TryGetProperty("containsStudentIdentity", out var pii) || pii.ValueKind != JsonValueKind.False ||
            !root.TryGetProperty("assignments", out var assignments) || assignments.ValueKind != JsonValueKind.Array)
            return null;
        string className = root.GetProperty("className").GetString() ?? "HAIZ 班级";
        var today = local.ToString("yyyy-MM-dd");
        var rows = assignments.EnumerateArray()
            .Where(x => x.ValueKind == JsonValueKind.Object)
            .Where(x =>
                (!x.TryGetProperty("status", out var status) || status.GetString() == "published") &&
                (!x.TryGetProperty("review", out var review) || review.GetString() == "approved") &&
                (!x.TryGetProperty("studyDate", out var date) || date.GetString() == today))
            .Take(5)
            .Select(x => new TaskRow(
                x.TryGetProperty("subject", out var s) ? s.GetString() ?? "其他" : "其他",
                x.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
                x.TryGetProperty("due", out var d) && d.ValueKind == JsonValueKind.String ? d.GetString() : null))
            .Where(x => !string.IsNullOrWhiteSpace(x.Title))
            .ToArray();
        return (className, rows);
    }

    private async Task Hide()
    {
        await Dispatcher.UIThread.InvokeAsync(() =>
        {
            _window?.Hide();
            _activeKey = null;
        });
    }
}
