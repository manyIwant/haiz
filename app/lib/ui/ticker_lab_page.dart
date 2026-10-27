import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/ticker_physics.dart';
import 'kit.dart';

class TickerLabPage extends StatefulWidget {
  final PocketStore store;
  final VoidCallback onBack;
  const TickerLabPage({super.key, required this.store, required this.onBack});
  @override
  State<TickerLabPage> createState() => _TickerLabPageState();
}

class _TickerLabPageState extends State<TickerLabPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController motion = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  );
  double a = .72;
  double v0 = .22;
  int selectedPoint = 5;
  @override
  void dispose() {
    motion.dispose();
    super.dispose();
  }

  TickerPhysics get physics => TickerPhysics(acceleration: a, initialSpeed: v0);

  void _toggle() {
    if (motion.isAnimating) {
      motion.stop();
    } else if (motion.value >= 1) {
      motion.forward(from: 0);
    } else {
      motion.forward();
    }
    setState(() {});
  }

  void _reset() {
    motion.reset();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final l = physics;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(23, 26, 23, 125),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 850),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextButton.icon(
                onPressed: widget.onBack,
                icon: const Icon(Icons.arrow_back_rounded, size: 17),
                label: const Text('返回探索'),
              ),
              const SizedBox(height: 8),
              const Eyebrow('HAIZ TEACH · LAB 01'),
              const SizedBox(height: 20),
              const PageTitle(
                title: '纸带上的时间。',
                subtitle: '探究小车速度随时间变化的规律 · 高一物理',
              ),
              const SizedBox(height: 16),
              Text(
                '这是一项原创、理想匀加速运动模拟，不是实测数据。原理参考交互式教材的教学设计。',
                style: TextStyle(color: p.secondary, fontSize: 12, height: 1.5),
              ),
              const SizedBox(height: 21),
              PocketCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionLabel('01 / 观察小车运动'),
                    const SizedBox(height: 6),
                    Text(
                      '按下开始，计时器以 50 Hz 留点。',
                      style: TextStyle(color: p.secondary, fontSize: 12),
                    ),
                    const SizedBox(height: 12),
                    AnimatedBuilder(
                      animation: motion,
                      builder: (ctx, _) {
                        final t = motion.value * TickerPhysics.duration;
                        return Column(
                          children: [
                            SizedBox(
                              height: 168,
                              child: CustomPaint(
                                painter: _TrackPainter(l, t, p),
                                size: Size.infinite,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  't = ${t.toStringAsFixed(2)} s',
                                  style: TextStyle(
                                    color: p.foreground,
                                    fontFeatures: const [
                                      FontFeature.tabularFigures(),
                                    ],
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                                Text(
                                  'x = ${l.positionAt(t).toStringAsFixed(3)} m',
                                  style: TextStyle(
                                    color: p.secondary,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: PocketPill(
                            label: motion.isAnimating
                                ? '暂停实验'
                                : motion.value == 1
                                ? '重新开始'
                                : '开始实验',
                            icon: motion.isAnimating
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            onTap: _toggle,
                          ),
                        ),
                        const SizedBox(width: 9),
                        IconButton.filledTonal(
                          onPressed: _reset,
                          tooltip: '复位',
                          icon: const Icon(Icons.restart_alt_rounded),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '初速度 ${v0.toStringAsFixed(2)} m/s',
                      style: TextStyle(
                        color: p.foreground,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Slider(
                      value: v0,
                      min: 0,
                      max: .45,
                      divisions: 9,
                      onChanged: (v) {
                        motion.reset();
                        setState(() => v0 = v);
                      },
                    ),
                    Text(
                      '加速度 ${a.toStringAsFixed(2)} m/s²',
                      style: TextStyle(
                        color: p.foreground,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Slider(
                      value: a,
                      min: 0,
                      max: 1.4,
                      divisions: 14,
                      onChanged: (v) {
                        motion.reset();
                        setState(() => a = v);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 15),
              PocketCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionLabel('02 / 测量纸带'),
                    const SizedBox(height: 7),
                    Text(
                      '每 0.02 s 一个原始点；每 5 个时间间隔选一个计数点，计数点相隔 0.10 s。',
                      style: TextStyle(
                        color: p.secondary,
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 15),
                    AnimatedBuilder(
                      animation: motion,
                      builder: (ctx, _) => SizedBox(
                        height: 95,
                        child: CustomPaint(
                          painter: _TapePainter(
                            l,
                            motion.value * TickerPhysics.duration,
                            p,
                          ),
                          size: Size.infinite,
                        ),
                      ),
                    ),
                    const SizedBox(height: 15),
                    Row(
                      children: [
                        Text(
                          '选计数点',
                          style: TextStyle(
                            color: p.foreground,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '$selectedPoint · t = ${l.countTime(selectedPoint).toStringAsFixed(2)} s',
                          style: TextStyle(color: p.secondary, fontSize: 11.5),
                        ),
                      ],
                    ),
                    Slider(
                      value: selectedPoint.toDouble(),
                      min: 1,
                      max: 11,
                      divisions: 10,
                      onChanged: (v) =>
                          setState(() => selectedPoint = v.round()),
                    ),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: p.accent.withValues(alpha: .08),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '中间时刻速度近似',
                            style: TextStyle(color: p.secondary, fontSize: 11),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'v = (x₍ᵢ₊₁₎ − x₍ᵢ₋₁₎) / 0.20 s',
                            style: TextStyle(
                              color: p.foreground,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 9),
                          Text(
                            'v$selectedPoint ≈ ${l.measuredSpeed(selectedPoint).toStringAsFixed(3)} m/s',
                            style: TextStyle(
                              color: p.accent,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 15),
              PocketCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionLabel('03 / 从纸带得到 v–t 图'),
                    const SizedBox(height: 9),
                    Text(
                      '图上的速度来自相邻计数点位置差，不是直接读取模拟器内部速度。',
                      style: TextStyle(color: p.secondary, fontSize: 12),
                    ),
                    const SizedBox(height: 15),
                    SizedBox(
                      height: 190,
                      child: CustomPaint(
                        painter: _ChartPainter(l, p),
                        size: Size.infinite,
                      ),
                    ),
                    const SizedBox(height: 9),
                    Wrap(
                      spacing: 14,
                      runSpacing: 10,
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.end,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '直线斜率 ≈ 加速度',
                              style: TextStyle(
                                color: p.secondary,
                                fontSize: 11,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              '${l.fittedAcceleration.toStringAsFixed(3)} m/s²',
                              style: TextStyle(
                                color: p.accent,
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        Text(
                          '理想设定值：${a.toStringAsFixed(2)} m/s²',
                          style: TextStyle(color: p.secondary, fontSize: 11),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const SectionLabel('思考一下'),
              const SizedBox(height: 11),
              PocketCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '如果加速度变成 0，纸带上相邻点的距离会怎样？',
                      style: TextStyle(
                        color: p.foreground,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '先作出预测，再拖动参数验证。匀速时，等时间间隔内位移相等。',
                      style: TextStyle(
                        color: p.secondary,
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 13),
                    OutlinedButton.icon(
                      onPressed: () {
                        widget.store.addTask(
                          '复习打点计时器纸带计算与 v-t 图像',
                          '物理',
                          source: 'HAIZ Teach · 原创互动实验',
                        );
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('已加入「今天」的任务列表')),
                        );
                      },
                      icon: const Icon(Icons.playlist_add),
                      label: const Text('加入课后复习任务'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TrackPainter extends CustomPainter {
  final TickerPhysics model;
  final double t;
  final PocketPalette p;
  _TrackPainter(this.model, this.t, this.p);
  @override
  void paint(Canvas canvas, Size s) {
    final width = s.width, lineY = s.height * .69;
    final rail = Paint()
      ..color = p.border
      ..strokeWidth = 7
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(15, lineY), Offset(width - 15, lineY), rail);
    canvas.drawLine(
      Offset(20, lineY + 11),
      Offset(width - 20, lineY + 11),
      Paint()
        ..color = p.secondary.withValues(alpha: .20)
        ..strokeWidth = 2,
    );
    final maxD = model.positionAt(TickerPhysics.duration);
    final progress = maxD == 0 ? 0.0 : model.positionAt(t) / maxD;
    final cx = math
        .min(width - 75, math.max(74.0, 74 + (width - 148) * progress))
        .toDouble();
    final cart = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(cx, lineY - 28), width: 76, height: 39),
      const Radius.circular(9),
    );
    canvas.drawRRect(cart, Paint()..color = p.accent);
    final highlight = Paint()
      ..color = const Color(0xFFFFFFFF).withValues(alpha: .18);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx - 28, lineY - 42, 56, 4),
        const Radius.circular(3),
      ),
      highlight,
    );
    for (final dx in [-23.0, 23.0]) {
      canvas.drawCircle(
        Offset(cx + dx, lineY - 8),
        7,
        Paint()..color = p.foreground,
      );
      canvas.drawCircle(
        Offset(cx + dx, lineY - 8),
        2.8,
        Paint()..color = p.card,
      );
    }
    // Ticker unit with little strip feeding the cart.
    final ticker = RRect.fromRectAndRadius(
      Rect.fromLTWH(8, lineY - 48, 30, 38),
      const Radius.circular(7),
    );
    canvas.drawRRect(
      ticker,
      Paint()..color = p.foreground.withValues(alpha: .75),
    );
    canvas.drawLine(
      Offset(37, lineY - 27),
      Offset(cx - 38, lineY - 27),
      Paint()
        ..color = p.accent.withValues(alpha: .5)
        ..strokeWidth = 2,
    );
    final labels = TextPainter(
      textDirection: TextDirection.ltr,
      text: TextSpan(
        text: '50 Hz',
        style: TextStyle(color: p.secondary, fontSize: 10),
      ),
    );
    labels.layout();
    labels.paint(canvas, Offset(10, lineY - 70));
    final timeLabel = TextPainter(
      textDirection: TextDirection.ltr,
      text: TextSpan(
        text: '理想模型 · 位置由 x = v₀t + ½at² 计算',
        style: TextStyle(color: p.secondary, fontSize: 10),
      ),
    );
    timeLabel.layout(maxWidth: width);
    timeLabel.paint(canvas, Offset(12, 12));
    final dot = Paint()..color = p.accent.withValues(alpha: .45);
    for (int i = 0; i < model.rawCount; i++) {
      if (model.rawTime(i) > t) break;
      final x =
          70 +
          (width - 142) *
              model.positionAt(model.rawTime(i)) /
              math.max(.001, maxD);
      canvas.drawCircle(Offset(x, lineY - 59), i % 5 == 0 ? 3 : 1.3, dot);
    }
  }

  @override
  bool shouldRepaint(_TrackPainter old) =>
      t != old.t ||
      model.acceleration != old.model.acceleration ||
      model.initialSpeed != old.model.initialSpeed ||
      p != old.p;
}

class _TapePainter extends CustomPainter {
  final TickerPhysics model;
  final double t;
  final PocketPalette p;
  _TapePainter(this.model, this.t, this.p);
  @override
  void paint(Canvas canvas, Size s) {
    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 5, s.width, s.height - 10),
      const Radius.circular(10),
    );
    canvas.drawRRect(
      rect,
      Paint()
        ..color = p.dark ? const Color(0xFFF0E8D7) : const Color(0xFFFAF1DD),
    );
    final max = math.max(model.positionAt(TickerPhysics.duration), .02);
    for (int i = 0; i < model.rawCount; i++) {
      if (model.rawTime(i) > t) continue;
      final x = 16 + (s.width - 32) * model.positionAt(model.rawTime(i)) / max;
      final isCount = i % TickerPhysics.countEvery == 0;
      canvas.drawCircle(
        Offset(x, 41),
        isCount ? 3.8 : 1.7,
        Paint()
          ..color = isCount ? const Color(0xFF197C66) : const Color(0xFF4F463B),
      );
      if (isCount) {
        final num = i ~/ TickerPhysics.countEvery;
        final tp = TextPainter(
          textDirection: TextDirection.ltr,
          text: TextSpan(
            text: '$num',
            style: const TextStyle(color: Color(0xFF746853), fontSize: 9),
          ),
        );
        tp.layout();
        tp.paint(canvas, Offset(x - tp.width / 2, 52));
      }
    }
    final info = TextPainter(
      textDirection: TextDirection.ltr,
      text: const TextSpan(
        text: '真实时间标记 · 每 5 个间隔标一号计数点',
        style: TextStyle(color: Color(0xFF8A806D), fontSize: 10),
      ),
    );
    info.layout(maxWidth: s.width - 24);
    info.paint(canvas, const Offset(12, 12));
  }

  @override
  bool shouldRepaint(_TapePainter old) =>
      t != old.t ||
      model.acceleration != old.model.acceleration ||
      model.initialSpeed != old.model.initialSpeed ||
      p != old.p;
}

class _ChartPainter extends CustomPainter {
  final TickerPhysics model;
  final PocketPalette p;
  _ChartPainter(this.model, this.p);
  @override
  void paint(Canvas c, Size s) {
    final left = 37.0,
        right = s.width - 14.0,
        top = 13.0,
        bottom = s.height - 28.0;
    final base = Paint()
      ..color = p.border
      ..strokeWidth = 1;
    for (int i = 0; i <= 4; i++) {
      final y = top + (bottom - top) * i / 4;
      c.drawLine(
        Offset(left, y),
        Offset(right, y),
        Paint()..color = p.border.withValues(alpha: .6),
      );
    }
    c.drawLine(Offset(left, top), Offset(left, bottom), base);
    c.drawLine(Offset(left, bottom), Offset(right, bottom), base);
    final ymax = math.max(
      0.25,
      model.velocityAt(TickerPhysics.duration) * 1.18,
    );
    Offset point(double t, double v) => Offset(
      left + (right - left) * t / TickerPhysics.duration,
      bottom - (bottom - top) * v / ymax,
    );
    final samples = model.speedSamples;
    final path = Path()
      ..moveTo(
        point(samples.first.$1, samples.first.$2).dx,
        point(samples.first.$1, samples.first.$2).dy,
      );
    for (final it in samples.skip(1)) {
      final o = point(it.$1, it.$2);
      path.lineTo(o.dx, o.dy);
    }
    c.drawPath(
      path,
      Paint()
        ..color = p.accent
        ..strokeWidth = 2.3
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );
    for (final it in samples) {
      c.drawCircle(point(it.$1, it.$2), 3.6, Paint()..color = p.accent);
    }
    final style = TextStyle(color: p.secondary, fontSize: 10);
    for (final t in [0.0, .4, .8, 1.2]) {
      final tp = TextPainter(
        text: TextSpan(text: t.toStringAsFixed(1), style: style),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(c, Offset(point(t, 0).dx - tp.width / 2, bottom + 6));
    }
    final axes = TextPainter(
      text: TextSpan(text: 'v (m/s)', style: style),
      textDirection: TextDirection.ltr,
    )..layout();
    axes.paint(c, Offset(0, 0));
    final tlabel = TextPainter(
      text: TextSpan(text: 't (s)', style: style),
      textDirection: TextDirection.ltr,
    )..layout();
    tlabel.paint(c, Offset(right - tlabel.width, bottom + 10));
  }

  @override
  bool shouldRepaint(_ChartPainter old) =>
      model.acceleration != old.model.acceleration ||
      model.initialSpeed != old.model.initialSpeed ||
      p != old.p;
}
