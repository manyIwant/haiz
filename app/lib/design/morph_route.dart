import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import 'theme.dart';
import 'tokens.dart';

/// A sheet that grows out of the control that opened it: its outline,
/// corner radius and colour interpolate from the source rectangle (for
/// example the smoked "+" button) to the sheet, and contract back into it
/// on close. The content fades in only once the shape is mostly formed, so
/// text never appears squashed.
Future<T?> showMorphSheet<T>(BuildContext context, {required Rect origin, required WidgetBuilder builder,
    Color? originColor, double originRadius = 18}) {
  final c = context.c;
  return Navigator.of(context).push<T>(_MorphSheetRoute<T>(
    origin: origin,
    builder: builder,
    originColor: originColor ?? c.inverse,
    surface: c.surface,
    barrier: Colors.black.withValues(alpha: c.dark ? .45 : .22),
    originRadius: originRadius,
    reduce: HaizTheme.of(context).reduceMotion,
  ));
}

class _MorphSheetRoute<T> extends PopupRoute<T> {
  _MorphSheetRoute({
    required this.origin,
    required this.builder,
    required this.originColor,
    required this.surface,
    required this.barrier,
    required this.originRadius,
    required this.reduce,
  });

  final Rect origin;
  final WidgetBuilder builder;
  final Color originColor;
  final Color surface;
  final Color barrier;
  final double originRadius;
  final bool reduce;

  @override
  Color? get barrierColor => barrier;
  @override
  bool get barrierDismissible => true;
  @override
  String? get barrierLabel => '关闭';
  @override
  Duration get transitionDuration => reduce ? Duration.zero : const Duration(milliseconds: 420);
  @override
  Duration get reverseTransitionDuration => reduce ? Duration.zero : const Duration(milliseconds: 300);

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondary) {
    return _MorphSheet(
      animation: animation,
      origin: origin,
      originColor: originColor,
      surface: surface,
      originRadius: originRadius,
      onDismiss: () => Navigator.of(context).maybePop(),
      child: Builder(builder: builder),
    );
  }
}

class _MorphSheet extends StatefulWidget {
  const _MorphSheet({
    required this.animation,
    required this.origin,
    required this.originColor,
    required this.surface,
    required this.originRadius,
    required this.onDismiss,
    required this.child,
  });

  final Animation<double> animation;
  final Rect origin;
  final Color originColor;
  final Color surface;
  final double originRadius;
  final VoidCallback onDismiss;
  final Widget child;

  @override
  State<_MorphSheet> createState() => _MorphSheetState();
}

class _MorphSheetState extends State<_MorphSheet> {
  final _box = GlobalKey();
  double _drag = 0;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 640, maxHeight: media.size.height * .92),
        child: Padding(
          padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
          child: Transform.translate(
            offset: Offset(0, _drag),
            child: AnimatedBuilder(
              animation: widget.animation,
              builder: (context, child) {
                final forward = widget.animation.status != AnimationStatus.reverse;
                final t = (forward ? Motion.enter : Motion.exit).transform(widget.animation.value);
                return ClipPath(
                  clipper: _MorphClip(t: t, origin: widget.origin, box: _box, originRadius: widget.originRadius),
                  child: ColoredBox(
                    color: Color.lerp(widget.originColor, widget.surface, (t * 1.6).clamp(0.0, 1.0))!,
                    child: Opacity(opacity: ((t - 0.45) / 0.55).clamp(0.0, 1.0), child: child),
                  ),
                );
              },
              child: Column(
                key: _box,
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onVerticalDragUpdate: (d) => setState(() => _drag = (_drag + d.delta.dy).clamp(0.0, 400.0)),
                    onVerticalDragEnd: (d) {
                      if (_drag > 90 || (d.primaryVelocity ?? 0) > 700) {
                        widget.onDismiss();
                      } else {
                        setState(() => _drag = 0);
                      }
                    },
                    child: SizedBox(
                      height: 26,
                      child: Center(
                        child: Container(width: 36, height: 4, decoration: BoxDecoration(
                            color: context.c.ruleStrong, borderRadius: BorderRadius.circular(2))),
                      ),
                    ),
                  ),
                  SafeArea(top: false, child: Material(type: MaterialType.transparency, child: widget.child)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MorphClip extends CustomClipper<Path> {
  _MorphClip({required this.t, required this.origin, required this.box, required this.originRadius});
  final double t;
  final Rect origin;
  final GlobalKey box;
  final double originRadius;

  @override
  Path getClip(Size size) {
    final target = Offset.zero & size;
    final render = box.currentContext?.findRenderObject() as RenderBox?;
    final at = render != null && render.hasSize ? render.localToGlobal(Offset.zero) : Offset.zero;
    final start = origin.shift(-at);
    final rect = Rect.lerp(start, target, t)!;
    final r = lerpDouble(originRadius, Radii.sheet, t)!;
    final bottom = lerpDouble(originRadius, 0, t)!;
    return Path()..addRRect(RRect.fromRectAndCorners(rect,
        topLeft: Radius.circular(r), topRight: Radius.circular(r),
        bottomLeft: Radius.circular(bottom), bottomRight: Radius.circular(bottom)));
  }

  @override
  bool shouldReclip(_MorphClip old) => old.t != t || old.origin != origin;
}
