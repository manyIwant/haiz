using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Threading;
using ClassIsland.Core.Abstractions.Controls;
using ClassIsland.Core.Attributes;

namespace HAIZ.ClassroomPlugin;

/// <summary>
/// Native ClassIsland component. Reads ONLY the read-only screen feed.
/// Never holds student cookies, account passwords, QQ credentials, or student identity.
/// </summary>
[ComponentInfo("1D2E3F49-06A3-4A2A-97CE-510C31321868",
    "HAIZ 班级任务", "\uf0ae", "展示经过教师确认的最近班级作业。")]
public sealed class HomeworkComponent : ComponentBase
{
    public static string ConfigFile { get; set; } = "";
    private readonly TextBlock title = new() { FontSize = 15, FontWeight = FontWeight.Bold };
    private readonly TextBlock lines = new() { FontSize = 12, TextWrapping = TextWrapping.Wrap };
    private readonly DispatcherTimer timer = new() { Interval = TimeSpan.FromSeconds(45) };
    private static readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(7) };
    private bool running;

    public HomeworkComponent()
    {
        Content = new StackPanel
        {
            Spacing = 4,
            VerticalAlignment = VerticalAlignment.Center,
            Children = { title, lines },
        };
        title.Text = "HAIZ · 班级任务";
        lines.Text = "请在插件配置目录填写 haiz-screen.json";
        timer.Tick += async (_, _) => await RefreshAsync();
        AttachedToVisualTree += (_, _) =>
        {
            timer.Start();
            _ = RefreshAsync();
        };
        DetachedFromVisualTree += (_, _) => timer.Stop();
    }

    private async Task RefreshAsync()
    {
        if (running) return;
        running = true;
        try
        {
            if (!File.Exists(ConfigFile))
            {
                lines.Text = "请配置 HTTPS 服务地址及只读屏幕凭据";
                return;
            }
            using var configDoc = JsonDocument.Parse(await File.ReadAllTextAsync(ConfigFile));
            var config = configDoc.RootElement;
            var baseUrl = config.GetProperty("serverUrl").GetString();
            var screenKey = config.GetProperty("screenKey").GetString();
            if (string.IsNullOrWhiteSpace(baseUrl) ||
                string.IsNullOrWhiteSpace(screenKey) ||
                screenKey.Length != 96)
                throw new InvalidDataException("配置不完整");
            var target = new Uri(baseUrl.TrimEnd('/') + "/api/screens/" + Uri.EscapeDataString(screenKey));
            // Production must use TLS. Loopback is allowed only for local development.
            if (target.Scheme != Uri.UriSchemeHttps &&
                !(target.Scheme == Uri.UriSchemeHttp && target.IsLoopback))
                throw new InvalidDataException("远程服务器必须使用 HTTPS");
            using var response = await http.GetAsync(target);
            response.EnsureSuccessStatusCode();
            var payload = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;
            title.Text = root.GetProperty("className").GetString() ?? "HAIZ 班级";
            var output = new StringBuilder();
            var count = 0;
            foreach (var a in root.GetProperty("assignments").EnumerateArray())
            {
                if (++count > 5) break;
                output.Append(a.GetProperty("subject").GetString()).Append(" · ")
                    .Append(a.GetProperty("title").GetString());
                if (a.GetProperty("due").ValueKind == JsonValueKind.String)
                    output.Append("  ·  截止 ").Append(a.GetProperty("due").GetString());
                output.AppendLine();
            }
            lines.Text = count == 0 ? "目前没有已发布任务" : output.ToString().TrimEnd();
        }
        catch (Exception)
        {
            // Do not display secrets or HTTP exception bodies on classroom projection.
            lines.Text = "HAIZ 同步暂时不可用 · 保留上课正常使用";
        }
        finally { running = false; }
    }
}
