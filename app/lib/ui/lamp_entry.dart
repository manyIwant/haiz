import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// HAIZ Pocket's native Flutter interpretation of the Aceternity Lamp.
/// This is a local workspace welcome screen, NOT account authentication.
class LampEntry extends StatefulWidget {
  const LampEntry({super.key, required this.onEnter});

  final VoidCallback onEnter;

  @override
  State<LampEntry> createState() => _LampEntryState();
}

class _LampEntryState extends State<LampEntry>
    with SingleTickerProviderStateMixin {
  late final AnimationController _light = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _light.value = 1;
      _light.stop();
    } else if (_light.value == 0 && !_light.isAnimating) {
      _light.forward();
    }
  }

  @override
  void dispose() {
    _light.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.of(context).disableAnimations;
    return Scaffold(
      backgroundColor: const Color(0xFF030E18),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final heroHeight =
                (constraints.maxHeight * .41).clamp(258.0, 370.0);
            return AnimatedBuilder(
              animation: _light,
              builder: (context, _) {
                final beam = Curves.easeOutCubic.transform(
                  (_light.value / .72).clamp(0.0, 1.0),
                );
                final reveal = Curves.easeOutCubic.transform(
                  ((_light.value - .25) / .66).clamp(0.0, 1.0),
                );
                final enter = Curves.easeOutCubic.transform(
                  ((_light.value - .42) / .58).clamp(0.0, 1.0),
                );
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Color(0xFF051725),
                            Color(0xFF06131F),
                            Color(0xFF030E18),
                          ],
                        ),
                      ),
                    ),
                    SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(
                        20,
                        4,
                        20,
                        math.max(22, MediaQuery.of(context).padding.bottom),
                      ),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 500),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox(
                                height: heroHeight,
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    RepaintBoundary(
                                      child: CustomPaint(
                                        key: const Key('lamp-converging-beams'),
                                        painter: _LampPainter(progress: beam),
                                      ),
                                    ),
                                    Positioned(
                                      top: heroHeight * .59,
                                      left: 0,
                                      right: 0,
                                      child: Opacity(
                                        opacity: reveal,
                                        child: Transform.translate(
                                          offset: Offset(0, (1 - reveal) * 18),
                                          child: Column(
                                            children: [
                                              const Text(
                                                'HAIZ',
                                                textAlign: TextAlign.center,
                                                style: TextStyle(
                                                  color: Color(0xFFF0FDFF),
                                                  fontSize: 48,
                                                  fontWeight: FontWeight.w300,
                                                  letterSpacing: 12,
                                                  height: 1.15,
                                                ),
                                              ),
                                              const SizedBox(height: 12),
                                              const Text(
                                                'P O C K E T   /   C A M P U S',
                                                textAlign: TextAlign.center,
                                                style: TextStyle(
                                                  color: Color(0xFF9EBCC6),
                                                  fontSize: 10,
                                                  letterSpacing: 1,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 8),
                              Opacity(
                                opacity: enter,
                                child: Transform.translate(
                                  offset: Offset(0, (1 - enter) * 20),
                                  child: Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.fromLTRB(
                                      25, 27, 25, 23,
                                    ),
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                        colors: [
                                          Color(0xE01B3443),
                                          Color(0xE00C1E2C),
                                        ],
                                      ),
                                      border: Border.all(
                                        color: const Color(0x446DA9B7),
                                        width: 1,
                                      ),
                                      borderRadius: BorderRadius.circular(26),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        const Align(
                                          alignment: Alignment.centerLeft,
                                          child: Text(
                                            'HAIZ  /  本机空间',
                                            style: TextStyle(
                                              color: Color(0xFF90CED6),
                                              fontSize: 10,
                                              letterSpacing: 2,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 18),
                                        const Text(
                                          '欢迎回来',
                                          style: TextStyle(
                                            color: Color(0xFFF0FAFC),
                                            fontSize: 26,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        const Text(
                                          '你的课表、待办与校园空间，\n从这里开始。',
                                          style: TextStyle(
                                            color: Color(0xFFB4CAD2),
                                            fontSize: 14,
                                            height: 1.65,
                                          ),
                                        ),
                                        const SizedBox(height: 25),
                                        FilledButton(
                                          key: const Key('lamp-enter-guest'),
                                          onPressed: widget.onEnter,
                                          style: FilledButton.styleFrom(
                                            backgroundColor:
                                                const Color(0xFFC4F0ED),
                                            foregroundColor:
                                                const Color(0xFF082630),
                                            minimumSize:
                                                const Size.fromHeight(54),
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(15),
                                            ),
                                          ),
                                          child: const Text(
                                            '进入本机空间  →',
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                        const Text(
                                          '仅打开此设备的访客数据 · 无账号验证或云端同步',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            color: Color(0xFF95B5BE),
                                            fontSize: 11,
                                            height: 1.5,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 22),
                              Opacity(
                                opacity: enter,
                                child: const Text(
                                  'A QUIETER WAY TO STAY CONNECTED',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: Color(0xFF6F98A6),
                                    fontSize: 9,
                                    letterSpacing: 1.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// Two tapered, animated cones converge into a bright cyan light bar.
/// All layers are drawn with simple gradients: no image downloads, backdrop
/// filters, third-party shaders or continuous frame timers.
class _LampPainter extends CustomPainter {
  const _LampPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0 || size.isEmpty) return;

    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final sourceY = h * .46;
    final topY = h * .035;
    final p = progress;
    final extent = w * (.11 + .39 * p);
    final beamOpacity = p;

    // Atmosphere: a cool, soft oval underneath the point of convergence.
    final atmosphere = Rect.fromCenter(
      center: Offset(cx, sourceY + h * .025),
      width: w * 1.22,
      height: h * .62,
    );
    canvas.drawRect(
      atmosphere,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(0, -.08),
          radius: .72,
          colors: [
            Color(0x995AD8E6),
            Color(0x5547AFCC),
            Color(0x124B9CAA),
            Color(0x004B9CAA),
          ],
          stops: [0, .19, .52, 1],
        ).createShader(atmosphere)
        ..colorFilter = ColorFilter.mode(
          Colors.white.withValues(alpha: beamOpacity),
          BlendMode.modulate,
        ),
    );

    for (final left in [true, false]) {
      final sign = left ? -1.0 : 1.0;
      final tipX = cx + sign * w * .035;
      final farX = cx + sign * extent;
      final nearX = cx + sign * (extent * .39);
      final softPath = Path()
        ..moveTo(tipX, sourceY + 4)
        ..lineTo(farX, topY)
        ..lineTo(nearX, topY)
        ..lineTo(cx, sourceY - 2)
        ..close();
      final color = left
          ? const Color(0xAA4FC9E7)
          : const Color(0xA65DD7D6);
      canvas.drawPath(
        softPath,
        Paint()
          ..shader = ui.Gradient.linear(
            Offset(cx, sourceY),
            Offset(farX, topY),
            [
              color.withValues(alpha: .69 * p),
              color.withValues(alpha: .43 * p),
              color.withValues(alpha: 0),
            ],
            const [0, .42, 1],
          ),
      );

      // More concentrated inner cones form the recognizable lamp geometry.
      final innerPath = Path()
        ..moveTo(cx, sourceY + 1.5)
        ..lineTo(cx + sign * extent * .78, topY + h * .05)
        ..lineTo(cx + sign * extent * .52, topY + h * .05)
        ..lineTo(cx + sign * w * .016, sourceY - 1)
        ..close();
      canvas.drawPath(
        innerPath,
        Paint()
          ..shader = ui.Gradient.linear(
            Offset(cx, sourceY),
            Offset(cx + sign * extent * .78, topY),
            [
              const Color(0xB7B7FFFF).withValues(alpha: .66 * p),
              const Color(0x8856E9E9).withValues(alpha: .42 * p),
              const Color(0x0065DFEC),
            ],
            const [0, .48, 1],
          ),
      );
    }

    // Concentrated horizontal emitter: wide halo + sharp 2px light bar.
    for (final (thickness, opacity) in [
      (29.0, .08),
      (15.0, .18),
      (6.0, .42),
      (2.0, .94),
    ]) {
      final halfLength = w * (.075 + .36 * p);
      canvas.drawLine(
        Offset(cx - halfLength, sourceY),
        Offset(cx + halfLength, sourceY),
        Paint()
          ..strokeWidth = thickness
          ..shader = ui.Gradient.linear(
            Offset(cx - halfLength, sourceY),
            Offset(cx + halfLength, sourceY),
            [
              const Color(0x0091EFF4),
              const Color(0xFFB8FFFF).withValues(alpha: opacity * p),
              const Color(0x0091EFF4),
            ],
            const [0.0, 0.5, 1.0],
          ),
      );
    }
    final core = Rect.fromCenter(
      center: Offset(cx, sourceY),
      width: math.min(w * .42, 210),
      height: h * .20,
    );
    canvas.drawOval(
      core,
      Paint()
        ..shader = RadialGradient(
          colors: [
            const Color(0xCCCEFFFF).withValues(alpha: .4 * p),
            const Color(0x4452DAE7).withValues(alpha: .20 * p),
            const Color(0x0052DAE7),
          ],
        ).createShader(core),
    );
  }

  @override
  bool shouldRepaint(covariant _LampPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
