import 'package:flutter/material.dart';

import 'theme.dart';

/// A text shared between two routes (a task title that becomes the focus
/// title, a clock that shrinks into the focus capsule). During the flight
/// the style is interpolated, so size and weight change continuously
/// instead of jumping at either end.
class HeroText extends StatelessWidget {
  const HeroText({
    super.key,
    required this.tag,
    required this.text,
    required this.style,
    this.maxLines = 1,
    this.textAlign = TextAlign.start,
    this.enabled = true,
  });

  final Object tag;
  final String text;
  final TextStyle style;
  final int maxLines;
  final TextAlign textAlign;
  final bool enabled;

  Widget _label(TextStyle s) => Text(text, style: s, maxLines: maxLines,
      overflow: TextOverflow.ellipsis, textAlign: textAlign, softWrap: maxLines > 1);

  @override
  Widget build(BuildContext context) {
    if (!enabled || HaizTheme.of(context).reduceMotion) return _label(style);
    return Hero(
      tag: tag,
      transitionOnUserGestures: true,
      flightShuttleBuilder: (context, animation, direction, fromContext, toContext) {
        final from = (fromContext.widget as Hero).child;
        final to = (toContext.widget as Hero).child;
        final a = from is _HeroLabel ? from.style : style;
        final b = to is _HeroLabel ? to.style : style;
        // In both directions the flight starts at the `from` hero (on pop:
        // the route being closed) and ends at `to`. The route animation runs
        // 0→1 on push and 1→0 on pop, so progress is flipped for pop.
        // Line count and alignment are the destination's, so the text
        // settles without re-wrapping on the last frame.
        final lines = to is _HeroLabel ? to.maxLines : maxLines;
        final align = to is _HeroLabel ? to.textAlign : textAlign;
        return AnimatedBuilder(
          animation: animation,
          builder: (context, _) {
            final t = direction == HeroFlightDirection.push ? animation.value : 1 - animation.value;
            // Truncate to the flight rect's width (never spill into a
            // neighbour such as the capsule clock); scale only if the
            // interpolated line height would overflow the rect.
            return LayoutBuilder(
              builder: (context, box) => Material(
                type: MaterialType.transparency,
                child: ClipRect(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: align == TextAlign.center ? Alignment.center : Alignment.centerLeft,
                    child: SizedBox(
                      width: box.maxWidth,
                      child: Text(text, maxLines: lines, softWrap: lines > 1, overflow: TextOverflow.ellipsis,
                          textAlign: align, style: TextStyle.lerp(a, b, Curves.easeInOutCubic.transform(t))),
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
      child: _HeroLabel(text: text, style: style, maxLines: maxLines, textAlign: textAlign),
    );
  }
}

class _HeroLabel extends StatelessWidget {
  const _HeroLabel({required this.text, required this.style, required this.maxLines, required this.textAlign});
  final String text;
  final TextStyle style;
  final int maxLines;
  final TextAlign textAlign;
  @override
  Widget build(BuildContext context) => Material(
    type: MaterialType.transparency,
    child: Text(text, style: style, maxLines: maxLines, overflow: TextOverflow.ellipsis, textAlign: textAlign,
        softWrap: maxLines > 1),
  );
}
