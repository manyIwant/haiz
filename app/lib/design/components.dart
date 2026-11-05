import 'dart:ui' show PathMetric;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import 'theme.dart';
import 'tokens.dart';

/// Light haptics only for commits (complete, start focus), never for hover.
void haizHaptic([bool strong = false]) {
  if (kIsWeb) return;
  if (defaultTargetPlatform != TargetPlatform.iOS &&
      defaultTargetPlatform != TargetPlatform.android) {
    return;
  }
  strong ? HapticFeedback.mediumImpact() : HapticFeedback.lightImpact();
}

/// Row-level press feedback: the row's ground darkens immediately on touch
/// (no scale, no ripple) so dense lists stay calm and precise.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.radius = 0,
    this.padding = EdgeInsets.zero,
    this.semanticLabel,
    this.color,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double radius;
  final EdgeInsetsGeometry padding;
  final String? semanticLabel;
  final Color? color;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;
  bool _hover = false;

  void _set(bool value) {
    if (_down != value && mounted) setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final enabled = widget.onTap != null || widget.onLongPress != null;
    final ground = _down
        ? c.raised
        : _hover && enabled
            ? c.raised.withValues(alpha: .45)
            : (widget.color ?? Colors.transparent);
    return Semantics(
      container: true,
      button: enabled,
      label: widget.semanticLabel,
      excludeSemantics: widget.semanticLabel != null,
      child: MouseRegion(
        cursor: enabled ? SystemMouseCursors.click : MouseCursor.defer,
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = false),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: enabled ? (_) => _set(true) : null,
          onTapUp: enabled ? (_) => _set(false) : null,
          onTapCancel: enabled ? () => _set(false) : null,
          onTap: widget.onTap,
          onLongPress: widget.onLongPress,
          child: AnimatedContainer(
            duration: _down ? Duration.zero : context.haiz.motion(Motion.fast),
            curve: Motion.standard,
            padding: widget.padding,
            decoration: BoxDecoration(
              color: ground,
              borderRadius: BorderRadius.circular(widget.radius),
            ),
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

/// Buttons scale slightly under the finger; the action commits on release.
class HaizButton extends StatefulWidget {
  const HaizButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.kind = HaizButtonKind.primary,
    this.expand = false,
    this.dense = false,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final HaizButtonKind kind;
  final bool expand;
  final bool dense;
  final bool busy;

  @override
  State<HaizButton> createState() => _HaizButtonState();
}

enum HaizButtonKind { primary, secondary, quiet, danger }

class _HaizButtonState extends State<HaizButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final enabled = widget.onPressed != null && !widget.busy;
    final (bg, fg, border) = switch (widget.kind) {
      HaizButtonKind.primary => (c.inverse, c.onInverse, Colors.transparent),
      HaizButtonKind.secondary => (Colors.transparent, c.ink, c.ruleStrong),
      HaizButtonKind.quiet => (c.raised.withValues(alpha: .7), c.ink, Colors.transparent),
      HaizButtonKind.danger => (Colors.transparent, c.late, c.late.withValues(alpha: .4)),
    };
    final height = widget.dense ? 36.0 : 46.0;
    final content = Row(
      mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.busy)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: SizedBox.square(
              dimension: 14,
              child: CircularProgressIndicator(strokeWidth: 1.6, color: fg),
            ),
          )
        else if (widget.icon != null)
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: Icon(widget.icon, size: widget.dense ? 17 : 19, color: enabled ? fg : c.ink3),
          ),
        Flexible(
          child: Text(
            widget.label,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: widget.dense ? 14 : 15,
              fontWeight: FontWeight.w600,
              color: enabled ? fg : c.ink3,
            ),
          ),
        ),
      ],
    );
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      excludeSemantics: true,
      child: GestureDetector(
        onTapDown: enabled ? (_) => setState(() => _down = true) : null,
        onTapUp: enabled ? (_) => setState(() => _down = false) : null,
        onTapCancel: enabled ? () => setState(() => _down = false) : null,
        onTap: enabled ? widget.onPressed : null,
        child: MouseRegion(
          cursor: enabled ? SystemMouseCursors.click : SystemMouseCursors.basic,
          child: AnimatedScale(
            scale: _down && !context.haiz.reduceMotion ? .97 : 1,
            duration: Motion.press,
            curve: Motion.standard,
            child: AnimatedContainer(
              duration: context.haiz.motion(Motion.fast),
              height: height,
              padding: EdgeInsets.symmetric(horizontal: widget.dense ? 14 : 18),
              decoration: BoxDecoration(
                color: enabled || widget.kind != HaizButtonKind.primary ? bg : c.raised,
                borderRadius: BorderRadius.circular(Radii.control),
                border: Border.all(color: border, width: 1),
              ),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}

/// The completion mark: a red-pen tick drawn through the circle, the way a
/// teacher marks work as done. The circle itself stays quiet.
class HaizCheck extends StatefulWidget {
  const HaizCheck({
    super.key,
    required this.checked,
    required this.onChanged,
    this.label,
    this.color,
  });

  final bool checked;
  final ValueChanged<bool>? onChanged;
  final String? label;
  final Color? color;

  @override
  State<HaizCheck> createState() => _HaizCheckState();
}

class _HaizCheckState extends State<HaizCheck> with SingleTickerProviderStateMixin {
  late final AnimationController _draw = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
    value: widget.checked ? 1 : 0,
  );

  @override
  void didUpdateWidget(covariant HaizCheck old) {
    super.didUpdateWidget(old);
    if (old.checked == widget.checked) return;
    if (context.haiz.reduceMotion) {
      _draw.value = widget.checked ? 1 : 0;
    } else if (widget.checked) {
      _draw.forward(from: 0);
    } else {
      _draw.reverse();
    }
  }

  @override
  void dispose() {
    _draw.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Semantics(
      container: true,
      checked: widget.checked,
      label: widget.label,
      button: true,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onChanged == null ? null : () {
          if (!widget.checked) haizHaptic();
          widget.onChanged!(!widget.checked);
        },
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          child: SizedBox.square(
            dimension: 44,
            child: Center(
              child: AnimatedBuilder(
                animation: _draw,
                builder: (context, _) => CustomPaint(
                  size: const Size.square(22),
                  painter: _TickPainter(
                    progress: Motion.enter.transform(_draw.value),
                    ring: widget.color ?? c.ruleStrong,
                    ringDone: c.rule,
                    tick: c.signal,
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

class _TickPainter extends CustomPainter {
  _TickPainter({required this.progress, required this.ring, required this.ringDone, required this.tick});
  final double progress;
  final Color ring;
  final Color ringDone;
  final Color tick;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    canvas.drawCircle(
      Offset(r, r),
      r - .9,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = Color.lerp(ring, ringDone, progress)!,
    );
    if (progress <= 0) return;
    // The tick overshoots the ring at the top right, like a pen stroke.
    final w = size.width;
    final path = Path()
      ..moveTo(w * .2, w * .52)
      ..quadraticBezierTo(w * .32, w * .62, w * .42, w * .78)
      ..quadraticBezierTo(w * .66, w * .32, w * 1.06, w * .02);
    final metric = path.computeMetrics().fold<List<PathMetric>>([], (l, m) => l..add(m));
    final total = metric.fold<double>(0, (s, m) => s + m.length);
    var remaining = total * progress;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.3
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = tick;
    for (final m in metric) {
      final len = remaining.clamp(0, m.length).toDouble();
      canvas.drawPath(m.extractPath(0, len), paint);
      remaining -= len;
      if (remaining <= 0) break;
    }
  }

  @override
  bool shouldRepaint(_TickPainter old) =>
      old.progress != progress || old.ring != ring || old.tick != tick;
}

/// Section heading for grouped lists: a label, an optional count and a
/// trailing action. No icons, no English eyebrows.
class SectionHeader extends StatelessWidget {
  const SectionHeader(
    this.label, {
    super.key,
    this.count,
    this.trailing,
    this.emphasis = false,
    this.padding = const EdgeInsets.fromLTRB(Space.gutter, 22, Space.gutter, 6),
  });

  final String label;
  final int? count;
  final Widget? trailing;
  final bool emphasis;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Semantics(
            header: true,
            child: Text(label, style: TypeScale.label(emphasis ? c.late : c.ink2)),
          ),
          if (count != null) ...[
            const SizedBox(width: 6),
            Text('$count', style: TypeScale.label(emphasis ? c.late : c.ink3)),
          ],
          const Spacer(),
          ?trailing,
        ],
      ),
    );
  }
}

/// A full-width hairline, optionally inset to align with row text.
class Hairline extends StatelessWidget {
  const Hairline({super.key, this.indent = 0, this.endIndent = 0});
  final double indent;
  final double endIndent;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(left: indent, right: endIndent),
    child: SizedBox(height: .6, child: ColoredBox(color: context.c.rule)),
  );
}

/// Subject marker: a small square of the subject hue beside its name.
class SubjectMark extends StatelessWidget {
  const SubjectMark(this.subject, {super.key, this.showLabel = true});
  final String subject;
  final bool showLabel;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(
            color: subjectColor(subject, dark: c.dark),
            borderRadius: BorderRadius.circular(1.5),
          ),
        ),
        if (showLabel) ...[
          const SizedBox(width: 5),
          Text(subject, style: TypeScale.caption(c.ink2)),
        ],
      ],
    );
  }
}

