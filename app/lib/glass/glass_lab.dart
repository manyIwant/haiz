import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../design/tokens.dart';
import 'glass.dart';
import 'glass_specs.dart';

/// Development tool, not a user feature: verifies the glass material over
/// different backdrops and compares optical / blur / solid rendering.
/// Reached from 我的 → 关于 (tap the build line five times) or, on web,
/// with `?lab=glass`.
class GlassLabScreen extends StatefulWidget {
  const GlassLabScreen({super.key, this.initialBackground = 0, this.initialDark, this.initialMode = GlassMode.optical, this.showControls = true});
  final int initialBackground;
  final bool? initialDark;
  final GlassMode initialMode;
  final bool showControls;
  @override
  State<GlassLabScreen> createState() => _GlassLabScreenState();
}

class _GlassLabScreenState extends State<GlassLabScreen> with SingleTickerProviderStateMixin {
  late int _bg = widget.initialBackground;
  late bool _dark = widget.initialDark ?? false;
  late GlassMode _mode = widget.initialMode;
  bool _animate = false;
  late bool _controls = widget.showControls;
  Offset _lens = const Offset(120, 440);
  GlassSpec _spec = GlassSpecs.lens;
  late final AnimationController _drift = AnimationController(vsync: this, duration: const Duration(seconds: 8));
  final List<double> _raster = [];
  final List<double> _build = [];

  static const _backgrounds = ['文字', '图案', '照片', '动态', '列表'];

  @override
  void initState() {
    super.initState();
    GlassProgram.ensureLoaded();
    SchedulerBinding.instance.addTimingsCallback(_timings);
  }

  void _timings(List<ui.FrameTiming> t) {
    if (!mounted) return;
    for (final f in t) {
      _raster.add(f.rasterDuration.inMicroseconds / 1000);
      _build.add(f.buildDuration.inMicroseconds / 1000);
    }
    while (_raster.length > 120) { _raster.removeAt(0); }
    while (_build.length > 120) { _build.removeAt(0); }
    setState(() {});
  }

  @override
  void dispose() {
    SchedulerBinding.instance.removeTimingsCallback(_timings);
    _drift.dispose();
    super.dispose();
  }

  String _avg(List<double> v) => v.isEmpty ? '—' : (v.reduce((a, b) => a + b) / v.length).toStringAsFixed(1);

