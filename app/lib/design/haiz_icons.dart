import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// HAIZ's own line icons, drawn on a 24-unit grid with one stroke weight and
/// round ends, so navigation reads as one family with the red-pen tick
/// rather than a mix of Material glyphs. [active] thickens the stroke and
/// fills the glyph's key shape; it never changes colour by itself.
enum HaizGlyph { today, tasks, schedule, inbox, me, plus, search, focus, close, chevronDown, pause, play }

class HaizIcon extends StatelessWidget {
  const HaizIcon(this.glyph, {super.key, this.size = 24, required this.color, this.active = false, this.semanticLabel});
  final HaizGlyph glyph;
  final double size;
  final Color color;
  final bool active;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) => Semantics(
    label: semanticLabel,
    excludeSemantics: semanticLabel == null,
    child: CustomPaint(size: Size.square(size), painter: _GlyphPainter(glyph, color, active)),
  );
}

class _GlyphPainter extends CustomPainter {
  _GlyphPainter(this.glyph, this.color, this.active);
  final HaizGlyph glyph;
  final Color color;
  final bool active;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = active ? 2.0 : 1.6
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()..color = color;
    switch (glyph) {
      case HaizGlyph.today:
        // Sunrise over the horizon: the day starting.
        final sun = Rect.fromCircle(center: const Offset(12, 15), radius: 5.2);
        if (active) {
          canvas.drawArc(sun, math.pi, math.pi, true, fill);
        } else {
          canvas.drawArc(sun, math.pi, math.pi, false, stroke);
        }
        canvas.drawLine(const Offset(3.5, 15), const Offset(20.5, 15), stroke);
        canvas.drawLine(const Offset(7, 19), const Offset(17, 19), stroke);
        for (final a in [-150.0, -90.0, -30.0]) {
          final r = a * math.pi / 180;
          canvas.drawLine(Offset(12 + 7.3 * math.cos(r), 15 + 7.3 * math.sin(r)),
              Offset(12 + 8.8 * math.cos(r), 15 + 8.8 * math.sin(r)), stroke);
        }
      case HaizGlyph.tasks:
        // A tick that overshoots its box, like the completion mark.
        final box = RRect.fromRectAndRadius(const Rect.fromLTWH(4, 5, 14, 14), const Radius.circular(4));
        final tick = _tick();
        if (active) {
          canvas.saveLayer(const Rect.fromLTWH(0, 0, 24, 24), Paint());
          canvas.drawRRect(box, fill);
          canvas.drawPath(tick, Paint()
            ..blendMode = BlendMode.clear
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.2
            ..strokeCap = StrokeCap.round);
          canvas.restore();
          canvas.save();
          canvas.clipPath(Path.combine(PathOperation.difference,
              Path()..addRect(const Rect.fromLTWH(0, 0, 24, 24)), Path()..addRRect(box)));
          canvas.drawPath(tick, stroke);
          canvas.restore();
        } else {
          canvas.drawRRect(box, stroke);
          canvas.drawPath(tick, stroke);
        }
      case HaizGlyph.schedule:
        // A timetable: columns of periods.
        final frame = RRect.fromRectAndRadius(const Rect.fromLTWH(3.5, 4.5, 17, 15.5), const Radius.circular(3.5));
        canvas.drawRRect(frame, stroke);
        canvas.drawLine(const Offset(3.5, 9), const Offset(20.5, 9), stroke);
        canvas.drawLine(const Offset(9.2, 9), const Offset(9.2, 20), stroke..strokeWidth = active ? 1.6 : 1.2);
        canvas.drawLine(const Offset(14.8, 9), const Offset(14.8, 20), stroke);
        stroke.strokeWidth = active ? 2.0 : 1.6;
        if (active) canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(10.4, 10.4, 3.2, 3.6), const Radius.circular(1)), fill);
      case HaizGlyph.inbox:
        // A tray receiving: arrow down into an open tray.
        final tray = Path()
          ..moveTo(3.5, 13)
          ..lineTo(3.5, 18.5)
          ..quadraticBezierTo(3.5, 20, 5, 20)
          ..lineTo(19, 20)
          ..quadraticBezierTo(20.5, 20, 20.5, 18.5)
          ..lineTo(20.5, 13);
        canvas.drawPath(tray, stroke);
        final lip = Path()..moveTo(3.5, 13)..lineTo(8, 13)..quadraticBezierTo(9, 16, 12, 16)..quadraticBezierTo(15, 16, 16, 13)..lineTo(20.5, 13);
        if (active) {
          canvas.drawPath(Path.from(lip)..lineTo(20.5, 18.5)..quadraticBezierTo(20.5, 20, 19, 20)..lineTo(5, 20)
              ..quadraticBezierTo(3.5, 20, 3.5, 18.5)..close(), fill);
        }
        canvas.drawPath(lip, stroke);
        canvas.drawLine(const Offset(12, 3.5), const Offset(12, 10.5), stroke);
        canvas.drawPath(Path()..moveTo(9, 7.8)..lineTo(12, 10.8)..lineTo(15, 7.8), stroke);
      case HaizGlyph.me:
        final head = Rect.fromCircle(center: const Offset(12, 8.5), radius: 3.6);
        active ? canvas.drawOval(head, fill) : canvas.drawOval(head, stroke);
        final body = Path()..moveTo(5, 20)..quadraticBezierTo(5.6, 13.6, 12, 13.6)..quadraticBezierTo(18.4, 13.6, 19, 20);
        canvas.drawPath(body, stroke);
      case HaizGlyph.plus:
        canvas.drawLine(const Offset(12, 5), const Offset(12, 19), stroke);
        canvas.drawLine(const Offset(5, 12), const Offset(19, 12), stroke);
      case HaizGlyph.search:
        canvas.drawCircle(const Offset(10.5, 10.5), 6, stroke);
        canvas.drawLine(const Offset(15, 15), const Offset(19.5, 19.5), stroke);
      case HaizGlyph.focus:
        // An hourglass-free timer: a dial with one hand and a crown.
        canvas.drawCircle(const Offset(12, 13), 7.2, stroke);
        canvas.drawLine(const Offset(12, 13), const Offset(12, 9), stroke);
        canvas.drawLine(const Offset(12, 13), const Offset(14.6, 14.6), stroke);
        canvas.drawLine(const Offset(10, 3.6), const Offset(14, 3.6), stroke);
      case HaizGlyph.close:
        canvas.drawLine(const Offset(6.5, 6.5), const Offset(17.5, 17.5), stroke);
        canvas.drawLine(const Offset(17.5, 6.5), const Offset(6.5, 17.5), stroke);
      case HaizGlyph.chevronDown:
        canvas.drawPath(Path()..moveTo(6, 9.5)..lineTo(12, 15.5)..lineTo(18, 9.5), stroke);
      case HaizGlyph.pause:
        canvas.drawLine(const Offset(9, 6.5), const Offset(9, 17.5), stroke..strokeWidth = 2.2);
        canvas.drawLine(const Offset(15, 6.5), const Offset(15, 17.5), stroke);
      case HaizGlyph.play:
        canvas.drawPath(Path()..moveTo(8.5, 6)..lineTo(18, 12)..lineTo(8.5, 18)..close(), fill);
    }
  }

  Path _tick() => Path()
    ..moveTo(7.2, 12.2)
    ..quadraticBezierTo(9, 13.8, 10.3, 15.8)
    ..quadraticBezierTo(13.5, 9.5, 20.5, 4.2);

  @override
  bool shouldRepaint(_GlyphPainter old) => old.glyph != glyph || old.color != color || old.active != active;
}
