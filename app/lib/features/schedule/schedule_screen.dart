import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/planning.dart';
import '../../domain/pocket_models.dart';
import '../sync/sync_banner.dart';
import '../today/today_screen.dart' show MinuteClock;

/// 课表: a printed-timetable grid for scanning the week, a day list for
/// detail. Rows are periods (第 n 节), as students read them.
class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});
  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  bool _week = true;
  int _day = DateTime.now().weekday;

  @override
  Widget build(BuildContext context) {
    final store = HaizScope.of(context).store;
    return MinuteClock(builder: (context, now) => ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final courses = store.courses;
        return HaizPage(
          storageKey: 'schedule',
          title: '课表',
          subtitle: courses.isEmpty ? null : Padding(
            padding: const EdgeInsets.only(top: 8),
            child: SizedBox(
              width: 140,
              child: Segmented<bool>(
                key: const Key('schedule-mode'),
                value: _week,
                items: const [(true, '周'), (false, '日')],
                onChanged: (v) => setState(() => _week = v),
              ),
            ),
          ),
          actions: [
            BarAction(
              icon: Icons.add_rounded,
              label: '添加课程',
              onTap: () => showCourseEditor(context, store: store, weekday: _week ? now.weekday : _day),
            ),
          ],
          slivers: [
            const SliverToBoxAdapter(child: SyncBanner()),
            if (courses.isEmpty)
              SliverToBoxAdapter(
                child: EmptyNote(
                  title: '还没有课表',
                  body: '按节次录入：选好周几和时间，填上科目和教室。同一节课可以一次添加到多天。录入后，「今天」会显示正在上和下一节课。',
                  action: HaizButton(
                    key: const Key('add-first-course'),
                    label: '添加第一节课',
                    icon: Icons.add_rounded,
                    onPressed: () => showCourseEditor(context, store: store, weekday: now.weekday),
                  ),
                ),
              )
            else if (_week)
              SliverToBoxAdapter(child: WeekGrid(store: store, now: now))
            else ...[
              SliverToBoxAdapter(child: _DayStrip(selected: _day, now: now, courses: courses,
                  onSelect: (d) => setState(() => _day = d))),
              SliverToBoxAdapter(child: _DayList(store: store, weekday: _day, now: now)),
            ],
          ],
        );
      },
    ));
  }
}

class WeekGrid extends StatelessWidget {
  const WeekGrid({super.key, required this.store, required this.now});
  final PocketStore store;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final courses = store.courses;
    final hasWeekend = courses.any((x) => x.weekday >= 6);
    final days = [for (var d = 1; d <= (hasWeekend ? 7 : 5); d++) d];
    final rows = periodRows(courses, days);
    final minute = now.hour * 60 + now.minute;
    // The class's own room appears on most cells; print it once below the
    // grid and show a room in a cell only when the lesson is elsewhere.
    final home = homeRoom(courses);
    final monday = dayOf(now).subtract(Duration(days: now.weekday - 1));
    const lead = 38.0;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 0),
      child: LayoutBuilder(builder: (context, box) {
        final cell = (box.maxWidth - lead) / days.length;
        return Column(children: [
          // Day header: today in vermilion, with its date.
          Row(children: [
            const SizedBox(width: lead),
            for (final d in days)
              SizedBox(
                width: cell,
                child: Column(children: [
                  Text(weekdayName(d).substring(1),
                      style: TypeScale.label(d == now.weekday ? c.signal : c.ink2)),
                  const SizedBox(height: 1),
                  Text('${monday.add(Duration(days: d - 1)).day}',
                      style: TypeScale.micro(d == now.weekday ? c.signal : c.ink3)),
                ]),
              ),
          ]),
          const SizedBox(height: 6),
          for (final row in rows) ...[
            if (row.breakBefore)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(children: [
                  SizedBox(width: lead, child: Text('午休', style: TypeScale.micro(c.ink3))),
                  const Expanded(child: Hairline()),
                ]),
              ),
            SizedBox(
              height: 58,
              child: Row(children: [
                SizedBox(
                  width: lead,
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${row.index}', style: TypeScale.label(c.ink)),
                    Text(minutesText(row.start), style: TypeScale.micro(c.ink3).copyWith(fontSize: 9.5)),
                  ]),
                ),
                for (final d in days)
                  SizedBox(
                    width: cell,
                    child: Padding(
                      padding: const EdgeInsets.all(1.5),
                      child: _Cell(
                        course: row.cells[d],
                        showRoom: row.cells[d]?.location != home,
                        live: d == now.weekday && row.cells[d] != null &&
                            row.cells[d]!.startMinute <= minute && minute < row.cells[d]!.endMinute,
                        today: d == now.weekday,
                        onTap: () {
                          final course = row.cells[d];
                          if (course != null) {
                            showCourseDetail(context, store: store, course: course, index: row.index);
                          } else {
                            showCourseEditor(context, store: store, weekday: d, start: row.start, end: row.end);
                          }
                        },
                      ),
                    ),
                  ),
              ]),
            ),
          ],
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              [if (home != null) '未标注教室的课都在 $home。', '点空格添加课程，点课程查看或修改。'].join(''),
              style: TypeScale.caption(c.ink3)),
          ),
        ]);
      }),
    );
  }
}