  @override
  Widget build(BuildContext context) {
    final c = _dark ? HaizColors.night : HaizColors.light;
    final size = MediaQuery.sizeOf(context);
    return Scaffold(
      backgroundColor: c.canvas,
      body: GlassScope(
        mode: _mode,
        dark: _dark,
        paper: c.canvas,
        ink: c.inverse,
        content: _Backdrop(kind: _bg, dark: _dark, drift: _animate ? _drift : null, colors: c),
        overlay: Stack(children: [
          Positioned(
            left: _lens.dx,
            top: _lens.dy,
            child: GestureDetector(
              onPanUpdate: (d) => setState(() => _lens += d.delta),
              child: GlassSurface(
                key: const Key('lab-lens'),
                spec: _spec,
                child: const SizedBox(width: 150, height: 150),
              ),
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 28 + MediaQuery.paddingOf(context).bottom,
            child: GlassSurface(
              spec: GlassSpecs.bar,
              child: SizedBox(
                height: 62,
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
                  for (final l in ['今天', '待办', '课表', '收件', '我的'])
                    Text(l, style: TypeScale.label(c.ink)),
                ]),
              ),
            ),
          ),
          Positioned(
            right: 24,
            bottom: 112 + MediaQuery.paddingOf(context).bottom,
            child: GlassSurface(
              spec: GlassSpecs.action,
              child: SizedBox.square(dimension: 56, child: Icon(Icons.add_rounded, color: c.onInverse, size: 28)),
            ),
          ),
          if (_controls)
            Positioned(left: 0, right: 0, top: 0, child: _panel(c, size))
          else
            Positioned(
              right: 12,
              top: MediaQuery.paddingOf(context).top + 8,
              child: _chip(c, '控制', true, () => setState(() => _controls = true)),
            ),
        ]),
      ),
    );
  }

  Widget _chip(HaizColors c, String label, bool on, VoidCallback tap) => GestureDetector(
    onTap: tap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: on ? c.inverse : c.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: c.ruleStrong),
      ),
      child: Text(label, style: TypeScale.caption(on ? c.onInverse : c.ink)),
    ),
  );

  Widget _slider(HaizColors c, String label, double value, double max, ValueChanged<double> on) => Row(children: [
    SizedBox(width: 54, child: Text(label, style: TypeScale.caption(c.ink2))),
    Expanded(child: SliderTheme(
      data: SliderTheme.of(context).copyWith(trackHeight: 2, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7)),
      child: Slider(value: value, max: max, onChanged: on, activeColor: c.ink, inactiveColor: c.rule),
    )),
    SizedBox(width: 34, child: Text(value.toStringAsFixed(max > 2 ? 0 : 2), style: TypeScale.caption(c.ink3))),
  ]);

  Widget _panel(HaizColors c, Size size) {
    final top = MediaQuery.paddingOf(context).top;
    return Container(
      padding: EdgeInsets.fromLTRB(14, top + 8, 14, 8),
      decoration: BoxDecoration(color: c.surface.withValues(alpha: .96), border: Border(bottom: BorderSide(color: c.rule))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Text('Glass Lab', style: TypeScale.headline(c.ink)),
          const SizedBox(width: 8),
          Text('开发验证 · 不面向用户', style: TypeScale.caption(c.ink3)),
          const Spacer(),
          _chip(c, '收起', false, () => setState(() => _controls = false)),
          const SizedBox(width: 6),
          if (Navigator.of(context).canPop()) _chip(c, '关闭', false, () => Navigator.of(context).pop()),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final (m, l) in [(GlassMode.optical, '光学折射'), (GlassMode.blur, '普通模糊'), (GlassMode.solid, '不透明')])
            _chip(c, l, _mode == m, () => setState(() => _mode = m)),
          _chip(c, _dark ? '深色' : '浅色', _dark, () => setState(() => _dark = !_dark)),
          _chip(c, '背景动起来', _animate, () => setState(() {
            _animate = !_animate;
            _animate ? _drift.repeat() : _drift.stop();
          })),
        ]),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final (i, l) in _backgrounds.indexed) _chip(c, l, _bg == i, () => setState(() => _bg = i)),
        ]),
        _slider(c, '斜面', _spec.bevel, 40, (v) => setState(() => _spec = _spec.copyWith(bevel: v))),
        _slider(c, '折射', _spec.depth, 60, (v) => setState(() => _spec = _spec.copyWith(depth: v))),
        _slider(c, '色散', _spec.dispersion, 1, (v) => setState(() => _spec = _spec.copyWith(dispersion: v))),
        _slider(c, '磨砂', _spec.frost, 1, (v) => setState(() => _spec = _spec.copyWith(frost: v))),
        _slider(c, '遮罩', _spec.veil, 1, (v) => setState(() => _spec = _spec.copyWith(veil: v))),
        Text(
          '着色器 ${GlassProgram.program.value != null ? '已加载' : (GlassProgram.failed.value ? '不可用' : '加载中')}'
          ' · 降级 ${GlassBudget.degraded.value ? '是' : '否'}'
          ' · 构建 ${_avg(_build)} ms · 光栅 ${_avg(_raster)} ms（近 ${_raster.length} 帧）',
          key: const Key('lab-stats'),
          style: TypeScale.caption(c.ink2),
        ),
      ]),
    );
  }
}

class _Backdrop extends StatelessWidget {
  const _Backdrop({required this.kind, required this.dark, required this.drift, required this.colors});
  final int kind;
  final bool dark;
  final Animation<double>? drift;
  final HaizColors colors;

