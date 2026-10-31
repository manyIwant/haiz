using HAIZ.ClassroomPlugin;
using static HAIZ.ClassroomPlugin.EveningPolicy;

var passed = 0;
void Check(bool condition, string name)
{
    if (!condition) throw new Exception("FAIL: " + name);
    Console.WriteLine("PASS: " + name);
    passed++;
}
Lesson Make(string subject, string start, string end, Guid? id = null, bool enabled = true)
    => new(id ?? Guid.NewGuid(), subject, TimeSpan.Parse(start), TimeSpan.Parse(end), enabled);
var empty = Array.Empty<Guid>();
var weekday = new[]
{
    Make("数学", "10:00", "10:45"),
    Make("午间自习", "12:00", "12:30"),
    Make("晚修", "19:00", "19:45"),
    Make("自习", "19:55", "20:40")
};
var last = LastTwo(weekday, empty);
Check(last.Count == 2 && last[0].Start == TimeSpan.Parse("19:00") && last[1].Start == TimeSpan.Parse("19:55"),
    "从三节自习中正确选择最后两节，排除午间自习");
Check(Active(weekday, empty, TimeSpan.Parse("18:59:59")) == null,
    "开始之前不展示");
Check(Active(weekday, empty, TimeSpan.Parse("19:00"))?.Number == 1,
    "第一节开始触发");
Check(Active(weekday, empty, TimeSpan.Parse("19:45")) == null,
    "第一节结束立即收起");
Check(Active(weekday, empty, TimeSpan.Parse("19:54:59")) == null,
    "两节之间的课间不展示");
Check(Active(weekday, empty, TimeSpan.Parse("19:55"))?.Number == 2,
    "第二节开始自动触发");
Check(Active(weekday, empty, TimeSpan.Parse("20:40")) == null,
    "第二节结束收起");

Check(LastTwo(new[] { Make("晚修", "19:00", "19:45") }, empty).Count == 0,
    "仅一节有效自习则不触发");
Check(LastTwo(new[] { Make("自习", "19:00", "19:50"), Make("自习", "19:40", "20:20") }, empty).Count == 0,
    "最后两节冲突重叠则不触发");
Check(LastTwo(new[] { Make("自习", "19:00", "19:00"), Make("自习", "19:55", "20:40") }, empty).Count == 0,
    "无效的零长度课程被排除");
Check(LastTwo(new[] { Make("自习", "19:00", "19:45", enabled: false), Make("晚修", "19:55", "20:40") }, empty).Count == 0,
    "禁用的课程不参与判断");
Check(LastTwo(new[] { Make("英语", "19:00", "19:45"), Make("数学", "19:55", "20:40") }, empty).Count == 0,
    "常规课程不会因处于晚间而误触发");
var customId = Guid.NewGuid();
Check(LastTwo(new[] { Make("自习", "18:00", "18:45"), Make("课程未命名", "19:00", "19:45", customId) }, new[] { customId }).Count == 2,
    "手动指定的课程 GUID 可以识别未命名自习");
var sorted = LastTwo(new[] { Make("自习", "19:55", "20:40"), Make("晚修", "19:00", "19:45") }, empty);
Check(sorted.Count == 2 && sorted[0].Start < sorted[1].Start,
    "输入顺序乱序仍按时间排序");
Check(sorted[0].Key(new DateTime(2026,10,30)) != sorted[1].Key(new DateTime(2026,10,30)),
    "同日两节课使用不同的关闭记忆键");
Check(sorted[0].Key(new DateTime(2026,10,30)) != sorted[0].Key(new DateTime(2026,10,31)),
    "跨日重新允许自动显示");

var key = new string('a', 96);
var valid = "https://example.trycloudflare.com/api/screens/" + key;
Check(DisplayLink.TryParse(valid, out var link, out _) &&
    link?.ScreenKey == key && link.ServerUri.ToString().TrimEnd('/') == "https://example.trycloudflare.com",
    "完整教室链接自动提取服务器和96位密钥");
Check(!DisplayLink.TryParse("http://example.trycloudflare.com/api/screens/" + key, out _, out _),
    "拒绝非本机HTTP");
Check(DisplayLink.TryParse("http://127.0.0.1:8780/api/screens/" + key, out _, out _),
    "本机Node测试允许loopback HTTP");
Check(!DisplayLink.TryParse(valid + "?token=1", out _, out _),
    "拒绝附带查询参数的链接");
Check(!DisplayLink.TryParse(valid + "/extra", out _, out _),
    "拒绝不属于只读API的路径");
Check(!DisplayLink.TryParse(valid.Replace(key, new string('q', 96)), out _, out _),
    "拒绝非十六进制伪密钥");
Check(!DisplayLink.TryParse(valid.Replace(key, new string('a', 95)), out _, out _),
    "拒绝长度不足的密钥");
Check(!DisplayLink.TryParse("https://user:pass@example.trycloudflare.com/api/screens/" + key, out _, out _),
    "拒绝URL中携带用户密码");
Check(!DisplayLink.TryParse(valid + "#fragment", out _, out _),
    "拒绝带URL片段的链接");
Check(!DisplayLink.TryParse("https://example.trycloudflare.com:443/other/" + key, out _, out _),
    "拒绝非法路径");
var folder = Path.Combine(Path.GetTempPath(), "haiz-classisland-test-" + Guid.NewGuid().ToString("N"));
try
{
    DisplaySettingsStore.FilePath = Path.Combine(folder, "haiz-screen.json");
    var observed = 0;
    void Changed() => observed++;
    DisplaySettingsStore.Changed += Changed;
    Check(!DisplaySettingsStore.Load().Enabled &&
        !DisplaySettingsStore.Load().EveningAutoShow, "首次绑定默认全部关闭");
    var guid = Guid.NewGuid();
    DisplaySettingsStore.Save(new DisplaySettings
    {
        Enabled = true, EveningAutoShow = false, ServerUrl = link!.ServerUri.ToString().TrimEnd('/'),
        ScreenKey = link.ScreenKey, SelfStudySubjectIds = new[] { guid }
    });
    var saved = DisplaySettingsStore.Load();
    Check(observed == 1 && saved.Enabled && !saved.EveningAutoShow &&
        saved.SelfStudySubjectIds.SequenceEqual(new[] { guid }), "保存后立刻发出更新信号，保留课程GUID");
    Check(File.ReadAllText(DisplaySettingsStore.FilePath).Contains("\\"screenKey\\""),
        "保存JSON兼容旧版字段命名");
    Check(Directory.GetFiles(folder, "*.tmp").Length == 0, "原子保存不残留临时文件");
    DisplaySettingsStore.Save(new DisplaySettings());
    Check(!DisplaySettingsStore.Load().Enabled && DisplaySettingsStore.Load().ScreenKey == "",
        "断开连接清空本机凭据");
    DisplaySettingsStore.Changed -= Changed;
}
finally
{
    if (Directory.Exists(folder)) Directory.Delete(folder, true);
}
Console.WriteLine($"All {passed} HAIZ ClassIsland policy and onboarding checks passed.");

