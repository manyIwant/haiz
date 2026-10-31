using System;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using ClassIsland.Core.Abstractions.Controls;
using ClassIsland.Core.Attributes;

namespace HAIZ.ClassroomPlugin;

/// <summary>
/// First-party plugin settings page. Users paste the *whole* authorized
/// classroom URL; the key is never printed, manually transcribed or logged.
/// </summary>
[SettingsPageInfo("space.haiz.classroom.connection", "HAIZ 教室连接")]
public sealed class ConnectionSettingsPage : SettingsPageBase
{
    private readonly TextBox _url = new()
    {
        Watermark = "粘贴后台的完整「教室展示链接」（Ctrl + V）",
        PasswordChar = '●',
        MinWidth = 260,
        HorizontalAlignment = HorizontalAlignment.Stretch
    };
    private readonly TextBlock _current = new()
    {
        FontSize = 17, FontWeight = FontWeight.SemiBold,
        TextWrapping = TextWrapping.Wrap
    };
    private readonly TextBlock _status = new()
    {
        FontSize = 14, TextWrapping = TextWrapping.Wrap,
        Foreground = Brush.Parse("#58727E")
    };
    private readonly CheckBox _auto = new()
    {
        Content = "晚修自动投放（仅当天课表最后两节自习）",
        IsEnabled = false
    };
    private readonly Button _import = new() { Content = "验证并连接", MinWidth = 130 };
    private readonly Button _paste = new() { Content = "从剪贴板粘贴" };
    private readonly Button _test = new() { Content = "测试当前连接" };
    private readonly Button _disconnect = new() { Content = "断开教室连接" };
    private bool _suppress;
    private bool _busy;
    private bool _confirmDisconnect;

    public ConnectionSettingsPage()
    {
        var content = new StackPanel
        {
            Spacing = 16, Margin = new Thickness(28),
            HorizontalAlignment = HorizontalAlignment.Stretch
        };
        content.Children.Add(new TextBlock
        {
            Text = "HAIZ / 教室连接",
            FontSize = 13, Foreground = Brush.Parse("#9A7353")
        });
        content.Children.Add(new TextBlock
        {
            Text = "把作业带进教室。",
            FontSize = 28, FontWeight = FontWeight.SemiBold
        });
        content.Children.Add(new TextBlock
        {
            Text = "不需要填写 96 位密钥。只需从 HAIZ Academic 选中班级，点击「复制教室展示链接」，在这里粘贴并验证。",
            TextWrapping = TextWrapping.Wrap,
            Foreground = Brush.Parse("#58727E")
        });

        var connect = new StackPanel { Spacing = 10 };
        connect.Children.Add(new TextBlock
        {
            Text = "01 · 绑定班级",
            FontWeight = FontWeight.SemiBold, FontSize = 18
        });
        connect.Children.Add(_url);
        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal, Spacing = 10
        };
        buttons.Children.Add(_paste);
        buttons.Children.Add(_import);
        connect.Children.Add(buttons);
        content.Children.Add(Card(connect));

        var check = new StackPanel { Spacing = 10 };
        check.Children.Add(new TextBlock
        {
            Text = "02 · 核对状态",
            FontWeight = FontWeight.SemiBold, FontSize = 18
        });
        check.Children.Add(_current);
        check.Children.Add(_status);
        check.Children.Add(_test);
        content.Children.Add(Card(check));

        var study = new StackPanel { Spacing = 10 };
        study.Children.Add(new TextBlock
        {
            Text = "03 · 晚修投放",
            FontWeight = FontWeight.SemiBold, FontSize = 18
        });
        study.Children.Add(_auto);
        study.Children.Add(new TextBlock
        {
            Text = "默认关闭。启用后只在 ClassIsland 检测到当天最后两节有效自习课时显示；老师可以随时关闭本节的看板。正式教室使用前须完成 Windows 真机测试。",
            TextWrapping = TextWrapping.Wrap, Foreground = Brush.Parse("#58727E")
        });
        study.Children.Add(_disconnect);
        content.Children.Add(Card(study));

        Content = new ScrollViewer
        {
            Content = content, HorizontalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Disabled
        };