String? homeRoom(Iterable<CourseSlot> courses) {
  final counts = <String, int>{};
  for (final x in courses) {
    if (x.location.isNotEmpty) counts[x.location] = (counts[x.location] ?? 0) + 1;
  }
  if (counts.isEmpty) return null;
  final best = counts.entries.reduce((a, b) => b.value > a.value ? b : a);
  // Only meaningful when one room clearly dominates.
  return best.value * 2 >= courses.length ? best.key : null;
}

class _Cell extends StatelessWidget {
  const _Cell({required this.course, required this.live, required this.today, required this.onTap, this.showRoom = true});
  final bool showRoom;
  final CourseSlot? course;
  final bool live;
  final bool today;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final course = this.course;
    if (course == null) {
      return Pressable(
        onTap: onTap,
        radius: Radii.block,
        semanticLabel: '添加课程',
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.block),
            border: Border.all(color: today ? c.rule : c.rule.withValues(alpha: .5), width: .6),
          ),
        ),
      );
    }
    final hue = subjectColor(course.name, dark: c.dark);
    return Semantics(
      button: true,
      label: '${course.name} ${minutesText(course.startMinute)} ${course.location}${live ? '，正在上课' : ''}',
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        radius: Radii.block,
        color: hue.withValues(alpha: c.dark ? .2 : .11),
        child: Container(
          padding: const EdgeInsets.fromLTRB(5, 5, 3, 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.block),
            border: live ? Border.all(color: c.signal, width: 1.6) : null,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(course.name, maxLines: 1, overflow: TextOverflow.clip,
                style: TypeScale.footnote(c.ink).copyWith(fontWeight: FontWeight.w700, height: 1.15)),
            const Spacer(),
            if (showRoom && course.location.isNotEmpty)
              Text(course.location, maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: TypeScale.micro(c.ink2).copyWith(fontSize: 9.5, fontWeight: FontWeight.w400, height: 1.15)),
          ]),
        ),
      ),
    );
  }
}

class _DayStrip extends StatelessWidget {
  const _DayStrip({required this.selected, required this.now, required this.courses, required this.onSelect});
  final int selected;
  final DateTime now;
  final List<CourseSlot> courses;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final monday = dayOf(now).subtract(Duration(days: now.weekday - 1));
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 4),
      child: Row(children: [
        for (var d = 1; d <= 7; d++)
          Expanded(
            child: Semantics(
              selected: d == selected,
              button: true,
              label: weekdayName(d),
              excludeSemantics: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onSelect(d),
                child: AnimatedContainer(
                  duration: context.haiz.motion(Motion.fast),
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  decoration: BoxDecoration(
                    color: d == selected ? c.inverse : Colors.transparent,
                    borderRadius: BorderRadius.circular(Radii.chip),
                  ),
                  child: Column(children: [
                    Text(weekdayName(d).substring(1), style: TypeScale.label(
                        d == selected ? c.onInverse : (d == now.weekday ? c.signal : c.ink2))),
                    const SizedBox(height: 2),
                    Text('${monday.add(Duration(days: d - 1)).day}', style: TypeScale.micro(
                        d == selected ? c.onInverse.withValues(alpha: .7) : c.ink3)),
                    const SizedBox(height: 3),
                    Text('${coursesForDay(courses, d).length}', style: TypeScale.micro(
                        d == selected ? c.onInverse.withValues(alpha: .7) : c.ink3).copyWith(fontSize: 9)),
                  ]),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}

class _DayList extends StatelessWidget {
  const _DayList({required this.store, required this.weekday, required this.now});
  final PocketStore store;
  final int weekday;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final list = coursesForDay(store.courses, weekday);
    final minute = now.hour * 60 + now.minute;
    final isToday = weekday == now.weekday;
    if (list.isEmpty) {
      return EmptyNote(
        title: '${weekdayName(weekday)}没有课',
        action: LinkAction('添加课程', icon: Icons.add_rounded,
            onTap: () => showCourseEditor(context, store: store, weekday: weekday)),
      );
    }
    final children = <Widget>[];
    var nowPlaced = !isToday;
    for (final (i, course) in list.indexed) {
      if (!nowPlaced && minute < course.startMinute) {
        children.add(_NowLine(minute: minute));
        nowPlaced = true;
      }
      final live = isToday && course.startMinute <= minute && minute < course.endMinute;
      final past = isToday && course.endMinute <= minute;
      children.add(Pressable(
        onTap: () => showCourseDetail(context, store: store, course: course, index: i + 1),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter, 12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(
              width: 56,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(minutesText(course.startMinute), style: TypeScale.label(past ? c.ink3 : c.ink)),
                Text(minutesText(course.endMinute), style: TypeScale.caption(c.ink3)),
              ]),
            ),
            Container(width: 3, height: 38, margin: const EdgeInsets.only(right: 12),
                decoration: BoxDecoration(color: live ? c.signal : subjectColor(course.name, dark: c.dark)
                    .withValues(alpha: past ? .35 : 1), borderRadius: BorderRadius.circular(1.5))),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(course.name, style: TypeScale.body(past ? c.ink3 : c.ink).copyWith(fontWeight: FontWeight.w600)),
                Text(['第 ${i + 1} 节', if (course.location.isNotEmpty) course.location].join(' · '),
                    style: TypeScale.footnote(c.ink2)),
              ]),
            ),
            if (live) Text('进行中', style: TypeScale.caption(c.signal).copyWith(fontWeight: FontWeight.w600)),
          ]),
        ),
      ));
      if (live) nowPlaced = true;
    }
    if (!nowPlaced) children.add(_NowLine(minute: minute));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
  }
}

