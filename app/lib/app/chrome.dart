import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';

import '../core/pocket_store.dart';
import '../design/components.dart' show ChromeLift;
import '../design/haiz_icons.dart';
import '../design/motion_text.dart';
import '../design/theme.dart';
import '../design/tokens.dart';
import '../features/focus/focus_screen.dart' show clockText;
import '../glass/glass.dart';
import '../glass/glass_specs.dart';
import 'nav.dart';

/// Geometry of the floating chrome, read by toasts and by pages that must
/// keep content clear of it.
abstract final class ChromeMetrics {
  static const barHeight = 62.0;
  static const rowHeight = 56.0;
  static const gap = 10.0;

  /// Distance from the bottom edge to the top of the floating controls.
  static double get lift => ChromeLift.value;
  static set lift(double v) => ChromeLift.value = v;
}

/// The navigation capsule. A clear glass droplet marks the selected tab and
/// travels with a spring; it stretches in the direction of travel, like a
/// drop of water dragged across glass, and settles round.
class GlassTabBar extends StatefulWidget {
  const GlassTabBar({
    super.key,
    required this.tab,
    required this.onSelect,
    required this.inboxBadge,
    required this.meBadge,
    required this.pulse,
    required this.itemKeys,
  });

  final HaizTab tab;
  final ValueChanged<HaizTab> onSelect;
  final ValueListenable<int> inboxBadge;
  final bool meBadge;

  /// A tab that just received something (e.g. confirmed tasks) bumps once.
  final ValueListenable<(HaizTab, int)?> pulse;
  final Map<HaizTab, GlobalKey> itemKeys;

  static const items = [
    (HaizTab.today, '今天', HaizGlyph.today),
    (HaizTab.tasks, '待办', HaizGlyph.tasks),
    (HaizTab.schedule, '课表', HaizGlyph.schedule),
    (HaizTab.inbox, '收件', HaizGlyph.inbox),
    (HaizTab.me, '我的', HaizGlyph.me),
  ];

  @override
  State<GlassTabBar> createState() => _GlassTabBarState();
}

class _GlassTabBarState extends State<GlassTabBar> with SingleTickerProviderStateMixin {
  late final AnimationController _x = AnimationController.unbounded(vsync: this, value: _index.toDouble());
  int? _pressed;

  int get _index => GlassTabBar.items.indexWhere((e) => e.$1 == widget.tab);

  static const _spring = SpringDescription(mass: 1, stiffness: 420, damping: 30);

  @override
  void didUpdateWidget(covariant GlassTabBar old) {
    super.didUpdateWidget(old);
    if (old.tab == widget.tab) return;
    if (HaizTheme.of(context).reduceMotion) {
      _x.value = _index.toDouble();
    } else {
      _x.animateWith(SpringSimulation(_spring, _x.value, _index.toDouble(), _x.velocity));
    }
  }

