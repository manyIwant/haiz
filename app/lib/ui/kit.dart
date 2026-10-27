import 'dart:ui';

import 'package:flutter/material.dart';

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

  static PocketPalette forName(String name) {
    switch (name) {
      case 'obsidian':
        return const PocketPalette(
          Color(0xFF101521),
          Color(0xFF1D2532),
          Color(0xFFF4F3EE),
          Color(0xFFABB6C6),
          Color(0xFF8CC8B6),
          Color(0xFF384450),
          true,
        );
      case 'ocean':
        return const PocketPalette(
          Color(0xFF0C242A),
          Color(0xFF15373E),
          Color(0xFFF0F6F2),
          Color(0xFFACC8C9),
          Color(0xFF8DD9C9),
          Color(0xFF356268),
          true,
        );
      default:
        return const PocketPalette(
          Color(0xFFF5F3EF),
          Color(0xFFFFFFFF),
          Color(0xFF25342F),
          Color(0xFF77877F),
          Color(0xFF307F69),
          Color(0xFFE4E8E3),
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

class PocketCard extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Material(
      color: p.card,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: p.border.withValues(alpha: 0.78)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: p.dark ? .10 : .025),
                blurRadius: 20,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: child,
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
        color: p.secondary,
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 2.2,
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
            fontWeight: FontWeight.w700,
            fontSize: 36,
            letterSpacing: -1.35,
            height: 1.25,
          ),
        ),
        const SizedBox(height: 7),
        Text(subtitle, style: TextStyle(color: p.secondary, fontSize: 13.5)),
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
    this.icon = Icons.arrow_forward_rounded,
    this.filled = true,
  });
  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return FilledButton.icon(
      onPressed: onTap,
      style: FilledButton.styleFrom(
        backgroundColor: filled ? p.accent : p.border.withValues(alpha: .45),
        foregroundColor: filled
            ? (p.dark ? p.background : Colors.white)
            : p.foreground,
        elevation: 0,
        minimumSize: const Size(116, 47),
        shape: const StadiumBorder(),
      ),
      icon: Icon(icon, size: 18),
      label: Text(label),
    );
  }
}

class GlassDock extends StatelessWidget {
  final int index;
  final ValueChanged<int> onChange;
  const GlassDock({super.key, required this.index, required this.onChange});
  static const icons = [
    Icons.today_outlined,
    Icons.calendar_month_outlined,
    Icons.inbox_outlined,
    Icons.hourglass_bottom_outlined,
    Icons.grid_view_rounded,
  ];
  static const names = ['今天', '课表', '收件', '专注', '探索'];
  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final reduce = PocketSkin.of(context).reducedMotion;
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 450),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(31),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: p.card.withValues(alpha: p.dark ? .81 : .88),
                    borderRadius: BorderRadius.circular(31),
                    border: Border.all(color: p.border.withValues(alpha: .65)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: .09),
                        blurRadius: 24,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      for (int i = 0; i < icons.length; i++)
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => onChange(i),
                            child: AnimatedContainer(
                              duration: Duration(
                                milliseconds: reduce ? 0 : 290,
                              ),
                              curve: Curves.easeOutCubic,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: index == i
                                    ? p.accent.withValues(alpha: .13)
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(25),
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    icons[i],
                                    size: 21,
                                    color: index == i ? p.accent : p.secondary,
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    names[i],
                                    style: TextStyle(
                                      fontSize: 11,
                                      letterSpacing: .3,
                                      color: index == i
                                          ? p.accent
                                          : p.secondary,
                                      fontWeight: index == i
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
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
