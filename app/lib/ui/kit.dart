import 'optical_backdrop.dart';

import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';

class PocketPalette {
  final Color background;
  final Color card;
  final Color foreground;
  final Color secondary;
  final Color accent;
  final Color border;
  final bool dark;
  const PocketPalette(
    this.background,
    this.card,
    this.foreground,
    this.secondary,
    this.accent,
    this.border,
    this.dark,
  );

  Color get grouped => dark ? const Color(0xFF202A29) : const Color(0xFFEEEEE4);
  Color get tertiary =>
      dark ? const Color(0xFF34423D) : const Color(0xFFE6E6DB);
  Color get glass => dark ? const Color(0x58192824) : const Color(0x48F7F3EB);
  Color get shadow => dark ? const Color(0x30000000) : const Color(0x12293F36);
  static PocketPalette forName(String name) {
    switch (name) {
      case 'obsidian':
        return const PocketPalette(
          Color(0xFF141F20),
          Color(0xFF21302F),
          Color(0xFFF3EFE6),
          Color(0xFFB3BFB7),
          Color(0xFFD7AC88),
          Color(0xFF3E504B),
          true,
        );
      case 'ocean':
        return const PocketPalette(
          Color(0xFF0C2228),
          Color(0xFF18343B),
          Color(0xFFE9F1E9),
          Color(0xFFB9C9C7),
          Color(0xFF9AC8B8),
          Color(0xFF355B60),
          true,
        );
      default:
        return const PocketPalette(
          Color(0xFFF7F3EB),
          Color(0xFFFFFDF7),
          Color(0xFF293F36),
          Color(0xFF6A756C),
          Color(0xFF966548),
          Color(0xFFDEDCCF),
          false,
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
  @override
  bool updateShouldNotify(PocketSkin oldWidget) =>
      colors != oldWidget.colors || reducedMotion != oldWidget.reducedMotion;
}

/// Inset grouped surface. Interactive cards respond with a small press scale.
class PocketCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  const PocketCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
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
    final r = BorderRadius.circular(14);
    return AnimatedScale(
      scale: widget.onTap != null && down && !skin.reducedMotion ? .989 : 1,
      duration: Duration(milliseconds: skin.reducedMotion ? 0 : 145),
      curve: Curves.easeOutCubic,
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
              border: Border.all(
                color: p.border.withValues(alpha: p.dark ? 0.5 : 0.64),
                width: .8,
              ),
              boxShadow: [
                BoxShadow(
                  color: p.shadow.withValues(alpha: p.dark ? 0.24 : 0.48),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
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

class Eyebrow extends StatelessWidget {
  final String text;
  const Eyebrow(this.text, {super.key});
  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        color: p.accent,
        fontSize: 10.5,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.9,
      ),
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
        Text(
          title,
          style: TextStyle(
            color: p.foreground,
            fontFamily: 'serif',
            fontWeight: FontWeight.w500,
            fontSize: 34,
            letterSpacing: -1.35,
            height: 1.22,
          ),
        ),
        const SizedBox(height: 9),
        Text(
          subtitle,
          style: TextStyle(color: p.secondary, fontSize: 13, height: 1.55),
        ),
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
      children: [
        Text(
          title,
          style: TextStyle(
            color: p.foreground,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (trailing.isNotEmpty)
          Text(trailing, style: TextStyle(color: p.secondary, fontSize: 12)),
      ],
    );
  }
}

class PocketPill extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final IconData icon;
  final bool filled;
  const PocketPill({
    super.key,
    required this.label,
    required this.onTap,
    this.icon = CupertinoIcons.arrow_right,
    this.filled = true,
  });
  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return CupertinoButton(
      onPressed: onTap,
      color: filled ? p.accent : p.tertiary,
      borderRadius: BorderRadius.circular(15),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 17, color: filled ? Colors.white : p.foreground),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: filled ? Colors.white : p.foreground,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Five-zone floating navigation. The selected glass layer maintains momentum
/// across interruptions; the selected content never has to wait for animation.
class GlassDock extends StatefulWidget {
  final int index;
  final ValueChanged<int> onChange;
  const GlassDock({super.key, required this.index, required this.onChange});
  static const icons = [
    CupertinoIcons.house,
    CupertinoIcons.calendar,
    CupertinoIcons.tray,
    CupertinoIcons.timer,
    CupertinoIcons.map,
  ];
  static const selectedIcons = [
    CupertinoIcons.house_fill,
    CupertinoIcons.calendar,
    CupertinoIcons.tray_fill,
    CupertinoIcons.timer_fill,
    CupertinoIcons.map_fill,
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
    indicator.animateWith(
      SpringSimulation(
        const SpringDescription(mass: 1, stiffness: 520, damping: 43),
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
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: 11),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 450),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(29),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: p.dark ? .34 : .17),
                    blurRadius: 26,
                    spreadRadius: -5,
                    offset: const Offset(0, 16),
                  ),
                  BoxShadow(
                    color: p.accent.withValues(alpha: p.dark ? 0.13 : 0.09),
                    blurRadius: 29,
                    spreadRadius: -2,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(29),
                child: OpticalBackdrop(
                  dark: p.dark,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          p.glass.withValues(alpha: p.dark ? .48 : .29),
                          p.glass.withValues(alpha: p.dark ? .30 : .16),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(29),
                      border: Border.all(
                        width: 1.0,
                        color: p.dark
                            ? Colors.white.withValues(alpha: .14)
                            : Colors.white.withValues(alpha: .61),
                      ),
                    ),
                    child: LayoutBuilder(
                      builder: (context, c) {
                        final cell = (c.maxWidth - 10) / GlassDock.names.length;
                        return SizedBox(
                          height: 66,
                          child: Stack(
                            children: [
                              Positioned.fill(
                                child: OpticalGlassSheen(dark: p.dark),
                              ),
                              AnimatedBuilder(
                                animation: indicator,
                                builder: (context, _) {
                                  return Positioned(
                                    top: 5,
                                    bottom: 5,
                                    width: cell,
                                    left: 5 + indicator.value * cell,
                                    child: DecoratedBox(
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: [
                                            Colors.white.withValues(
                                              alpha: p.dark ? .21 : .55,
                                            ),
                                            p.accent.withValues(
                                              alpha: p.dark ? .22 : .14,
                                            ),
                                            Colors.white.withValues(
                                              alpha: p.dark ? .09 : .29,
                                            ),
                                          ],
                                        ),
                                        borderRadius: BorderRadius.circular(23),
                                        border: Border.all(
                                          color: Colors.white.withValues(
                                            alpha: p.dark ? .20 : .49,
                                          ),
                                          width: 0.9,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withValues(
                                              alpha: p.dark ? .17 : .07,
                                            ),
                                            blurRadius: 9,
                                            spreadRadius: -4,
                                            offset: const Offset(0, 3),
                                          ),
                                        ],
                                      ),
                                      child: OpticalGlassSheen(
                                        dark: p.dark,
                                        selected: true,
                                        radius: 23,
                                      ),
                                    ),
                                  );
                                },
                              ),
                              Row(
                                children: [
                                  for (
                                    int i = 0;
                                    i < GlassDock.names.length;
                                    i++
                                  )
                                    Expanded(
                                      child: Semantics(
                                        selected: widget.index == i,
                                        button: true,
                                        label: GlassDock.names[i],
                                        child: GestureDetector(
                                          behavior: HitTestBehavior.opaque,
                                          onTap: () {
                                            if (widget.index == i) return;
                                            if (defaultTargetPlatform ==
                                                TargetPlatform.iOS) {
                                              HapticFeedback.selectionClick();
                                            }
                                            widget.onChange(i);
                                          },
                                          child: Column(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              AnimatedSwitcher(
                                                duration: Duration(
                                                  milliseconds: reduced
                                                      ? 0
                                                      : 130,
                                                ),
                                                child: Icon(
                                                  widget.index == i
                                                      ? GlassDock
                                                            .selectedIcons[i]
                                                      : GlassDock.icons[i],
                                                  key: ValueKey(
                                                    widget.index == i,
                                                  ),
                                                  size: 22,
                                                  color: widget.index == i
                                                      ? p.accent
                                                      : p.secondary,
                                                ),
                                              ),
                                              const SizedBox(height: 5),
                                              Text(
                                                GlassDock.names[i],
                                                style: TextStyle(
                                                  color: widget.index == i
                                                      ? p.accent
                                                      : p.secondary,
                                                  fontSize: 10.3,
                                                  letterSpacing: -.2,
                                                  fontWeight: widget.index == i
                                                      ? FontWeight.w700
                                                      : FontWeight.w500,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
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
