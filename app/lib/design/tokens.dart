import 'package:flutter/widgets.dart';

/// HAIZ 2.0 "纸面与朱批" (paper and red-pen) tokens.
///
/// The interface is ink on paper. One signal colour — vermilion, the colour
/// of a teacher's correction pen — marks only what needs attention now: the
/// current class, the present time, overdue work and the completion tick.
/// Everything else is carried by type, spacing and hairlines.
@immutable
class HaizColors {
  const HaizColors({
    required this.dark,
    required this.canvas,
    required this.surface,
    required this.raised,
    required this.ink,
    required this.ink2,
    required this.ink3,
    required this.rule,
    required this.ruleStrong,
    required this.signal,
    required this.amber,
    required this.green,
    required this.inverse,
    required this.onInverse,
  });

  final bool dark;

  /// Page background.
  final Color canvas;

  /// Sheets, editors, the tab bar when content scrolls beneath it.
  final Color surface;

  /// Pressed rows, input fill, quiet fills.
  final Color raised;

  /// Primary text and primary actions.
  final Color ink;

  /// Secondary text.
  final Color ink2;

  /// Tertiary text, placeholders, disabled.
  final Color ink3;

  /// Hairlines.
  final Color rule;
  final Color ruleStrong;

  /// 朱 — now, overdue, completion tick. Never decoration.
  final Color signal;

  /// Needs confirmation (unclear OCR date, pending review).
  final Color amber;

  /// Confirmed / saved.
  final Color green;

  /// Filled primary buttons and toasts.
  final Color inverse;
  final Color onInverse;

  Color get signalSoft => signal.withValues(alpha: dark ? .16 : .09);
  Color get amberSoft => amber.withValues(alpha: dark ? .18 : .11);

  static const light = HaizColors(
    dark: false,
    canvas: Color(0xFFF6F4EF),
    surface: Color(0xFFFDFCF9),
    raised: Color(0xFFECE9E1),
    ink: Color(0xFF17181A),
    ink2: Color(0xFF55595F),
    ink3: Color(0xFF8C9095),
    rule: Color(0xFFE2DED3),
    ruleStrong: Color(0xFFCBC5B8),
    signal: Color(0xFFD13C20),
    amber: Color(0xFF9C6410),
    green: Color(0xFF2E7653),
    inverse: Color(0xFF17181A),
    onInverse: Color(0xFFF6F4EF),
  );

  /// 晚自习 — warm graphite, not blue-black, so long evening use stays calm.
  static const night = HaizColors(
    dark: true,
    canvas: Color(0xFF121314),
    surface: Color(0xFF1B1C1E),
    raised: Color(0xFF26282B),
    ink: Color(0xFFECEAE5),
    ink2: Color(0xFFA4A6A9),
    ink3: Color(0xFF6E7175),
    rule: Color(0xFF2B2D30),
    ruleStrong: Color(0xFF3B3E42),
    signal: Color(0xFFFF6B4F),
    amber: Color(0xFFE2A445),
    green: Color(0xFF6DBB8E),
    inverse: Color(0xFFECEAE5),
    onInverse: Color(0xFF121314),
  );
}

/// Low-chroma subject hues for timetable blocks and the small subject mark.
/// They identify, they never shout: blocks use them at ~12 % behind ink text.
Color subjectColor(String subject, {required bool dark}) {
  const light = <String, int>{
    '数学': 0xFF3C5B85,
    '语文': 0xFF9A5530,
    '英语': 0xFF22827B,
    '物理': 0xFF5A4FA2,
    '化学': 0xFF4C7A35,
    '生物': 0xFF7A8C25,
    '历史': 0xFF8B5B43,
    '地理': 0xFF2C6E98,
    '政治': 0xFF8F4467,
    '体育': 0xFFB97716,
    '信息': 0xFF4A6872,
    '通用': 0xFF6A6F55,
  };
  const night = <String, int>{
    '数学': 0xFF86A6D6,
    '语文': 0xFFD99A72,
    '英语': 0xFF6CC4BB,
    '物理': 0xFFA79CEB,
    '化学': 0xFF95C47A,
    '生物': 0xFFC0CF6A,
    '历史': 0xFFCF9C82,
    '地理': 0xFF7DB5DC,
    '政治': 0xFFD98BAE,
    '体育': 0xFFE7B45A,
    '信息': 0xFF92B2BC,
    '通用': 0xFFB5B994,
  };
  final table = dark ? night : light;
  for (final entry in table.entries) {
    if (subject.contains(entry.key)) return Color(entry.value);
  }
  return dark ? const Color(0xFF9A9DA1) : const Color(0xFF74777C);
}

