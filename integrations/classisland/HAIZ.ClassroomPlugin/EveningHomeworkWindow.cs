using System;
using System.Collections.Generic;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace HAIZ.ClassroomPlugin;

/// <summary>
/// A normal, non-topmost classroom window. Closing it suppresses re-opening
/// for the rest of that period; the ClassIsland host itself is untouched.
/// </summary>
public sealed class EveningHomeworkWindow : Window
{
    private readonly StackPanel _content = new()
    {
        Margin = new Thickness(36), Spacing = 18
    };

    public EveningHomeworkWindow()
    {
        Title = "HAIZ · 晚修作业";
        Width = 1360; Height = 820;
        MinWidth = 680; MinHeight = 480;
        Background = Brush.Parse("#F4F3ED");
        Foreground = Brush.Parse("#183743");
        Topmost = false;
        ShowActivated = false;
        Content = new ScrollViewer { Content = _content };
    }

    public void Update(string className, string slot, IReadOnlyList<EveningHomeworkService.TaskRow> tasks)
    {
        _content.Children.Clear();
        _content.Children.Add(new TextBlock { Text = "HAIZ ACADEMIC  /  CLASSROOM", FontSize = 13 });
        _content.Children.Add(new TextBlock
        {
            Text = "晚修作业看板", FontSize = 44, FontWeight = FontWeight.SemiBold
        });
        _content.Children.Add(new TextBlock
        {
            Text = $"{className}  ·  {slot}  ·  最近已发布任务",
            FontSize = 18, Foreground = Brush.Parse("#617C83")
        });
        var close = new Button { Content = "隐藏本节晚修作业", FontSize = 16, Padding = new Thickness(16, 11) };
        close.Click += (_, _) => Close();
        _content.Children.Add(close);
        if (tasks.Count == 0)
        {
            _content.Children.Add(new TextBlock
            {
                Text = "目前没有可以展示的作业。请以任课教师安排为准。",
                FontSize = 24, TextWrapping = TextWrapping.Wrap
            });
        }
        foreach (var task in tasks)
        {
            var card = new StackPanel { Spacing = 8 };
            card.Children.Add(new TextBlock
            {
                Text = task.Subject, FontSize = 19, Foreground = Brush.Parse("#A17152")
            });
            card.Children.Add(new TextBlock
            {
                Text = task.Title, FontSize = 27, TextWrapping = TextWrapping.Wrap,
                FontWeight = FontWeight.SemiBold
            });
            if (!string.IsNullOrWhiteSpace(task.Due))
            {
                card.Children.Add(new TextBlock
                {
                    Text = "截止：" + task.Due, FontSize = 17,
                    Foreground = Brush.Parse("#617C83")
                });
            }
            _content.Children.Add(new Border
            {
                Child = card,
                Background = Brush.Parse("#FFFFFF"),
                Padding = new Thickness(22),
                CornerRadius = new CornerRadius(10)
            });
        }
        _content.Children.Add(new TextBlock
        {
            Text = "HAIZ 独立项目 · 只显示班级公共任务，不展示学生信息。",
            FontSize = 12, Foreground = Brush.Parse("#617C83")
        });
    }
}
