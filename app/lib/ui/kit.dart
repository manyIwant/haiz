import 'optical_backdrop.dart';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';

/// Design tokens for HAIZ Pocket.
///
/// Spacing sits on a 4px grid, radii nest (inner = outer - padding), type
/// uses two weights and one scale, and motion uses a single ease-out curve.
/// Method adapted from unslop by Damir Sokolovsky (@heydamir), CC BY 4.0.
abstract final class HaizRadius {
  static const double tag = 6;
  static const double inner = 8;
  static const double control = 10;
  static const double card = 16;
  static const double panel = 20;
  static const double dock = 24;
}

abstract final class HaizMotion {
  static const Curve ease = Cubic(0.22, 1, 0.36, 1);
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration menu = Duration(milliseconds: 200);
  static const Duration enter = Duration(milliseconds: 360);
  static Duration of(BuildContext context, Duration d) =>
      PocketSkin.of(context).reducedMotion ? Duration.zero : d;
}

/// Page frame shared by every tab: 24px gutters, room for the dock below.
abstract final class HaizSpace {
  static const EdgeInsets page = EdgeInsets.fromLTRB(24, 24, 24, 128);
  static const double section = 32;
  static const double group = 12;
  static const double row = 8;
}

abstract final class HaizType {
  static const List<FontFeature> tabular = [FontFeature.tabularFigures()];

  /// Serif page title; the only display face in the app.
  static TextStyle title(PocketPalette p) => TextStyle(
    color: p.foreground,
    fontFamily: 'serif',
    fontSize: 30,
    height: 1.2,
    fontWeight: FontWeight.w500,
  );
  static TextStyle section(PocketPalette p) => TextStyle(
    color: p.foreground,
    fontSize: 17,
    height: 1.3,
    fontWeight: FontWeight.w500,
  );
  static TextStyle itemTitle(PocketPalette p) => TextStyle(
    color: p.foreground,
    fontSize: 15,
    height: 1.4,
    fontWeight: FontWeight.w500,
  );
  static TextStyle body(PocketPalette p) =>
      TextStyle(color: p.foreground, fontSize: 15, height: 1.5);
  static TextStyle secondary(PocketPalette p) =>
      TextStyle(color: p.secondary, fontSize: 13, height: 1.5);
  static TextStyle meta(PocketPalette p) => TextStyle(
    color: p.muted,
    fontSize: 12,
    height: 1.4,
    fontFeatures: tabular,
  );
  static TextStyle figure(PocketPalette p) => TextStyle(
    color: p.foreground,
    fontSize: 28,
    height: 1.1,
    fontWeight: FontWeight.w500,
    fontFeatures: tabular,
  );
}

/// One neutral ramp per appearance, three text roles and one accent.
/// Surfaces stay neutral so courses, tasks and photographs carry the color.
class PocketPalette {
  final Color background;
  final Color card;
  final Color raised;
  final Color foreground;
  final Color secondary;
  final Color muted;
  final Color accent;
  final Color onAccent;
  final bool dark;
  const PocketPalette({
    required this.background,
    required this.card,
    required this.raised,
    required this.foreground,
    required this.secondary,
    required this.muted,
    required this.accent,
    required this.onAccent,
    required this.dark,
  });

  /// Hairline: primary text at 10%.
  Color get border => foreground.withValues(alpha: .10);
  Color get grouped => raised;
  Color get tertiary =>
      Color.alphaBlend(foreground.withValues(alpha: .06), raised);
  Color get glass => card.withValues(alpha: dark ? .86 : .88);
  Color get shadow => Colors.black.withValues(alpha: dark ? .32 : .06);
  Color get positive =>
      dark ? const Color(0xFF6FBF8E) : const Color(0xFF2F7A4F);
  Color get negative =>
      dark ? const Color(0xFFE5736E) : const Color(0xFFB3412F);

