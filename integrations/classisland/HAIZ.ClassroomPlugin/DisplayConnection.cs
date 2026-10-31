using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Net.Http;

namespace HAIZ.ClassroomPlugin;

/// <summary>Pure validation for user-pasted HAIZ display links.</summary>
public sealed record DisplayLink(Uri ServerUri, string ScreenKey, Uri Endpoint)
{
    private static readonly Regex KeyPattern = new("^[a-fA-F0-9]{96}$", RegexOptions.CultureInvariant);

    public static bool TryParse(string? text, out DisplayLink? result, out string error)
    {
        result = null;
        error = "请从 HAIZ Academic 后台复制完整的教室展示链接。";
        if (string.IsNullOrWhiteSpace(text) || text.Length > 2048) return false;
        // Avoid combining untrusted fragments; only accept the exact readonly API path.
        if (!Uri.TryCreate(text.Trim(), UriKind.Absolute, out var uri)) return false;
        if ((uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback))
            || !string.IsNullOrEmpty(uri.UserInfo)
            || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment))
        {
            error = "仅接受 HTTPS 教室展示链接（本机测试可用 loopback HTTP）。";
            return false;
        }
        const string route = "/api/screens/";
        if (!uri.AbsolutePath.StartsWith(route, StringComparison.Ordinal)
            || uri.AbsolutePath.Length != route.Length + 96)
        {
            error = "链接应以 /api/screens/ 后接 96 位屏幕密钥。";
            return false;
        }
        var key = uri.AbsolutePath[route.Length..];
        if (!KeyPattern.IsMatch(key))
        {
            error = "屏幕密钥格式不正确。请直接粘贴完整链接。";
            return false;
        }
        var server = new Uri(uri.GetLeftPart(UriPartial.Authority));
        result = new DisplayLink(server, key, uri);
        error = "";
        return true;
    }
}

/// <summary>Legacy-compatible, private plugin configuration.</summary>
public sealed class DisplaySettings
{
    [JsonPropertyName("enabled")] public bool Enabled { get; set; } = false;
    [JsonPropertyName("eveningAutoShow")] public bool EveningAutoShow { get; set; } = false;
    [JsonPropertyName("serverUrl")] public string ServerUrl { get; set; } = "";
    [JsonPropertyName("screenKey")] public string ScreenKey { get; set; } = "";
    [JsonPropertyName("selfStudySubjectIds")] public Guid[] SelfStudySubjectIds { get; set; } = Array.Empty<Guid>();
}

/// <summary>
/// Configuration lives exclusively in ClassIsland PluginConfigFolder.
/// Atomic writes prevent partially-written JSON while other plugin components read.
/// No credential values are ever logged or displayed.
/// </summary>
public static class DisplaySettingsStore
{
    public static string FilePath { get; set; } = "";
    public static event Action? Changed;
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    public static DisplaySettings Load()
    {
        if (string.IsNullOrWhiteSpace(FilePath) || !File.Exists(FilePath))
            return new DisplaySettings();
        return JsonSerializer.Deserialize<DisplaySettings>(File.ReadAllText(FilePath), Json)
            ?? new DisplaySettings();
    }

    public static void Save(DisplaySettings settings)
    {
        if (string.IsNullOrWhiteSpace(FilePath))
            throw new InvalidOperationException("插件配置目录尚未初始化");
        var folder = Path.GetDirectoryName(FilePath)!;
        Directory.CreateDirectory(folder);
        var temporary = Path.Combine(folder, ".haiz-" + Guid.NewGuid().ToString("N") + ".tmp");
        try
        {
            File.WriteAllText(temporary, JsonSerializer.Serialize(settings, Json), new UTF8Encoding(false));
            File.Move(temporary, FilePath, true);
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
        Changed?.Invoke();
    }
}

/// <summary>
/// Result is deliberately limited to public class label and assignment count.
/// The 96-character token and full request URL never appear in error messages.
/// </summary>
public sealed record DisplayConnectionResult(bool Ok, string Message, string ClassName, int TaskCount)
{
    public static DisplayConnectionResult Failed(string message) => new(false, message, "", 0);
}

public static class DisplayConnectionProbe
{
    private static readonly HttpClient Http = new(new HttpClientHandler { AllowAutoRedirect = false })
    {
        Timeout = TimeSpan.FromSeconds(10)
    };

    public static async Task<DisplayConnectionResult> CheckAsync(
        DisplayLink link, CancellationToken cancellationToken = default)
    {
        try
        {
            using var response = await Http.GetAsync(link.Endpoint, cancellationToken);
            switch ((int)response.StatusCode)
            {
                case 401: case 403: return DisplayConnectionResult.Failed("屏幕凭据已失效或没有读取权限。请从后台重新复制链接。");
                case 404: return DisplayConnectionResult.Failed("找不到教室屏幕，请确认所选班级和链接。");
                case 502: case 503: case 530: return DisplayConnectionResult.Failed("临时后端暂时不可达，请检查 Mac、Node.js 与 Cloudflare Tunnel。");
            }
            if (!response.IsSuccessStatusCode)
                return DisplayConnectionResult.Failed("服务器返回 HTTP " + (int)response.StatusCode + "，请检查后端运行状态。");
            if (response.Content.Headers.ContentLength is > 524288)
                return DisplayConnectionResult.Failed("接口返回的数据超出限制。");
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var data = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var root = data.RootElement;
            if (!root.TryGetProperty("readOnly", out var readOnly) ||
                readOnly.ValueKind != JsonValueKind.True ||
                !root.TryGetProperty("containsStudentIdentity", out var pii) ||
                pii.ValueKind != JsonValueKind.False ||
                !root.TryGetProperty("assignments", out var rows) ||
                rows.ValueKind != JsonValueKind.Array)
                return DisplayConnectionResult.Failed("响应不是 HAIZ 安全只读教室数据，已拒绝保存。");
            var name = root.TryGetProperty("className", out var cn) && cn.ValueKind == JsonValueKind.String
                ? cn.GetString() ?? "HAIZ 班级" : "HAIZ 班级";
            return new DisplayConnectionResult(true, "教室连接已验证", name, rows.GetArrayLength());
        }
        catch (TaskCanceledException) { return DisplayConnectionResult.Failed("连接超时。请检查网络和临时后端。"); }
        catch (HttpRequestException) { return DisplayConnectionResult.Failed("网络请求失败。请检查 Windows 网络与 Cloudflare 隧道。"); }
        catch (JsonException) { return DisplayConnectionResult.Failed("后端没有返回合法 JSON，请检查服务地址。"); }
        catch (Exception) { return DisplayConnectionResult.Failed("连接验证失败，请检查配置和系统网络。"); }
    }
}