  @override
  void dispose() {
    _x.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return GlassSurface(
      key: const Key('tab-bar'),
      spec: GlassSpecs.bar,
      child: SizedBox(
        height: ChromeMetrics.barHeight,
        child: LayoutBuilder(builder: (context, box) {
          const inset = 5.0;
          final cell = (box.maxWidth - inset * 2) / GlassTabBar.items.length;
          return Stack(children: [
            AnimatedBuilder(
              animation: _x,
              builder: (context, _) {
                // Stretch along the direction of travel, proportional to speed.
                final speed = _x.velocity.abs();
                final stretch = (speed * 5.5).clamp(0.0, cell * 0.55);
                final width = cell - 4 + stretch;
                final left = inset + _x.value * cell + 2 - stretch / 2;
                return Positioned(
                  left: left,
                  width: width,
                  top: inset,
                  bottom: inset,
                  child: GlassSurface(
                    key: const Key('tab-indicator'),
                    spec: GlassSpecs.indicator.copyWith(radius: (ChromeMetrics.barHeight - inset * 2) / 2),
                    child: const SizedBox.expand(),
                  ),
                );
              },
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: inset),
              child: Row(children: [
                for (final (i, item) in GlassTabBar.items.indexed)
                  Expanded(
                    child: Semantics(
                      selected: item.$1 == widget.tab,
                      button: true,
                      label: item.$2,
                      excludeSemantics: true,
                      child: GestureDetector(
                        key: Key('tab-${item.$1.name}'),
                        behavior: HitTestBehavior.opaque,
                        onTapDown: (_) => setState(() => _pressed = i),
                        onTapCancel: () => setState(() => _pressed = null),
                        onTapUp: (_) => setState(() => _pressed = null),
                        onTap: () {
                          if (item.$1 != widget.tab) HapticFeedback.selectionClick();
                          widget.onSelect(item.$1);
                        },
                        child: MouseRegion(
                          cursor: SystemMouseCursors.click,
                          child: ValueListenableBuilder<(HaizTab, int)?>(
                            valueListenable: widget.pulse,
                            builder: (context, pulse, child) => _Bump(
                              key: ValueKey('bump-${item.$1.name}-${pulse?.$1 == item.$1 ? pulse!.$2 : 0}'),
                              active: pulse?.$1 == item.$1,
                              child: child!,
                            ),
                            child: AnimatedScale(
                              scale: _pressed == i && !context.haiz.reduceMotion ? 0.9 : 1,
                              duration: Motion.press,
                              child: Column(
                                key: widget.itemKeys[item.$1],
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Stack(clipBehavior: Clip.none, children: [
                                    HaizIcon(item.$3, size: 23, active: item.$1 == widget.tab,
                                        color: item.$1 == widget.tab ? c.ink : c.ink2),
                                    if (item.$1 == HaizTab.inbox)
                                      ValueListenableBuilder<int>(
                                        valueListenable: widget.inboxBadge,
                                        builder: (context, n, _) => n == 0
                                            ? const SizedBox.shrink()
                                            : Positioned(right: -9, top: -4, child: _Badge('$n', color: c.amber)),
                                      ),
                                    if (item.$1 == HaizTab.me && widget.meBadge)
                                      Positioned(right: -2, top: -1, child: Container(width: 7, height: 7,
                                          decoration: BoxDecoration(color: c.now, shape: BoxShape.circle))),
                                  ]),
                                  const SizedBox(height: 2),
                                  Text(item.$2, style: TypeScale.micro(item.$1 == widget.tab ? c.ink : c.ink2)
                                      .copyWith(fontWeight: item.$1 == widget.tab ? FontWeight.w700 : FontWeight.w500,
                                          shadows: glassHalo(c))),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ]),
            ),
          ]);
        }),
      ),
    );
  }
}

/// One elastic bump when a tab receives something.
class _Bump extends StatefulWidget {
  const _Bump({super.key, required this.active, required this.child});
  final bool active;
  final Widget child;
  @override
  State<_Bump> createState() => _BumpState();
}

class _BumpState extends State<_Bump> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 520));

  @override
  void initState() {
    super.initState();
    if (widget.active) _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    builder: (context, child) {
      final t = _c.value;
      final s = t == 0 || t == 1 ? 1.0 : 1 + 0.22 * Curves.elasticOut.transform(1 - t) * (1 - t);
      return Transform.scale(scale: s, child: child);
    },
    child: widget.child,
  );
}

class _Badge extends StatelessWidget {
  const _Badge(this.text, {required this.color});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(minWidth: 16),
    height: 16,
    padding: const EdgeInsets.symmetric(horizontal: 4),
    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
    alignment: Alignment.center,
    child: Text(text, style: const TextStyle(fontSize: 9.5, height: 1, color: Colors.white, fontWeight: FontWeight.w700)),
  );
}

/// The running-focus capsule. Its title and clock are shared elements with
/// the focus screen, so opening and collapsing focus reads as the same
/// object growing and shrinking.
class FocusCapsule extends StatelessWidget {
  const FocusCapsule({super.key, required this.store, required this.onOpen});
  final PocketStore store;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final session = store.focusSession;
    if (session == null) return const SizedBox.shrink();
    final title = store.taskById(session.taskId)?.title ?? session.label;
    return GlassSurface(
      spec: GlassSpecs.focus,
      child: Semantics(
        button: true,
        label: '${store.focusRunning ? '专注中' : '已暂停'}：$title，打开专注',
        child: GestureDetector(
          key: const Key('focus-bar'),
          behavior: HitTestBehavior.opaque,
          onTap: onOpen,
          child: SizedBox(
            height: ChromeMetrics.rowHeight,
            child: Row(children: [
              const SizedBox(width: 16),
              _FocusRing(store: store),
              const SizedBox(width: 10),
              Expanded(
                child: HeroText(
                  tag: 'focus-title',
                  text: title,
                  style: TypeScale.footnote(c.ink).copyWith(fontWeight: FontWeight.w600, shadows: glassHalo(c)),
                ),
              ),
              ValueListenableBuilder<int>(
                valueListenable: store.focusClock,
                builder: (context, _, _) => HeroText(
                  tag: 'focus-clock',
                  text: clockText(store.focusRemaining),
                  style: TypeScale.label(c.ink).copyWith(fontSize: 16, fontFeatures: TypeScale.tabular,
                      shadows: glassHalo(c)),
                ),
              ),
              IconButton(
                tooltip: store.focusRunning ? '暂停' : '继续',
                onPressed: store.focusRunning ? store.pauseFocus : store.startFocus,
                icon: HaizIcon(store.focusRunning ? HaizGlyph.pause : HaizGlyph.play, size: 20, color: c.ink),
              ),
              const SizedBox(width: 4),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Elapsed share of the session as a small ring. Repaints once per second
/// with the clock (no continuous animation: the glass under the capsule is
/// recomposited only when something actually changes).
class _FocusRing extends StatelessWidget {
  const _FocusRing({required this.store});
  final PocketStore store;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ValueListenableBuilder<int>(
      valueListenable: store.focusClock,
      builder: (context, _, _) {
        final s = store.focusSession;
        final total = s?.targetSeconds ?? 1;
        final done = s == null ? 0.0 : (s.elapsedAt(store.now()) / total).clamp(0.0, 1.0);
        return CustomPaint(
          size: const Size.square(18),
          painter: _RingPainter(done, store.focusRunning ? c.now : c.ink3, c.rule),
        );
      },
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.value, this.color, this.track);
  final double value;
  final Color color;
  final Color track;
  @override
  void paint(Canvas canvas, Size size) {
    final r = Rect.fromLTWH(1.5, 1.5, size.width - 3, size.height - 3);
    canvas.drawOval(r, Paint()..color = track..style = PaintingStyle.stroke..strokeWidth = 2.4);
    canvas.drawArc(r, -1.5708, 6.2832 * value, false, Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value || old.color != color;
}

/// Smoked-glass primary action. Visibility animates the glass itself, not
/// just the icon, so nothing is left floating when it hides.
class GlassCaptureButton extends StatelessWidget {
  const GlassCaptureButton({super.key, required this.visible, required this.onTap, required this.anchor});
  final bool visible;
  final VoidCallback onTap;
  final GlobalKey anchor;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return TweenAnimationBuilder<double>(
      tween: Tween(end: visible ? 1 : 0),
      duration: context.haiz.motion(Motion.base),
      curve: Motion.enter,
      builder: (context, v, _) => IgnorePointer(
        ignoring: v < 0.5,
        child: Transform.translate(
          offset: Offset(0, (1 - v) * 18),
          child: _PressGlass(
            onTap: onTap,
            child: (pressed) => GlassSurface(
              key: anchor,
              spec: GlassSpecs.action.copyWith(opacity: v, depth: pressed ? 24 : 18, magnify: pressed ? 4 : 2),
              child: Semantics(
                button: true,
                label: '新建任务或备忘',
                excludeSemantics: true,
                child: Tooltip(
                  message: '新建（Ctrl/⌘ N）',
                  excludeFromSemantics: true,
                  child: SizedBox.square(
                    key: const Key('capture-button'),
                    dimension: ChromeMetrics.rowHeight,
                    child: Center(child: Opacity(opacity: v, child: HaizIcon(HaizGlyph.plus, size: 26, color: c.onInverse, active: true))),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Press feedback for glass: the slab "gives" under the finger (deeper
/// refraction, stronger magnification) and scales slightly.
class _PressGlass extends StatefulWidget {
  const _PressGlass({required this.onTap, required this.child});
  final VoidCallback onTap;
  final Widget Function(bool pressed) child;
  @override
  State<_PressGlass> createState() => _PressGlassState();
}

class _PressGlassState extends State<_PressGlass> {
  bool _down = false;
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTapDown: (_) => setState(() => _down = true),
    onTapUp: (_) => setState(() => _down = false),
    onTapCancel: () => setState(() => _down = false),
    onTap: widget.onTap,
    child: MouseRegion(
      cursor: SystemMouseCursors.click,
      child: AnimatedScale(
        scale: _down && !context.haiz.reduceMotion ? 0.94 : 1,
        duration: Motion.press,
        child: widget.child(_down),
      ),
    ),
  );
}

/// A small ink token carrying a count ("+3") from where something was
/// confirmed to the tab that now holds it, along a gentle arc.
class DeliveryToken extends StatefulWidget {
  const DeliveryToken({
    super.key,
    required this.from,
    required this.to,
    required this.label,
    required this.colors,
    required this.onArrive,
    required this.onDone,
  });
  final Offset from;
  final Offset to;
  final String label;
  final HaizColors colors;
  final VoidCallback onArrive;
  final VoidCallback onDone;
  @override
  State<DeliveryToken> createState() => _DeliveryTokenState();
}

class _DeliveryTokenState extends State<DeliveryToken> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 720))
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed) {
        widget.onArrive();
        widget.onDone();
      }
    })
    ..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.colors;
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = Curves.easeInOutCubic.transform(_c.value);
          // Quadratic arc: up and over, then down into the tab.
          final control = Offset((widget.from.dx + widget.to.dx) / 2, widget.from.dy - 90);
          final p = Offset.lerp(Offset.lerp(widget.from, control, t)!, Offset.lerp(control, widget.to, t)!, t)!;
          final scale = 1 - 0.55 * t;
          return Stack(children: [
            Positioned(
              left: p.dx - 24,
              top: p.dy - 15,
              child: Transform.scale(
                scale: scale,
                child: Opacity(
                  opacity: _c.value > 0.92 ? (1 - _c.value) / 0.08 : 1,
                  child: Container(
                    width: 48,
                    height: 30,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: c.inverse,
                      borderRadius: BorderRadius.circular(15),
                      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: .18), blurRadius: 10, offset: const Offset(0, 4))],
                    ),
                    child: Text(widget.label, style: TypeScale.label(c.onInverse).copyWith(decoration: TextDecoration.none)),
                  ),
                ),
              ),
            ),
          ]);
        },
      ),
    );
  }
}

/// Text on clear glass: a soft halo of the page colour lifts labels off
/// whatever the glass is refracting, so the glass itself can stay clear.
List<Shadow> glassHalo(HaizColors c) => [
  Shadow(color: c.canvas, blurRadius: 2),
  Shadow(color: c.canvas.withValues(alpha: 0.9), blurRadius: 7),
  Shadow(color: c.canvas.withValues(alpha: 0.7), blurRadius: 14),
];