/// Selectable chip: hairline at rest, ink when chosen.
class HaizChip extends StatelessWidget {
  const HaizChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.leading,
    this.tone,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final Widget? leading;

  /// Optional emphasis colour for suggestion chips (e.g. a detected date).
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final fg = selected ? c.onInverse : (tone ?? c.ink);
    return Semantics(
      selected: selected,
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          child: AnimatedContainer(
            duration: context.haiz.motion(Motion.fast),
            curve: Motion.standard,
            height: 34,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: selected ? c.inverse : (tone?.withValues(alpha: .08) ?? Colors.transparent),
              borderRadius: BorderRadius.circular(Radii.chip),
              border: Border.all(
                color: selected ? c.inverse : (tone?.withValues(alpha: .45) ?? c.rule),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (leading != null) ...[
                  IconTheme(data: IconThemeData(size: 15, color: fg), child: leading!),
                  const SizedBox(width: 5),
                ],
                Text(label, style: TypeScale.footnote(fg).copyWith(
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Two- or three-way switch with a sliding ink indicator.
class Segmented<T> extends StatelessWidget {
  const Segmented({super.key, required this.value, required this.items, required this.onChanged});
  final T value;
  final List<(T, String)> items;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final index = items.indexWhere((e) => e.$1 == value).clamp(0, items.length - 1);
    return LayoutBuilder(builder: (context, box) {
      final width = box.maxWidth.isFinite ? box.maxWidth : 72.0 * items.length;
      final cell = (width - 4) / items.length;
      return Container(
        height: 34,
        width: width,
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: c.raised.withValues(alpha: .8),
          borderRadius: BorderRadius.circular(Radii.chip + 1),
        ),
        child: Stack(children: [
          AnimatedPositioned(
            duration: context.haiz.motion(Motion.base),
            curve: Motion.enter,
            left: cell * index,
            top: 0,
            bottom: 0,
            width: cell,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: c.surface,
                borderRadius: BorderRadius.circular(Radii.chip - 1),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: c.dark ? .4 : .08), blurRadius: 3, offset: const Offset(0, 1)),
                ],
              ),
            ),
          ),
          Row(children: [
            for (final (i, item) in items.indexed)
              Expanded(
                child: Semantics(
                  selected: i == index,
                  button: true,
                  label: item.$2,
                  excludeSemantics: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () { if (i != index) onChanged(item.$1); },
                    child: Center(
                      child: Text(item.$2, style: TypeScale.footnote(i == index ? c.ink : c.ink2)
                          .copyWith(fontWeight: i == index ? FontWeight.w600 : FontWeight.w500)),
                    ),
                  ),
                ),
              ),
          ]),
        ]),
      );
    });
  }
}

