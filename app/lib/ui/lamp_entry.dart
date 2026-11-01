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
    return Scaffold(
      backgroundColor: const Color(0xFF0A0908),
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
                            Color(0xFF120F0B),
                            Color(0xFF100D09),
                            Color(0xFF0A0908),
                          ],
                        ),
                      ),
                    ),
                    // Light spans the viewport, not the 500px reading column.
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      height: heroHeight + 4,
                      child: IgnorePointer(
                        child: RepaintBoundary(
                          child: CustomPaint(
                            key: const Key('lamp-converging-beams'),
                            painter: _LampPainter(progress: beam),
                          ),
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
                                                  color: Color(0xFFFFFAF1),
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
                                                  color: Color(0xFFC5B494),
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
                                          Color(0xE0272119),
                                          Color(0xE015130F),
                                        ],
                                      ),
                                      border: Border.all(
                                        color: const Color(0x447D6545),
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
                                              color: Color(0xFFDDBA7B),
                                              fontSize: 10,
                                              letterSpacing: 2,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 18),
                                        const Text(
                                          '欢迎回来',
                                          style: TextStyle(
                                            color: Color(0xFFFFF7E8),
                                            fontSize: 26,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        const Text(
                                          '你的课表、待办与校园空间，\n从这里开始。',
                                          style: TextStyle(
                                            color: Color(0xFFD0C1AA),
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
                                                const Color(0xFFF4D28F),
                                            foregroundColor:
                                                const Color(0xFF342619),
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
                                            color: Color(0xFFB4A28A),
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
                                    color: Color(0xFF9C8164),
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

/// Warm amber offline fallback: soft, masked conic-gradient beams based on Aceternity
/// Lamp. Unlike triangular spotlight polygons, the angular and vertical edges
/// fade continuously to transparent, so the light has no visible cut lines.
/// The painter runs only during the finite entrance animation.
class _LampPainter extends CustomPainter {
  const _LampPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty || progress <= 0) return;

    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final sourceY = h * .46;
    final p = progress;
    final origin = Offset(cx, sourceY);

    // The soft pool of color behind the emitter, rather than a flat tint.
    final wholeHero = Rect.fromLTWH(0, 0, w, h);
    canvas.drawRect(
      wholeHero,
      Paint()
        ..shader = ui.Gradient.radial(
          Offset(cx, sourceY - h * .025),
          math.max(w * .56, h * .60),
          [
            const Color(0xAAC8974A).withValues(alpha: .25 * p),
            const Color(0x558E6535).withValues(alpha: .09 * p),
            const Color(0x00805B33),
          ],
          const [0.0, .35, 1.0],
        ),
    );

    final beamArea = Rect.fromLTRB(0, 0, w, sourceY + 2);

    // Aceternity uses mirrored conic gradients around a central emitter.
    // Sweep shaders reproduce those infinitely smooth angular falloffs.
    // A second vertical alpha mask prevents a straight, polygonal top edge.
    for (final left in [true, false]) {
      final a0 = left ? -math.pi : -math.pi / 2;
      final a1 = left ? -math.pi / 2 : 0.0;
      final tint = left
          ? const Color(0xFFE2B36B)
          : const Color(0xFFF2CA81);

      canvas.saveLayer(beamArea, Paint());
      canvas.drawRect(
        beamArea,
        Paint()
          ..shader = ui.Gradient.sweep(
            origin,
            [
              tint.withValues(alpha: 0),
              tint.withValues(alpha: .10 * p),
              tint.withValues(alpha: .40 * p),
              tint.withValues(alpha: .28 * p),
              tint.withValues(alpha: 0),
            ],
            const [0, .17, .46, .70, 1],
            TileMode.clamp,
            a0,
            a1,
          ),
      );
      // The vertical fade deliberately removes the screenshot's harsh upper
      // beam edges. It also keeps the cyan from filling the whole hero.
      canvas.drawRect(
        beamArea,
        Paint()
          ..blendMode = BlendMode.dstIn
          ..shader = ui.Gradient.linear(
            Offset(cx, 0),
            Offset(cx, sourceY),
            const [
              Color(0x00FFFFFF),
              Color(0x19FFFFFF),
              Color(0x8AFFFFFF),
              Color(0xFFFFFFFF),
            ],
            const [0, .24, .67, 1],
          ),
      );
      // Fade the beam horizontally as well, so no rectangular boundary
      // is ever visible at a device's viewport edge.
      canvas.drawRect(
        beamArea,
        Paint()
          ..blendMode = BlendMode.dstIn
          ..shader = ui.Gradient.linear(
            Offset(0, sourceY),
            Offset(w, sourceY),
            const [
              Color(0x00FFFFFF),
              Color(0xFFFFFFFF),
              Color(0xFFFFFFFF),
              Color(0x00FFFFFF),
            ],
            const [0, .16, .84, 1],
          ),
      );
      canvas.restore();

      // Close-in glow is slightly brighter but still feathered on both sides.
      // No Path.lineTo triangles or opaque geometric strips are used.
      canvas.saveLayer(beamArea, Paint());
      canvas.drawRect(
        beamArea,
        Paint()
          ..shader = ui.Gradient.sweep(
            origin,
            [
              tint.withValues(alpha: 0),
              tint.withValues(alpha: .08 * p),
              const Color(0xFFFFF3C8).withValues(alpha: .28 * p),
              tint.withValues(alpha: .09 * p),
              tint.withValues(alpha: 0),
            ],
            const [0, .26, .52, .76, 1],
            TileMode.clamp,
            left ? -math.pi * .87 : -math.pi * .41,
            left ? -math.pi * .60 : -math.pi * .13,
          ),
      );
      canvas.drawRect(
        beamArea,
        Paint()
          ..blendMode = BlendMode.dstIn
          ..shader = ui.Gradient.linear(
            Offset(cx, 0),
            Offset(cx, sourceY),
            const [Color(0x00FFFFFF), Color(0x55FFFFFF), Color(0xFFFFFFFF)],
            const [0, .55, 1],
          ),
      );
      canvas.drawRect(
        beamArea,
        Paint()
          ..blendMode = BlendMode.dstIn
          ..shader = ui.Gradient.linear(
            Offset(0, sourceY),
            Offset(w, sourceY),
            const [
              Color(0x00FFFFFF),
              Color(0xFFFFFFFF),
              Color(0xFFFFFFFF),
              Color(0x00FFFFFF),
            ],
            const [0, .16, .84, 1],
          ),
      );
      canvas.restore();
    }

    // Three restrained, blurred ellipses form the lamp's luminous bloom.
    for (final (width, height, alpha) in [
      (w * .84, h * .23, .15),
      (w * .48, h * .13, .25),
      (w * .23, h * .08, .32),
    ]) {
      final halo = Rect.fromCenter(
        center: Offset(cx, sourceY + h * .007),
        width: width,
        height: height,
      );
      canvas.drawRect(
        wholeHero,
        Paint()
          ..shader = ui.Gradient.radial(
            halo.center,
            width * .50,
            [
              const Color(0xFFFFDA94).withValues(alpha: alpha * p),
              const Color(0xFFE1B16D).withValues(alpha: alpha * .42 * p),
              const Color(0x00E1B16D),
            ],
            const [0, .50, 1],
          ),
      );
    }

    // A horizontally spreading emitter anchors the whole effect.
    final halfWidth = w * (.075 + .36 * p);
    final leftEnd = Offset(cx - halfWidth, sourceY);
    final rightEnd = Offset(cx + halfWidth, sourceY);
    final lightShader = ui.Gradient.linear(
      leftEnd,
      rightEnd,
      [
        const Color(0x00F4D08C),
        const Color(0xFFFFE2A2).withValues(alpha: .85 * p),
        const Color(0x00F4D08C),
      ],
      const [0, .5, 1],
    );
    for (final (thickness, blur, alpha) in [
      (18.0, 17.0, .25),
      (7.0, 6.0, .55),
      (1.7, 0.0, .90),
    ]) {
      canvas.drawLine(
        leftEnd,
        rightEnd,
        Paint()
          ..strokeCap = StrokeCap.round
          ..strokeWidth = thickness
          ..shader = lightShader
          ..colorFilter = ColorFilter.mode(
            Colors.white.withValues(alpha: alpha),
            BlendMode.modulate,
          )
          ..maskFilter = blur > 0
              ? ui.MaskFilter.blur(ui.BlurStyle.normal, blur)
              : null,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _LampPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