  static PocketPalette forName(String name) {
    switch (name) {
      case 'obsidian':
        // Night: warm graphite, sand accent.
        return const PocketPalette(
          background: Color(0xFF141514),
          card: Color(0xFF1B1C1B),
          raised: Color(0xFF252625),
          foreground: Color(0xFFECEBE6),
          secondary: Color(0xFFA7A59F),
          muted: Color(0xFF8A8984),
          accent: Color(0xFFD7AC88),
          onAccent: Color(0xFF22180F),
          dark: true,
        );
      case 'ocean':
        // Deep sea: ink graphite, sea-glass accent.
        return const PocketPalette(
          background: Color(0xFF0C0F13),
          card: Color(0xFF13171C),
          raised: Color(0xFF1C2128),
          foreground: Color(0xFFEDF0F3),
          secondary: Color(0xFFA3ABB5),
          muted: Color(0xFF828B97),
          accent: Color(0xFF9AC8B8),
          onAccent: Color(0xFF0F1F1A),
          dark: true,
        );
      default:
        // Paper: warm off-white, ink text, rust accent from the brand.
        return const PocketPalette(
          background: Color(0xFFF6F4EF),
          card: Color(0xFFFDFCF9),
          raised: Color(0xFFEEEBE4),
          foreground: Color(0xFF1D2622),
          secondary: Color(0xFF535B56),
          muted: Color(0xFF686E69),
          accent: Color(0xFF8A5A3F),
          onAccent: Color(0xFFFFFFFF),
          dark: false,
        );
    }
  }
}

class PocketSkin extends InheritedWidget {
  final PocketPalette colors;
  final bool reducedMotion;
  const PocketSkin({
    super.key,
    required this.colors,
    this.reducedMotion = false,
    required super.child,
  });
  static PocketSkin of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<PocketSkin>()!;

  /// Palette for widgets that may be shown outside the app shell, such as
  /// sheets opened from tests; falls back to the default for the theme.
  static PocketPalette colorsOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<PocketSkin>()?.colors ??
      PocketPalette.forName(
        Theme.of(context).brightness == Brightness.dark
            ? 'obsidian'
            : 'porcelain',
      );
  @override
  bool updateShouldNotify(PocketSkin oldWidget) =>
      colors != oldWidget.colors || reducedMotion != oldWidget.reducedMotion;
}

/// The app-wide header control (account, backup, updates), provided by the
/// shell and placed by each page header so it scrolls with the page.
class PocketHeaderAction extends InheritedWidget {
  const PocketHeaderAction({
    super.key,
    required this.action,
    required super.child,
  });

  final Widget action;

  static Widget? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<PocketHeaderAction>()?.action;

  @override
  bool updateShouldNotify(PocketHeaderAction oldWidget) =>
      action != oldWidget.action;
}

/// Raised card on the page surface: a hairline and, on paper, a small
/// neutral shadow. Interactive cards press down slightly.
class PocketCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  const PocketCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
  });
  @override
  State<PocketCard> createState() => _PocketCardState();
}

class _PocketCardState extends State<PocketCard> {
  bool down = false;
  void pressed(bool v) {
    if (widget.onTap == null || down == v) return;
    setState(() => down = v);
  }

  @override
  Widget build(BuildContext context) {
    final skin = PocketSkin.of(context), p = skin.colors;
    final r = BorderRadius.circular(HaizRadius.card);
    return AnimatedScale(
      scale: widget.onTap != null && down && !skin.reducedMotion ? .98 : 1,
      duration: HaizMotion.of(context, HaizMotion.fast),
      curve: HaizMotion.ease,
      child: Semantics(
        button: widget.onTap != null,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: widget.onTap == null ? null : (_) => pressed(true),
          onTapCancel: widget.onTap == null ? null : () => pressed(false),
          onTapUp: widget.onTap == null ? null : (_) => pressed(false),
          onTap: widget.onTap,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: p.card,
              borderRadius: r,
              border: Border.all(color: p.border, width: 1),
              boxShadow: p.dark
                  ? null
                  : const [
                      BoxShadow(
                        color: Color(0x0D000000),
                        blurRadius: 2,
                        offset: Offset(0, 1),
                      ),
                    ],
            ),
            child: ClipRRect(
              borderRadius: r,
              child: Padding(padding: widget.padding, child: widget.child),
            ),
          ),
        ),
      ),
    );
  }
}

/// Small label above a block. Sentence case, muted, no tracking.
class Eyebrow extends StatelessWidget {
  final String text;
  const Eyebrow(this.text, {super.key});
  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Text(
      text,
      style: HaizType.meta(p).copyWith(fontWeight: FontWeight.w500),
    );
  }
}

class PageTitle extends StatelessWidget {
  final String title;
  final String subtitle;
  const PageTitle({super.key, required this.title, required this.subtitle});
  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: HaizType.title(p)),
        const SizedBox(height: 8),
        Text(subtitle, style: HaizType.secondary(p)),
      ],
    );
  }
}

class SectionLabel extends StatelessWidget {
  final String title;
  final String trailing;
  const SectionLabel(this.title, {super.key, this.trailing = ''});
  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Flexible(child: Text(title, style: HaizType.section(p))),
        if (trailing.isNotEmpty) ...[
          const SizedBox(width: 12),
          Text(trailing, style: HaizType.meta(p)),
        ],
      ],
    );
  }
}