class _NowLine extends StatelessWidget {
  const _NowLine({required this.minute});
  final int minute;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Space.gutter - 4),
      child: Row(children: [
        Text(minutesText(minute), style: TypeScale.micro(c.signal).copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(width: 6),
        Container(width: 5, height: 5, decoration: BoxDecoration(color: c.signal, shape: BoxShape.circle)),
        Expanded(child: Container(height: 1.2, color: c.signal)),
      ]),
    );
  }
}

Future<void> showCourseDetail(BuildContext context, {required PocketStore store, required CourseSlot course, required int index}) {
  return showHaizSheet<void>(context, builder: (sheet) {
    final c = sheet.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, Space.x6),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(
              color: subjectColor(course.name, dark: c.dark), borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 8),
          Text(course.name, style: TypeScale.title(c.ink)),
        ]),
        const SizedBox(height: 6),
        Text('${weekdayName(course.weekday)} · 第 $index 节 · ${minutesText(course.startMinute)}–${minutesText(course.endMinute)}',
            style: TypeScale.callout(c.ink2)),
        if (course.location.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(course.location, style: TypeScale.callout(c.ink2)),
        ],
        if (course.example) ...[
          const SizedBox(height: 6),
          Text('这是示例课程，可以修改或删除。', style: TypeScale.caption(c.amber)),
        ],
        const SizedBox(height: Space.x4),
        Row(children: [
          HaizButton(label: '修改', kind: HaizButtonKind.secondary, dense: true, icon: Icons.edit_outlined, onPressed: () {
            Navigator.pop(sheet);
            showCourseEditor(context, store: store, course: course, weekday: course.weekday);
          }),
          const Spacer(),
          LinkAction('删除这节课', color: c.signal, onTap: () {
            final ticket = store.generation;
            store.deleteCourse(course.id);
            Navigator.pop(sheet);
            showToast(context, '已删除 ${weekdayName(course.weekday)} ${course.name}', action: '撤销', onAction: () {
              if (store.generation == ticket) store.restoreCourse(course);
            });
          }),
        ]),
      ]),
    );
  });
}

Future<void> showCourseEditor(BuildContext context, {required PocketStore store, CourseSlot? course,
    required int weekday, int? start, int? end}) {
  return showHaizSheet<void>(context, builder: (_) => CourseEditor(
    store: store, course: course, weekday: weekday, start: start, end: end));
}

class CourseEditor extends StatefulWidget {
  const CourseEditor({super.key, required this.store, this.course, required this.weekday, this.start, this.end});
  final PocketStore store;
  final CourseSlot? course;
  final int weekday;
  final int? start;
  final int? end;
  @override
  State<CourseEditor> createState() => _CourseEditorState();
}

class _CourseEditorState extends State<CourseEditor> {
  late final _name = TextEditingController(text: widget.course?.name ?? '');
  late final _place = TextEditingController(text: widget.course?.location ?? '');
  late final Set<int> _days = {widget.course?.weekday ?? widget.weekday};
  late int _start = widget.course?.startMinute ?? widget.start ?? 480;
  late int _end = widget.course?.endMinute ?? widget.end ?? 520;
  late final int _generation = widget.store.generation;
  String? _error;

