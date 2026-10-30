using System;
using System.Collections.Generic;
using System.Linq;

namespace HAIZ.ClassroomPlugin;

/// <summary>
/// Pure, host-independent timetable policy. Uses the last two *valid*
/// self-study lessons of the entire day, not a fixed 19:00–21:00 interval.
/// </summary>
public static class EveningPolicy
{
    public sealed record Lesson(Guid SubjectId, string Subject, TimeSpan Start, TimeSpan End, bool Enabled);
    public sealed record Slot(int Number, TimeSpan Start, TimeSpan End)
    {
        public string Label => $"晚修第{Number}节 · {Start:hh\\:mm}—{End:hh\\:mm}";
        public string Key(DateTime local) => $"{local:yyyy-MM-dd}/{Start:c}/{End:c}";
    }

    public static IReadOnlyList<Slot> LastTwo(
        IEnumerable<Lesson> lessons, IReadOnlyCollection<Guid> allowedIds)
    {
        var matches = lessons
            .Where(x => x.Enabled && x.End > x.Start
                && (allowedIds.Contains(x.SubjectId)
                    || x.Subject.Contains("自习", StringComparison.Ordinal)
                    || x.Subject.Contains("晚修", StringComparison.Ordinal)))
            .OrderBy(x => x.Start).ThenBy(x => x.End).ToArray();
        if (matches.Length < 2) return Array.Empty<Slot>();
        var a = matches[^2]; var b = matches[^1];
        if (a.End > b.Start) return Array.Empty<Slot>();
        return new Slot[] { new(1, a.Start, a.End), new(2, b.Start, b.End) };
    }

    public static Slot? Active(
        IEnumerable<Lesson> lessons,
        IReadOnlyCollection<Guid> allowedIds,
        TimeSpan currentTime)
    {
        return LastTwo(lessons, allowedIds)
            .FirstOrDefault(slot => currentTime >= slot.Start && currentTime < slot.End);
    }
}
