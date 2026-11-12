import 'quick_task_date_parser.dart';

/// Uncommitted suggestions. Nothing here writes user data.
class SenseDraft {
  SenseDraft({
    required this.id,
    required this.title,
    required this.subject,
    required this.evidence,
    required this.timeHint,
    this.due,
    this.selected = true,
  });

  final String id;
  String title;
  String subject;
  final String evidence;
  String timeHint;
  DateTime? due;
  bool selected;
}

/// Local, deterministic fallback. A deadline is never silently inferred from
/// "tonight / review"; the user may edit it before confirming.
class TaskSenseEngine {
  static const subjects = ['数学', '语文', '英语', '物理', '化学', '生物', '其他'];

  static String subjectFor(String text) {
    for (final s in subjects.take(subjects.length - 1)) {
      if (text.contains(s)) return s;
    }
    return '其他';
  }

  static List<SenseDraft> local(String source, DateTime now) {
    final input = source.trim();
    if (input.isEmpty || input.length > 600) {
      throw const FormatException('请输入 1–600 个字符');
    }
    final pieces = input
        .split(RegExp(r'[，,；;。\n]+'))
        .map((x) => x.trim())
        .where((x) => x.isNotEmpty)
        .toList();
    if (pieces.length > 8) {
      throw const FormatException('一次最多整理 8 项，请分批处理');
    }
    final segments = pieces.isEmpty ? [input] : pieces;
    return [
      for (var i = 0; i < segments.length; i++)
        _draft('local_$i', segments[i], segments[i], now),
    ];
  }

  static SenseDraft _draft(
    String id,
    String title,
    String evidence,
    DateTime now, {
    String? timeKind,
  }) {
    final suggestion = QuickTaskDateParser.suggest(evidence, now);
    // A model label alone cannot turn an ordinary study plan into a due date.
    final isDeadline = timeKind != 'planned' &&
        RegExp(r'交|上交|提交|截止|到期|之前完成|前完成').hasMatch(evidence);
    final due = isDeadline ? suggestion?.date : null;
    final hasPlan = RegExp(r'今晚|今夜|今天晚上|明早|明晚|复习|预习|准备').hasMatch(evidence);
    final hint = due != null
        ? '建议截止：${suggestion!.label}（可修改）'
        : suggestion != null
            ? '提及 ${suggestion.label}，未视为截止日期'
            : hasPlan
                ? '计划时间不等于截止日期'
                : '未识别到明确截止日期';
    return SenseDraft(
      id: id,
      title: title,
      subject: subjectFor(evidence),
      evidence: evidence,
      timeHint: hint,
      due: due,
    );
  }

  /// Only accepts suggestions grounded in exact spans of the submitted text.
  /// The remote service cannot determine arbitrary dates or user identifiers.
  static List<SenseDraft> fromRemote(
    Object? payload,
    String source,
    DateTime now,
  ) {
    if (payload is! Map || payload['suggestions'] is! List) {
      throw const FormatException('AI 响应格式无效');
    }
    final entries = payload['suggestions'] as List;
    if (entries.isEmpty || entries.length > 8) {
      throw const FormatException('AI 任务数量无效');
    }
    final result = <SenseDraft>[];
    for (var i = 0; i < entries.length; i++) {
      final entry = entries[i];
      if (entry is! Map) throw const FormatException('任务格式无效');
      final title = entry['title'];
      final evidence = entry['evidence'];
      final kind = entry['time_kind'];
      if (title is! String || title.trim().isEmpty || title.length > 140 ||
          evidence is! String || evidence.trim().isEmpty ||
          !source.contains(evidence) ||
          !['deadline', 'planned', 'none'].contains(kind)) {
        throw const FormatException('AI 输出缺少可信原文依据');
      }
      result.add(_draft(
        'remote_$i', title.trim(), evidence, now, timeKind: kind as String,
      ));
    }
    return result;
  }
}
