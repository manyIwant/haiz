import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Live optical transmission is available only on Flutter's Impeller backend.
/// In addition to the GPU path, [OpticalGlassSheen] gives both the Impeller
/// and the blur fallback a readable physical rim and specular reflections.
class OpticalBackdrop extends StatelessWidget {
  const OpticalBackdrop({super.key, required this.child, required this.dark});

  final Widget child;
  final bool dark;

  static final Future<ui.FragmentProgram?> _program =
      ui.FragmentProgram.fromAsset('shaders/haiz_optical.frag')
          .then<ui.FragmentProgram?>((program) => program)
          .catchError((Object _) => null);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ui.FragmentProgram?>(
      future: _program,
      builder: (context, snapshot) {
        // The first vec2 and sampler are bound by Flutter's compositor,
        // not by Dart. Only the third float (dark theme) is ours.
        ui.ImageFilter filter = ui.ImageFilter.blur(
          sigmaX: 13,
          sigmaY: 13,
          tileMode: TileMode.clamp,
        );
        if (ui.ImageFilter.isShaderFilterSupported && snapshot.hasData) {
          try {
            final shader = snapshot.data!.fragmentShader();
            shader.setFloat(2, dark ? 1.0 : 0.0);
            filter = ui.ImageFilter.shader(shader);
          } catch (_) {
            // Do not crash on drivers without a usable custom shader.
            // The lens rim and glaze remain visible without Impeller.
          }
        }
        return BackdropFilter(filter: filter, child: child);
      },
    );
  }
}

/// Painted surface reflections independent of platform shader support.
/// Highlights are shaped to a curved optical lens, not generic white strokes.
class OpticalGlassSheen extends StatelessWidget {
  const OpticalGlassSheen({
    super.key,
    required this.dark,
    this.selected = false,
    this.radius = 29,
  });

  final bool dark;
  final bool selected;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _LensSheenPainter(
            dark: dark,
            selected: selected,
            radius: radius,
          ),
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}

class _LensSheenPainter extends CustomPainter {
  const _LensSheenPainter({
    required this.dark,
    required this.selected,
    required this.radius,
  });

  final bool dark;
  final bool selected;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width < 4 || size.height < 4) return;
    final bounds = Offset.zero & size;
    final r = radius.clamp(2.0, size.shortestSide * 0.5);
    final shape = RRect.fromRectAndRadius(bounds, Radius.circular(r));

    canvas.save();
    canvas.clipRRect(shape);

    // Large grazing reflection across the upper-left half. Subtle enough
    // to remain legible over both dark photographic and light page content.
    final glow = RadialGradient(
      center: selected
          ? const Alignment(-0.4, -1.2)
          : const Alignment(-0.63, -1.25),
      radius: selected ? 1.1 : 1.36,
      colors: [
        Colors.white.withValues(alpha: dark ? 0.27 : 0.43),
        Colors.white.withValues(alpha: dark ? 0.085 : 0.13),
        Colors.white.withValues(alpha: 0.0),
      ],
      stops: const [0.0, 0.46, 1.0],
    );
    canvas.drawRect(bounds, Paint()..shader = glow.createShader(bounds));

    final lowerGlow = LinearGradient(
      begin: Alignment.bottomLeft,
      end: Alignment.topRight,
      colors: [
        Colors.white.withValues(alpha: dark ? 0.10 : 0.18),
        Colors.transparent,
        Colors.black.withValues(alpha: dark ? 0.08 : 0.04),
      ],
      stops: const [0, 0.55, 1],
    );
    canvas.drawRect(bounds, Paint()..shader = lowerGlow.createShader(bounds));

    canvas.restore();

    // Rim continuity and a thinner offset inner edge imply thickness.
    final edge = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Colors.white.withValues(alpha: dark ? 0.68 : 0.98),
        Colors.white.withValues(alpha: dark ? 0.24 : 0.60),
        Colors.black.withValues(alpha: dark ? 0.20 : 0.12),
        Colors.white.withValues(alpha: dark ? 0.33 : 0.82),
      ],
      stops: const [0.0, 0.28, 0.75, 1.0],
    );
    canvas.drawRRect(
      shape.deflate(0.9),
      Paint()
        ..shader = edge.createShader(bounds)
        ..style = PaintingStyle.stroke
        ..strokeWidth = selected ? 1.25 : 1.7,
    );
    canvas.drawRRect(
      shape.deflate(3.0),
      Paint()
        ..color = Colors.white.withValues(
          alpha: selected ? (dark ? 0.21 : 0.37) : (dark ? 0.15 : 0.21),
        )
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.65,
    );

    // A soft elongated caustic along the front top surface.
    final streak = Path()
      ..moveTo(r * 1.1, 3.0)
      ..quadraticBezierTo(
        size.width * 0.34,
        1.8,
        size.width * (selected ? 0.66 : 0.56),
        3.4,
      );
    canvas.drawPath(
      streak,
      Paint()
        ..shader = const LinearGradient(
          colors: [Colors.white, Color(0xBDFFFFFF), Color(0x00FFFFFF)],
          stops: [0.0, 0.34, 1.0],
        ).createShader(bounds)
        ..style = PaintingStyle.stroke
        ..strokeWidth = selected ? 1.5 : 1.7
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_LensSheenPainter oldDelegate) =>
      dark != oldDelegate.dark ||
      selected != oldDelegate.selected ||
      radius != oldDelegate.radius;
}