/// Button with an icon. Filled is the one primary action on a screen;
/// the quiet variant is a raised surface with a hairline.
class PocketPill extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final IconData icon;
  final bool filled;
  const PocketPill({
    super.key,
    required this.label,
    required this.onTap,
    this.icon = Icons.arrow_forward_rounded,
    this.filled = true,
  });
  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final ink = filled ? p.onAccent : p.foreground;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(HaizRadius.control),
      side: filled ? BorderSide.none : BorderSide(color: p.border),
    );
    return Material(
      color: filled ? p.accent : p.raised,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: ink),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: TextStyle(
                    color: ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Five-zone floating navigation: a translucent raised surface with a
/// hairline. The selection is a flat surface step that keeps its momentum
/// across interruptions; content never waits for the animation.
class GlassDock extends StatefulWidget {
  final int index;
  final ValueChanged<int> onChange;
  const GlassDock({super.key, required this.index, required this.onChange});
  static const icons = [
    Icons.wb_sunny_outlined,
    Icons.calendar_view_week_outlined,
    Icons.inbox_outlined,
    Icons.timer_outlined,
    Icons.map_outlined,
  ];
  static const names = ['今天', '课表', '收件', '专注', '校园'];
  @override
  State<GlassDock> createState() => _GlassDockState();
}

class _GlassDockState extends State<GlassDock>
    with SingleTickerProviderStateMixin {
  late final AnimationController indicator = AnimationController.unbounded(
    vsync: this,
    value: widget.index.toDouble(),
  );
  @override
  void didUpdateWidget(covariant GlassDock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.index != widget.index) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) aimAt(widget.index);
      });
    }
  }

  void aimAt(int v) {
    if (PocketSkin.of(context).reducedMotion) {
      indicator.value = v.toDouble();
      return;
    }
    // Critically damped: no overshoot.
    indicator.animateWith(
      SpringSimulation(
        const SpringDescription(mass: 1, stiffness: 520, damping: 46),
        indicator.value,
        v.toDouble(),
        indicator.velocity,
      ),
    );
  }

  @override
  void dispose() {
    indicator.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final reduced = PocketSkin.of(context).reducedMotion;
    const inset = 4.0;
    final shape = BorderRadius.circular(HaizRadius.dock);
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 448),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: shape,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: p.dark ? .32 : .08),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: shape,
                child: OpticalBackdrop(
                  dark: p.dark,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: p.glass,
                      borderRadius: shape,
                      border: Border.all(color: p.border),
                    ),
                    child: LayoutBuilder(
                      builder: (context, c) {
                        final cell =
                            (c.maxWidth - inset * 2) / GlassDock.names.length;
                        return SizedBox(
                          height: 64,
                          child: Stack(
                            children: [
                              AnimatedBuilder(
                                animation: indicator,
                                builder: (context, _) => Positioned(
                                  top: inset,
                                  bottom: inset,
                                  width: cell,
                                  left: inset + indicator.value * cell,
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      color: p.foreground.withValues(
                                        alpha: p.dark ? .08 : .06,
                                      ),
                                      borderRadius: BorderRadius.circular(
                                        HaizRadius.dock - inset,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: inset,
                                ),
                                child: Row(
                                  children: [
                                    for (
                                      int i = 0;
                                      i < GlassDock.names.length;
                                      i++
                                    )
                                      Expanded(
                                        child: _DockItem(
                                          index: i,
                                          selected: widget.index == i,
                                          reduced: reduced,
                                          onTap: () {
                                            if (widget.index == i) return;
                                            if (defaultTargetPlatform ==
                                                TargetPlatform.iOS) {
                                              HapticFeedback.selectionClick();
                                            }
                                            widget.onChange(i);
                                          },
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
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

class _DockItem extends StatelessWidget {
  const _DockItem({
    required this.index,
    required this.selected,
    required this.reduced,
    required this.onTap,
  });

  final int index;
  final bool selected;
  final bool reduced;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final ink = selected ? p.accent : p.muted;
    return Semantics(
      selected: selected,
      button: true,
      label: GlassDock.names[index],
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: TweenAnimationBuilder<Color?>(
          tween: ColorTween(end: ink),
          duration: reduced ? Duration.zero : HaizMotion.fast,
          curve: HaizMotion.ease,
          builder: (context, color, _) => Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(GlassDock.icons[index], size: 22, color: color),
              const SizedBox(height: 4),
              Text(
                GlassDock.names[index],
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  height: 1.2,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