/// What is here, why it is empty and the next useful action.
class EmptyNote extends StatelessWidget {
  const EmptyNote({super.key, required this.title, this.body, this.action});
  final String title;
  final String? body;
  final Widget? action;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.gutter, 18, Space.gutter, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TypeScale.callout(c.ink2)),
          if (body != null) ...[
            const SizedBox(height: 4),
            Text(body!, style: TypeScale.footnote(c.ink3)),
          ],
          if (action != null) ...[
            const SizedBox(height: 10),
            action!,
          ],
        ],
      ),
    );
  }
}

/// Inline notice for state the user should act on (save failed, offline,
/// permission). It sits in the content flow, never floats over it.
class HaizBanner extends StatelessWidget {
  const HaizBanner({
    super.key,
    required this.message,
    this.tone = BannerTone.neutral,
    this.actions = const [],
    this.icon,
  });

  final String message;
  final BannerTone tone;
  final List<Widget> actions;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final color = switch (tone) {
      BannerTone.neutral => c.ink2,
      BannerTone.warning => c.amber,
      BannerTone.danger => c.late,
      BannerTone.ok => c.green,
    };
    return Container(
      margin: const EdgeInsets.fromLTRB(Space.gutter, 8, Space.gutter, 4),
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: c.dark ? .13 : .07),
        borderRadius: BorderRadius.circular(Radii.control),
        border: Border(left: BorderSide(color: color, width: 2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (icon != null) ...[
              Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, size: 17, color: color)),
              const SizedBox(width: 8),
            ],
            Expanded(child: Text(message, style: TypeScale.footnote(c.ink))),
          ]),
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 6),
            Wrap(spacing: 4, runSpacing: 4, children: actions),
          ],
        ],
      ),
    );
  }
}

