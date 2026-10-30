/// Conservative, completely local notice parsing for user-supplied school texts.
/// Every result is a *candidate*, never a teacher-verified assignment.
class NoticeCandidate {
  final String title;
  final String subject;
  final DateTime? due;
  final String source;
  final String original;
  final bool ambiguous;

  const NoticeCandidate({
    required this.title,
    required this.subject,
    required this.due,
    required this.source,
    required this.original,
    required this.ambiguous,
  });
}

/// Keep strict formats supported by HAIZ Teacher export and simple Chinese text.
/// No external services, scraping, personal chat reading or side effects.
class NoticeParser {
  static const _subjects = [
    '数学',
    '语文',
    '英语',
    '物理',
    '化学',
    '生物',
    '历史',
    '地理',
    '政治',
    '体育',
    '信息',
    '通用',
  ];
  static final _action = RegExp(
    r'交|完成|提交|上交|复习|预习|背诵|默写|做题|练习|整理|准备|带好|带上|阅读|背|写|记|做|交齐|实验报告',
  );
  static final _calendar = RegExp(r'(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?');
  static final _monthDay = RegExp(r'(\d{1,2})月(\d{1,2})[日号]');
  static final _week = RegExp(r'(下周|本周|这周|周|星期)([一二三四五六日天])');

  static List<NoticeCandidate> parse(String raw, {DateTime? today}) {
    final now = today ?? DateTime.now();
    final day = DateTime(now.year, now.month, now.day);
    final output = <NoticeCandidate>[];
    final seen = <String>{};

    final parts = raw
        .replaceAll(RegExp(r'[。；;\n]+'), '\n')
        .split('\n')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .take(40);

    for (final line in parts) {
      final structured = _parseStructured(line, day);
      if (structured != null) {
        final key =
            '${structured.subject}/${structured.title}/${structured.due}';
        if (seen.add(key)) output.add(structured);
        continue;
      }

      if (line.length < 4 || !_action.hasMatch(line)) continue;
      String subject = '其他';
      for (final s in _subjects) {
        if (line.contains(s)) {
          subject = s;
          break;
        }
      }
      final due = extractDue(line, day);
      final uncertainty =
          due == null ||
          RegExp(r'可能|大概|或许|暂定|待定|不知道|看情况').hasMatch(line) ||
          RegExp(r'周[一二三四五六日天]|星期[一二三四五六日天]').hasMatch(line);
      final title = line
          .replaceFirst(RegExp(r'^(老师通知[:：]?|作业[:：]?|通知[:：]?)'), '')
          .trim();
      if (title.isEmpty) continue;
      final key = '$subject/$title/$due';
      if (seen.add(key)) {
        output.add(
          NoticeCandidate(
            title: title,
            subject: subject,
            due: due,
            source: '粘贴文本',
            original: line,
            ambiguous: uncertainty,
          ),
        );
      }
    }
    return output;
  }

  static NoticeCandidate? _parseStructured(String line, DateTime day) {
    // Teacher page exports only this explicit, portable format.
    final match = RegExp(
      r'^【HAIZ任务】\s*([^｜|]+)[｜|]([^｜|]+)[｜|](\d{4}-\d{2}-\d{2}|待定)(?:[｜|](.*))?$',
    ).firstMatch(line);
    if (match == null) return null;
    final subject = match.group(1)!.trim();
    final title = match.group(2)!.trim();
    if (subject.isEmpty || title.isEmpty) return null;
    final deadline = match.group(3)!;
    final due = deadline == '待定' ? null : DateTime.tryParse(deadline);
    return NoticeCandidate(
      title: title,
      subject: subject,
      due: due,
      source: match.group(4)?.trim().isNotEmpty == true
          ? match.group(4)!.trim()
          : '教师工作台（未验证身份）',
      original: line,
      ambiguous: due == null,
    );
  }

  static DateTime? extractDue(String text, DateTime today) {
    final ymd = _calendar.firstMatch(text);
    if (ymd != null) {
      return _validDate(
        int.parse(ymd.group(1)!),
        int.parse(ymd.group(2)!),
        int.parse(ymd.group(3)!),
      );
    }
    final md = _monthDay.firstMatch(text);
    if (md != null) {
      final month = int.parse(md.group(1)!);
      final d = int.parse(md.group(2)!);
      var candidate = _validDate(today.year, month, d);
      if (candidate != null && candidate.isBefore(today)) {
        candidate = _validDate(today.year + 1, month, d);
      }
      return candidate;
    }
    // Relative dates must be anchored to the date of importing, not message send time.
    if (text.contains('大后天')) return today.add(const Duration(days: 3));
    if (text.contains('后天')) return today.add(const Duration(days: 2));
    if (text.contains('明天')) return today.add(const Duration(days: 1));
    if (text.contains('今天') || text.contains('今晚')) return today;
    final match = _week.firstMatch(text);
    if (match != null) {
      final key = match.group(2)!;
      final target = const {
        '一': 1,
        '二': 2,
        '三': 3,
        '四': 4,
        '五': 5,
        '六': 6,
        '日': 7,
        '天': 7,
      }[key]!;
      final prefix = match.group(1)!;
      final delta = prefix == '下周'
          ? (8 - today.weekday + target - 1)
          : (target - today.weekday + 7) % 7;
      return today.add(Duration(days: delta));
    }
    return null;
  }

  static DateTime? _validDate(int year, int month, int day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    final date = DateTime(year, month, day);
    if (date.year != year || date.month != month || date.day != day) {
      return null;
    }
    return date;
  }
}
