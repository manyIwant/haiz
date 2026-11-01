/// Offline, deterministic, *suggestion-only* date recognition for quick tasks.
/// A suggestion is never a deadline until the user explicitly accepts it.
class QuickTaskDateSuggestion {
  const QuickTaskDateSuggestion({
    required this.date,
    required this.label,
    required this.title,
    required this.start,
    required this.end,
  });

  final DateTime date;
  final String label;
  final String title;
  final int start;
  final int end;
}

class QuickTaskDateParser {
  static final RegExp _tokens = RegExp(
    r'\d{4}-\d{2}-\d{2}|下周[一二三四五六日天]|(?<![上下每本])周[一二三四五六日天]|今天|明天|后天',
  );

  /// Ambiguous, conflicting or invalid dates return null, preserving the text.
  static QuickTaskDateSuggestion? suggest(String text, DateTime reference) {
    final matches = _tokens.allMatches(text).toList(growable: false);
    if (matches.length != 1) return null;
    final match = matches.single;
    final token = match.group(0)!;
    final today = DateTime(reference.year, reference.month, reference.day);
    DateTime? due;

    if (token == '今天') {
      due = today;
    } else if (token == '明天') {
      due = DateTime(today.year, today.month, today.day + 1);
    } else if (token == '后天') {
      due = DateTime(today.year, today.month, today.day + 2);
    } else if (token.startsWith('下周') || token.startsWith('周')) {
      final char = token.substring(token.length - 1);
      final target = const {
        '一': 1, '二': 2, '三': 3, '四': 4,
        '五': 5, '六': 6, '日': 7, '天': 7,
      }[char];
      if (target == null) return null;
      final days = token.startsWith('下周')
          ? 7 - today.weekday + target
          : (target - today.weekday + 7) % 7;
      due = DateTime(today.year, today.month, today.day + days);
    } else {
      final y = int.tryParse(token.substring(0, 4));
      final m = int.tryParse(token.substring(5, 7));
      final d = int.tryParse(token.substring(8, 10));
      if (y == null || m == null || d == null ||
          y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) {
        return null;
      }
      final parsed = DateTime(y, m, d);
      if (parsed.year != y || parsed.month != m || parsed.day != d) {
        return null;
      }
      due = parsed;
    }

    return QuickTaskDateSuggestion(
      date: due,
      label: '$token · ${due.month}月${due.day}日',
      title: text,
      start: match.start,
      end: match.end,
    );
  }
}