enum BannerTone { neutral, warning, danger, ok }

/// Text action inside banners and rows.
class LinkAction extends StatelessWidget {
  const LinkAction(this.label, {super.key, required this.onTap, this.color, this.icon});
  final String label;
  final VoidCallback? onTap;
  final Color? color;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final fg = onTap == null ? c.ink3 : (color ?? c.ink);
    return Pressable(
      onTap: onTap,
      radius: 6,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      semanticLabel: label,
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 16, color: fg), const SizedBox(width: 4)],
        Text(label, style: TypeScale.footnote(fg).copyWith(fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

/// A page with a large title that hands over to a compact pinned bar as it
/// scrolls; the bar gains its hairline only once content passes beneath it.
class HaizPage extends StatefulWidget {
  const HaizPage({
    super.key,
    required this.title,
    required this.slivers,
    this.subtitle,
    this.actions = const [],
    this.leading,
    this.bottomInset = 0,
    this.controller,
    this.storageKey,
  });

  final String title;
  final Widget? subtitle;
  final List<Widget> actions;
  final Widget? leading;
  final List<Widget> slivers;
  final double bottomInset;
  final ScrollController? controller;
  final String? storageKey;

  @override
  State<HaizPage> createState() => _HaizPageState();
}

class _HaizPageState extends State<HaizPage> {
  final _offset = ValueNotifier<double>(0);

  @override
  void dispose() {
    _offset.dispose();
    super.dispose();
  }

  void _track(double pixels) {
    // Scroll positions can be corrected during layout (restored offsets,
    // shrinking content); never rebuild in the middle of a frame.
    if (SchedulerBinding.instance.schedulerPhase == SchedulerPhase.persistentCallbacks) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (mounted) _offset.value = pixels;
      });
    } else {
      _offset.value = pixels;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final top = MediaQuery.paddingOf(context).top;
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n.depth == 0 && n.metrics.axis == Axis.vertical) _track(n.metrics.pixels);
        return false;
      },
      child: CustomScrollView(
        key: widget.storageKey == null ? null : PageStorageKey(widget.storageKey),
        controller: widget.controller,
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        slivers: [
          // A real pinned header: the viewport knows it obstructs content,
          // so focus traversal and ensureVisible never park a row under it.
          SliverPersistentHeader(
            pinned: true,
            delegate: _BarDelegate(
              height: top + 48,
              top: top,
              offset: _offset,
              title: widget.title,
              leading: widget.leading,
              actions: widget.actions,
              colors: c,
              motion: context.haiz.motion(Motion.fast),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: Text(widget.title, style: TypeScale.largeTitle(c.ink))),
                  if (widget.subtitle != null) ...[
                    const SizedBox(height: 4),
                    widget.subtitle!,
                  ],
                ],
              ),
            ),
          ),
          ...widget.slivers,
          // Room for the capture button above the tab bar.
          SliverToBoxAdapter(child: SizedBox(
              height: MediaQuery.paddingOf(context).bottom + widget.bottomInset + 96)),
        ],
      ),
    );
  }
}

class _BarDelegate extends SliverPersistentHeaderDelegate {
  _BarDelegate({
    required this.height,
    required this.top,
    required this.offset,
    required this.title,
    required this.leading,
    required this.actions,
    required this.colors,
    required this.motion,
  });

  final double height;
  final double top;
  final ValueListenable<double> offset;
  final String title;
  final Widget? leading;
  final List<Widget> actions;
  final HaizColors colors;
  final Duration motion;