  @override
  Widget build(BuildContext context) {
    final c = colors;
    switch (kind) {
      case 1:
        return CustomPaint(painter: _Pattern(dark: dark), child: const SizedBox.expand());
      case 2:
        return Image.asset('assets/campus/campus_fengqitang.jpg', fit: BoxFit.cover,
            width: double.infinity, height: double.infinity);
      case 3:
        return AnimatedBuilder(
          animation: drift ?? const AlwaysStoppedAnimation(0.25),
          builder: (context, _) => CustomPaint(
            painter: _Waves(t: (drift?.value ?? 0.25), dark: dark),
            child: const SizedBox.expand(),
          ),
        );
      case 4:
        return ListView.builder(
          padding: const EdgeInsets.only(top: 260, bottom: 200),
          itemCount: 40,
          itemBuilder: (context, i) => Container(
            height: 58,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.rule, width: .6))),
            child: Row(children: [
              Container(width: 18, height: 18, decoration: BoxDecoration(shape: BoxShape.circle,
                  border: Border.all(color: c.ruleStrong, width: 1.5))),
              const SizedBox(width: 14),
              Expanded(child: Text(['练习册 P36–39，第 7 题写完整过程', '实验报告：测定匀变速直线运动的加速度',
                '背诵 Unit 4 单词（周五默写）', '《赤壁赋》全文默写'][i % 4], style: TypeScale.body(c.ink))),
              Container(width: 7, height: 7, color: subjectColor(['数学', '物理', '英语', '语文'][i % 4], dark: dark)),
            ]),
          ),
        );
      default:
        return AnimatedBuilder(
          animation: drift ?? const AlwaysStoppedAnimation(0.0),
          builder: (context, child) => Transform.translate(
            offset: Offset(0, -(drift?.value ?? 0) * 300),
            child: child,
          ),
          child: OverflowBox(
            alignment: Alignment.topLeft,
            maxHeight: double.infinity,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 250, 20, 0),
              child: Text(
                List.filled(14, '纸面上的墨字经过玻璃时会被弯折：边缘处的笔画向内收拢，中心略微放大。'
                    '若只是模糊，笔画会变软而位置不变。The quick brown fox 0123456789。').join(),
                style: TypeScale.body(c.ink).copyWith(fontSize: 17, height: 1.7),
              ),
            ),
          ),
        );
    }
  }
}

class _Pattern extends CustomPainter {
  _Pattern({required this.dark});
  final bool dark;
  @override
  void paint(Canvas canvas, Size size) {
    final a = dark ? const Color(0xFF121314) : const Color(0xFFF6F4EF);
    final b = dark ? const Color(0xFF3A3D42) : const Color(0xFF17181A);
    canvas.drawRect(Offset.zero & size, Paint()..color = a);
    const s = 22.0;
    final p = Paint()..color = b;
    for (var y = 0.0; y < size.height; y += s) {
      for (var x = ((y / s).round().isEven ? 0.0 : s); x < size.width; x += s * 2) {
        canvas.drawRect(Rect.fromLTWH(x, y, s, s), p);
      }
    }
    final line = Paint()..color = const Color(0xFFD13C20)..strokeWidth = 2;
    for (var x = 11.0; x < size.width; x += 44) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), line..color = const Color(0xFFD13C20).withValues(alpha: .7));
    }
  }

  @override
  bool shouldRepaint(_Pattern old) => old.dark != dark;
}

class _Waves extends CustomPainter {
  _Waves({required this.t, required this.dark});
  final double t;
  final bool dark;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = dark ? const Color(0xFF121314) : const Color(0xFFF6F4EF));
    final colors = [const Color(0xFF3C5B85), const Color(0xFFD13C20), const Color(0xFF22827B), const Color(0xFFB97716)];
    for (var i = 0; i < 9; i++) {
      final path = Path();
      final y0 = size.height * (i + 1) / 10;
      path.moveTo(0, y0);
      for (var x = 0.0; x <= size.width; x += 8) {
        path.lineTo(x, y0 + math.sin(x / 46 + t * math.pi * 2 + i) * 18);
      }
      canvas.drawPath(path, Paint()
        ..color = colors[i % 4].withValues(alpha: .85)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 9);
    }
  }

  @override
  bool shouldRepaint(_Waves old) => old.t != t || old.dark != dark;
}