/// Spacing on a 4 pt grid. Page gutters are 20; rows breathe at 12–14.
abstract final class Space {
  static const double x1 = 4;
  static const double x2 = 8;
  static const double x3 = 12;
  static const double x4 = 16;
  static const double gutter = 20;
  static const double x6 = 24;
  static const double x8 = 32;
  static const double x10 = 40;
}

/// Corner radii are deliberately different per role, not one radius
/// everywhere: small controls 8, blocks 6, sheets 20.
abstract final class Radii {
  static const double block = 6;
  static const double control = 10;
  static const double chip = 8;
  static const double panel = 14;
  static const double sheet = 20;
}

/// Motion durations. All collapse to zero when the system asks for
/// reduced motion; state still changes immediately.
abstract final class Motion {
  static const press = Duration(milliseconds: 90);
  static const fast = Duration(milliseconds: 150);
  static const base = Duration(milliseconds: 220);
  static const slow = Duration(milliseconds: 320);

  /// How long a just-completed task stays visible before it leaves the list.
  static const completionHold = Duration(milliseconds: 900);

  /// Decelerate strongly: content arrives quickly and settles softly.
  static const Curve enter = Cubic(0.2, 0.0, 0.0, 1.0);
  static const Curve exit = Cubic(0.3, 0.0, 0.8, 0.15);
  static const Curve standard = Curves.easeOutCubic;
}

/// Type scale for Chinese-first UI. Sizes stay whole pixels for crisp CJK
/// rendering; numbers that change in place use tabular figures.
abstract final class TypeScale {
  static const tabular = [FontFeature.tabularFigures()];

  static TextStyle largeTitle(Color c) => TextStyle(
    fontSize: 28, height: 1.22, fontWeight: FontWeight.w700,
    letterSpacing: -0.4, color: c, fontFeatures: tabular);
  static TextStyle title(Color c) => TextStyle(
    fontSize: 20, height: 1.3, fontWeight: FontWeight.w700,
    letterSpacing: -0.2, color: c);
  static TextStyle headline(Color c) => TextStyle(
    fontSize: 17, height: 1.35, fontWeight: FontWeight.w600, color: c);
  static TextStyle body(Color c) =>
      TextStyle(fontSize: 16, height: 1.4, fontWeight: FontWeight.w400, color: c);
  static TextStyle callout(Color c) =>
      TextStyle(fontSize: 15, height: 1.4, fontWeight: FontWeight.w400, color: c);
  static TextStyle footnote(Color c) => TextStyle(
    fontSize: 13, height: 1.38, fontWeight: FontWeight.w400, color: c,
    fontFeatures: tabular);
  static TextStyle label(Color c) => TextStyle(
    fontSize: 13, height: 1.3, fontWeight: FontWeight.w600, color: c,
    fontFeatures: tabular);
  static TextStyle caption(Color c) => TextStyle(
    fontSize: 12, height: 1.33, fontWeight: FontWeight.w400, color: c,
    fontFeatures: tabular);
  static TextStyle micro(Color c) => TextStyle(
    fontSize: 11, height: 1.27, fontWeight: FontWeight.w500, color: c,
    fontFeatures: tabular);
}
