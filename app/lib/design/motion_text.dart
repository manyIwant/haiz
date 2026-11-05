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
        final start = direction == HeroFlightDirection.push ? a : b;
        final end = direction == HeroFlightDirection.push ? b : a;
        return AnimatedBuilder(
          animation: animation,
          builder: (context, _) {
            final t = direction == HeroFlightDirection.push ? animation.value : 1 - animation.value;
            return Material(
              type: MaterialType.transparency,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(text, maxLines: 1, style: TextStyle.lerp(start, end, Curves.easeInOutCubic.transform(t))),
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
