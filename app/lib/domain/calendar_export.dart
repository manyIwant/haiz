import 'dart:convert';
import 'dart:typed_data';

import 'pocket_models.dart';

/// RFC 5545 all-day calendar export. No automatic access to private calendars.
/// Date-only due time avoids making up an exact hour for school assignments.
class CalendarExport {
  static String escape(String value) => value
      .replaceAll(r'\', r'\\')
      .replaceAll(';', r'\;')
      .replaceAll(',', r'\,')
      .replaceAll('\r\n', '\n')
      .replaceAll('\n', r'\n');

  static String _date(DateTime v) =>
      '${v.year.toString().padLeft(4, '0')}${v.month.toString().padLeft(2, '0')}${v.day.toString().padLeft(2, '0')}';

  static String generate(List<TaskItem> tasks, {DateTime? generatedAt}) {
    final created = (generatedAt ?? DateTime.now()).toUtc();
    final dt =
        '${_date(created)}T${created.hour.toString().padLeft(2, '0')}${created.minute.toString().padLeft(2, '0')}${created.second.toString().padLeft(2, '0')}Z';
    final lines = <String>[
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HAIZ//School Tasks//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];
    for (final task in tasks.where((x) => !x.completed)) {
      final due = task.dueIso;
      if (due == null) continue;
      final date = DateTime.tryParse(due);
      if (date == null) continue;
      final next = date.add(const Duration(days: 1));
      lines.addAll([
        'BEGIN:VEVENT',
        'UID:${escape(task.id)}@haiz-local',
        'DTSTAMP:$dt',
        'DTSTART;VALUE=DATE:${_date(date)}',
        'DTEND;VALUE=DATE:${_date(next)}',
        'SUMMARY:${escape(task.subject)} · ${escape(task.title)}',
        'DESCRIPTION:${escape(task.source)}',
        'END:VEVENT',
      ]);
    }
    lines.add('END:VCALENDAR');
    return '${lines.join('\r\n')}\r\n';
  }

  static Uint8List bytes(List<TaskItem> tasks, {DateTime? generatedAt}) =>
      Uint8List.fromList(
        utf8.encode(generate(tasks, generatedAt: generatedAt)),
      );
}
