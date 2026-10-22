using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;

namespace Haiz.ClassIsland;

// Non-topmost and never activates above a lesson app. The teacher may close it for the current period.
public sealed class HomeworkWindow : Window
{
    private readonly StackPanel _content = new() { Margin = new Thickness(36), Spacing = 18 };
    public HomeworkWindow()
    {
        Title = "HAIZ · 今日作业 · 本地实验"; Width = 1440; Height = 850;
        Background = Brush.Parse("#EEF0E4"); Foreground = Brush.Parse("#293F32");
        Topmost = false; ShowActivated = false;
        Content = new ScrollViewer { Content = _content };
    }
    public void Update(string scope, string slot, Assignment[] items, string status)
    {
        _content.Children.Clear();
        _content.Children.Add(new TextBlock { Text = "HAIZ CLASSROOM / EVENING STUDY", FontSize = 14 });
        _content.Children.Add(new TextBlock { Text = "今日作业", FontSize = 46 });
        _content.Children.Add(new TextBlock { Text = $"{scope} · {slot} · {status}", FontSize = 20 });
        var hide = new Button { Content = "隐藏本节晚修作业板", FontSize = 18 };
        hide.Click += (_, _) => Close(); _content.Children.Add(hide);
        if (items.Length == 0) _content.Children.Add(new TextBlock { Text = "今天还没有已审核作业，请以任课教师说明为准。", FontSize = 28 });
        foreach (var item in items)
        {
            var card = new StackPanel { Spacing = 12 };
            card.Children.Add(new TextBlock { Text = item.Subject, FontSize = 30, FontWeight = FontWeight.SemiBold });
            card.Children.Add(new TextBlock { Text = item.Content, FontSize = 26, TextWrapping = TextWrapping.Wrap });
            card.Children.Add(new TextBlock { Text = $"准备：{item.Materials}    交付：{item.Due}", FontSize = 19, TextWrapping = TextWrapping.Wrap });
            _content.Children.Add(new Border { Child = card, Background = Brush.Parse("#FBFAF1"), Padding = new Thickness(24), CornerRadius = new CornerRadius(6) });
        }
    }
}