        _paste.Click += async (_, _) => await PasteAsync();
        _import.Click += async (_, _) => await ConnectAsync();
        _test.Click += async (_, _) => await TestExistingAsync();
        _disconnect.Click += (_, _) => Disconnect();
        _auto.Checked += (_, _) => SetAuto(true);
        _auto.Unchecked += (_, _) => SetAuto(false);
        ShowCurrent();
    }

    private static Border Card(Control child) => new()
    {
        Padding = new Thickness(22),
        CornerRadius = new CornerRadius(10),
        Background = Brush.Parse("#F3F5F5"),
        Child = child
    };

    private void ShowCurrent()
    {
        _suppress = true;
        try
        {
            var config = DisplaySettingsStore.Load();
            var hasValidSettings = DisplayLink.TryParse(
                (config.ServerUrl ?? "").TrimEnd('/') + "/api/screens/" + config.ScreenKey,
                out _, out _) && config.Enabled;
            _current.Text = hasValidSettings ? "已保存一个教室连接 · 凭据已隐藏" : "尚未绑定教室";
            _auto.IsEnabled = hasValidSettings;
            _auto.IsChecked = hasValidSettings && config.EveningAutoShow;
            _test.IsEnabled = hasValidSettings;
            _disconnect.IsEnabled = hasValidSettings;
            if (!hasValidSettings)
                _status.Text = "先复制完整的教室展示链接，验证后会自动保存到插件配置目录。";
        }
        catch
        {
            _current.Text = "本机配置文件无法读取";
            _status.Text = "原文件已保留。请检查 haiz-screen.json 格式；不要公开其中的密钥。";
            _auto.IsEnabled = false;
            _test.IsEnabled = false;
            _disconnect.IsEnabled = false;
        }
        finally { _suppress = false; }
    }

    private async Task PasteAsync()
    {
        try
        {
            var clipboard = TopLevel.GetTopLevel(this)?.Clipboard;
            if (clipboard == null) { _status.Text = "剪贴板不可用，请使用 Ctrl + V。"; return; }
            _url.Text = await clipboard.GetTextAsync() ?? "";
            _status.Text = "已粘贴。点击「验证并连接」检查班级作业。";
        }
        catch { _status.Text = "无法访问剪贴板，请用 Ctrl + V 粘贴链接。"; }
    }

    private async Task ConnectAsync()
    {
        if (_busy) return;
        if (!DisplayLink.TryParse(_url.Text, out var parsed, out var error) || parsed == null)
        {
            _status.Text = error;
            return;
        }
        ToggleBusy(true);
        _status.Text = "正在验证只读作业接口……";
        var probe = await DisplayConnectionProbe.CheckAsync(parsed);
        if (!probe.Ok)
        {
            _status.Text = probe.Message;
            ToggleBusy(false);
            return;
        }
        try
        {
            // New binding always resets auto-display to OFF: explicit teacher consent.
            // Preserve any manually-selected self-study subject identifiers.
            var previous = DisplaySettingsStore.Load();
            DisplaySettingsStore.Save(new DisplaySettings
            {
                Enabled = true,
                EveningAutoShow = false,
                ServerUrl = parsed.ServerUri.ToString().TrimEnd('/'),
                ScreenKey = parsed.ScreenKey,
                SelfStudySubjectIds = previous.SelfStudySubjectIds
            });
            _url.Text = "";
            ShowCurrent();
            _current.Text = "已连接 · " + probe.ClassName;
            _status.Text = "验证成功：读取到 " + probe.TaskCount + " 项公开作业。晚修自动投放仍为关闭状态。";
        }
        catch
        {
            _status.Text = "验证成功，但保存配置失败；请检查插件配置目录的写入权限。";
        }
        finally { ToggleBusy(false); }
    }

    private async Task TestExistingAsync()
    {
        if (_busy) return;
        DisplaySettings existing;
        try { existing = DisplaySettingsStore.Load(); }
        catch { _status.Text = "无法读取现有配置，请检查文件格式。"; return; }
        if (!DisplayLink.TryParse(
            existing.ServerUrl.TrimEnd('/') + "/api/screens/" + existing.ScreenKey,
            out var parsed, out var error) || parsed == null)
        {
            _status.Text = error;
            return;
        }
        ToggleBusy(true);
        _status.Text = "正在验证当前连接……";
        try
        {
            var probe = await DisplayConnectionProbe.CheckAsync(parsed);
            _status.Text = probe.Ok
                ? "连接正常：" + probe.ClassName + "，公开作业 " + probe.TaskCount + " 项。"
                : probe.Message;
            if (probe.Ok) _current.Text = "已连接 · " + probe.ClassName;
        }
        finally { ToggleBusy(false); }
    }

    private void SetAuto(bool enabled)
    {
        if (_suppress || _busy) return;
        try
        {
            var config = DisplaySettingsStore.Load();
            if (!config.Enabled || !DisplayLink.TryParse(
                config.ServerUrl.TrimEnd('/') + "/api/screens/" + config.ScreenKey,
                out _, out _))
                throw new InvalidOperationException("尚未绑定教室");
            config.EveningAutoShow = enabled;
            DisplaySettingsStore.Save(config);
            _status.Text = enabled
                ? "已启用晚修自动展示。请在教师授权的测试课表中验证。"
                : "晚修自动展示已关闭，普通作业组件仍可使用。";
        }
        catch
        {
            _status.Text = "无法保存晚修设置。请检查配置文件。";
            ShowCurrent();
        }
    }

    private void Disconnect()
    {
        if (_busy) return;
        if (!_confirmDisconnect)
        {
            _confirmDisconnect = true;
            _disconnect.Content = "确认断开并清除本机密钥";
            _status.Text = "再次点击确认，将停止本机作业同步并清除保存的只读凭据。";
            return;
        }
        try
        {
            DisplaySettingsStore.Save(new DisplaySettings());
            _url.Text = "";
            _confirmDisconnect = false;
            _disconnect.Content = "断开教室连接";
            ShowCurrent();
            _status.Text = "已断开本机教室连接。无需删除 JSON 文件。";
        }
        catch { _status.Text = "断开操作失败，配置未被覆盖。"; }
    }

    private void ToggleBusy(bool busy)
    {
        _busy = busy;
        _import.IsEnabled = !busy;
        _paste.IsEnabled = !busy;
        _test.IsEnabled = !busy;
        _disconnect.IsEnabled = !busy;
    }
}