  @override
  double get minExtent => height;
  @override
  double get maxExtent => height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final c = colors;
    return ValueListenableBuilder<double>(
      valueListenable: offset,
      builder: (context, value, _) {
        final under = value > 2;
        final titleIn = ((value - 30) / 18).clamp(0.0, 1.0);
        return AnimatedContainer(
          duration: motion,
          height: height,
          padding: EdgeInsets.only(top: top, left: 8, right: 8),
          decoration: BoxDecoration(
            color: under ? c.canvas.withValues(alpha: .97) : c.canvas,
            border: Border(bottom: BorderSide(color: under ? c.rule : c.canvas, width: .6)),
          ),
          child: Row(children: [
            SizedBox(width: 44, child: leading),
            Expanded(
              child: ExcludeSemantics(
                excluding: titleIn < .5,
                child: Opacity(
                  opacity: titleIn,
                  child: Text(title, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: TypeScale.headline(c.ink).copyWith(fontSize: 16)),
                ),
              ),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 44),
              child: Row(mainAxisSize: MainAxisSize.min, children: actions),
            ),
          ]),
        );
      },
    );
  }

  @override
  bool shouldRebuild(_BarDelegate old) =>
      old.title != title || old.actions != actions || old.colors != colors ||
      old.height != height || old.leading != leading;
}

/// Quiet 44 × 44 icon action for page bars.
class BarAction extends StatelessWidget {
  const BarAction({super.key, required this.icon, required this.label, required this.onTap, this.badge = false});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool badge;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Tooltip(
      message: label,
      excludeFromSemantics: true,
      child: Pressable(
        onTap: onTap,
        radius: Radii.control,
        semanticLabel: label,
        child: SizedBox.square(
          dimension: 44,
          child: Stack(alignment: Alignment.center, children: [
            Icon(icon, size: 23, color: c.ink),
            if (badge)
              Positioned(
                top: 10,
                right: 9,
                child: Container(width: 7, height: 7,
                    decoration: BoxDecoration(color: c.signal, shape: BoxShape.circle)),
              ),
          ]),
        ),
      ),
    );
  }
}

/// Opens a sheet in the 2.0 style: surface, 20 pt corners, drag handle,
/// keyboard-aware. Sheets are the only "cards" in HAIZ: real layers.
Future<T?> showHaizSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool expand = false,
}) {
  final reduce = HaizTheme.of(context).reduceMotion;
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    sheetAnimationStyle: AnimationStyle(
      duration: reduce ? Duration.zero : Motion.slow,
      reverseDuration: reduce ? Duration.zero : Motion.base,
      curve: Motion.enter,
    ),
    constraints: const BoxConstraints(maxWidth: 640),
    builder: (sheet) {
      final body = Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheet).bottom),
        child: builder(sheet),
      );
      return expand
          ? FractionallySizedBox(heightFactor: .92, child: body)
          : body;
    },
  );
}

/// Height of the floating chrome the toast must clear (set by the shell).
abstract final class ChromeLift {
  static double value = 10;
}

/// Toast with an optional undo. Always says exactly where data went.
void showToast(BuildContext context, String message, {String? action, VoidCallback? onAction, Duration? duration}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(SnackBar(
    // Floats above whatever glass chrome is currently on screen.
    margin: EdgeInsets.fromLTRB(12, 0, 12, ChromeLift.value),
    content: Text(message),
    duration: duration ?? Duration(seconds: action == null ? 3 : 5),
    action: action == null ? null : SnackBarAction(label: action, onPressed: onAction ?? () {}),
  ));
}

/// Gentle first-appearance motion for content that arrives (a new row, a
/// result). Runs once per element; never on rebuilds.
class Arrive extends StatefulWidget {
  const Arrive({super.key, required this.child, this.delay = Duration.zero, this.offset = 6});
  final Widget child;
  final Duration delay;
  final double offset;
  @override
  State<Arrive> createState() => _ArriveState();
}

class _ArriveState extends State<Arrive> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.base);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.status == AnimationStatus.dismissed && !_c.isAnimating) {
      if (context.haiz.reduceMotion) {
        _c.value = 1;
      } else {
        Future<void>.delayed(widget.delay, () { if (mounted) _c.forward(); });
      }
    }
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
      final t = Motion.enter.transform(_c.value);
      return Opacity(
        opacity: t,
        child: Transform.translate(offset: Offset(0, widget.offset * (1 - t)), child: child),
      );
    },
    child: widget.child,
  );
}