  bool get _editing => widget.course != null;

  @override
  void dispose() {
    _name.dispose();
    _place.dispose();
    super.dispose();
  }

  Future<void> _pick(bool start) async {
    final value = start ? _start : _end;
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: value ~/ 60, minute: value % 60),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true), child: child!),
    );
    if (picked == null || !mounted) return;
    setState(() {
      final m = picked.hour * 60 + picked.minute;
      if (start) {
        final length = _end - _start;
        _start = m;
        _end = (m + (length > 0 ? length : 40)).clamp(m + 1, 1440);
      } else {
        _end = m;
      }
    });
  }

  void _save() {
    final store = widget.store;
    final name = _name.text.trim();
    if (name.isEmpty) { setState(() => _error = '请填写课程名'); return; }
    if (_end <= _start) { setState(() => _error = '结束时间要晚于开始时间'); return; }
    if (store.generation != _generation) {
      Navigator.pop(context);
      showToast(context, '账号已切换，课程没有写入任何账号。');
      return;
    }
    if (_editing) {
      store.updateCourse(widget.course!.id, name: name, weekday: _days.first,
          startMinute: _start, endMinute: _end, location: _place.text);
    } else {
      for (final d in _days.toList()..sort()) {
        store.addCourse(name: name, weekday: d, startMinute: _start, endMinute: _end, location: _place.text);
      }
    }
    Navigator.pop(context);
    showToast(context, _editing ? '已保存' : '已添加 ${_days.length} 节 $name');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final rows = periodRows(widget.store.courses, const [1, 2, 3, 4, 5, 6, 7]);
    final locations = {for (final x in widget.store.courses) if (x.location.isNotEmpty) x.location}.take(4).toList();
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, Space.x6),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(_editing ? '修改课程' : '添加课程', style: TypeScale.headline(c.ink)),
          const Spacer(),
          HaizButton(key: const Key('save-course'), label: '保存', dense: true, onPressed: _save),
        ]),
        const SizedBox(height: Space.x3),
        TextField(
          key: const Key('course-name'),
          controller: _name,
          autofocus: !_editing,
          maxLength: 40,
          decoration: InputDecoration(hintText: '科目，例如 数学', counterText: '', errorText: _error),
          onChanged: (_) => setState(() => _error = null),
        ),
        const SizedBox(height: Space.x2),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final s in knownSubjects.take(9))
            HaizChip(label: s, selected: _name.text.trim() == s,
                leading: SubjectMark(s, showLabel: false),
                onTap: () => setState(() { _name.text = s; _error = null; })),
        ]),
        const SizedBox(height: Space.x4),
        TextField(
          key: const Key('course-place'),
          controller: _place,
          maxLength: 40,
          decoration: const InputDecoration(hintText: '教室（选填）', counterText: ''),
        ),
        if (locations.isNotEmpty) ...[
          const SizedBox(height: Space.x2),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final l in locations)
              HaizChip(label: l, selected: _place.text == l, onTap: () => setState(() => _place.text = l)),
          ]),
        ],
        const SizedBox(height: Space.x4),
        Text(_editing ? '周几' : '周几（可多选）', style: TypeScale.label(c.ink2)),
        const SizedBox(height: Space.x2),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (var d = 1; d <= 7; d++)
            HaizChip(
              label: weekdayName(d),
              selected: _days.contains(d),
              onTap: () => setState(() {
                if (_editing) {
                  _days..clear()..add(d);
                } else if (_days.contains(d)) {
                  if (_days.length > 1) _days.remove(d);
                } else {
                  _days.add(d);
                }
              }),
            ),
        ]),
        const SizedBox(height: Space.x4),
        Text('时间', style: TypeScale.label(c.ink2)),
        const SizedBox(height: Space.x2),
        if (rows.isNotEmpty) ...[
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final r in rows)
              HaizChip(
                label: '第${r.index}节 ${minutesText(r.start)}',
                selected: _start == r.start && _end == r.end,
                onTap: () => setState(() { _start = r.start; _end = r.end; }),
              ),
          ]),
          const SizedBox(height: Space.x2),
        ],
        Row(children: [
          Expanded(child: HaizButton(label: '开始 ${minutesText(_start)}', kind: HaizButtonKind.secondary,
              dense: true, onPressed: () => _pick(true))),
          const SizedBox(width: 8),
          Expanded(child: HaizButton(label: '结束 ${minutesText(_end)}', kind: HaizButtonKind.secondary,
              dense: true, onPressed: () => _pick(false))),
        ]),
      ]),
    );
  }
}
