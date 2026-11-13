import 'package:flutter/material.dart';

import 'kit.dart';

/// Shared visual language with haiz.space's editorial pages.
/// Photography is bundled so the landing experience works offline.
///
/// The masthead carries the app's one signature detail: a chapter number
/// beside the wordmark, the same numbering the haiz.space pages use.
class EditorialMasthead extends StatelessWidget {
  const EditorialMasthead({
    super.key,
    required this.number,
    required this.chapter,
    this.trailing,
  });

  final String number;
  final String chapter;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return SizedBox(
      height: 48,
      child: Row(
        children: [
          Text.rich(
            TextSpan(
              text: 'haiz',
              children: [
                TextSpan(
                  text: '.space',
                  style: TextStyle(color: p.accent),
                ),
              ],
            ),
            style: TextStyle(
              color: p.foreground,
              fontSize: 18,
              height: 1,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ChapterMark(number: number, label: chapter),
          ),
          if (trailing case final Widget action) action,
          if (PocketHeaderAction.maybeOf(context) case final Widget menu) ...[
            const SizedBox(width: 8),
            menu,
          ],
        ],
      ),
    );
  }
}

/// Header for pages opened from a tab: a back link to the tab, then the
/// chapter mark. Sits in the same 48px row as the masthead.
class SubpageHeader extends StatelessWidget {
  const SubpageHeader({
    super.key,
    required this.number,
    required this.chapter,
    required this.onBack,
    this.backLabel = '校园',
  });

  final String number;
  final String chapter;
  final VoidCallback onBack;
  final String backLabel;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return SizedBox(
      height: 48,
      child: Row(
        children: [
          TextButton.icon(
            style: TextButton.styleFrom(
              foregroundColor: p.secondary,
              padding: const EdgeInsets.only(left: 4, right: 12),
            ),
            onPressed: onBack,
            icon: const Icon(Icons.chevron_left_rounded, size: 20),
            label: Text(backLabel),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: ChapterMark(number: number, label: chapter),
          ),
          if (PocketHeaderAction.maybeOf(context) case final Widget menu) menu,
        ],
      ),
    );
  }
}

/// `01 今天`: a tabular chapter number and its name, both muted.
class ChapterMark extends StatelessWidget {
  const ChapterMark({super.key, required this.number, required this.label});

  final String number;
  final String label;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final style = HaizType.meta(p);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: number),
          const TextSpan(text: '  '),
          TextSpan(
            text: label,
            style: TextStyle(color: p.secondary),
          ),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: style,
    );
  }
}

class EditorialHeading extends StatelessWidget {
  const EditorialHeading({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: HaizType.title(p)),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(subtitle!, style: HaizType.secondary(p)),
        ],
      ],
    );
  }
}

/// Photographic entry shared by home and campus: one image, one action.
/// This is the screen's bright element; everything around it stays quiet.
class CampusPhotoPanel extends StatelessWidget {
  const CampusPhotoPanel({
    super.key,
    required this.asset,
    required this.place,
    required this.title,
    required this.caption,
    required this.actionLabel,
    required this.onTap,
    this.height = 232,
  });

  final String asset;

  /// Where the photograph was taken, shown quietly in the top corner.
  final String place;
  final String title;
  final String caption;
  final String actionLabel;
  final VoidCallback onTap;
  final double height;

  static const _ink = Color(0xFFF7F4EE);
  static const _inkSoft = Color(0xFFDCD8CF);

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$title，$actionLabel',
      child: Material(
        clipBehavior: Clip.antiAlias,
        borderRadius: BorderRadius.circular(HaizRadius.card),
        color: const Color(0xFF1E2622),
        child: InkWell(
          onTap: onTap,
          child: SizedBox(
            height: height,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  asset,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) =>
                      const ColoredBox(color: Color(0xFF1E2622)),
                ),
                // Neutral scrim so the text sits on calm, dark space.
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0x73000000),
                        Color(0x00000000),
                        Color(0x00000000),
                        Color(0xB3000000),
                      ],
                      stops: [0, .28, .4, 1],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        place,
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: _inkSoft,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        title,
                        style: const TextStyle(
                          fontFamily: 'serif',
                          fontSize: 26,
                          color: _ink,
                          height: 1.2,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        caption,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          color: _inkSoft,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Text(
                            actionLabel,
                            style: const TextStyle(
                              color: _ink,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.arrow_forward_rounded,
                            size: 16,
                            color: _ink,
                          ),
                        ],
                      ),
                    ],
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

/// One-row list item instead of a stack of decorative cards.
class EditorialLinkRow extends StatelessWidget {
  const EditorialLinkRow({
    super.key,
    required this.number,
    required this.title,
    required this.subtitle,
    this.onTap,
    this.external = false,
    this.status,
  });

  final String number;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool external;
  final String? status;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Semantics(
      button: onTap != null,
      enabled: onTap != null,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(HaizRadius.inner),
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: p.border)),
          ),
          child: Row(
            children: [
              SizedBox(width: 32, child: Text(number, style: HaizType.meta(p))),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: HaizType.itemTitle(p)),
                    const SizedBox(height: 4),
                    Text(subtitle, style: HaizType.secondary(p)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              if (status != null)
                Text(status!, style: HaizType.meta(p))
              else
                Icon(
                  external
                      ? Icons.arrow_outward_rounded
                      : Icons.chevron_right_rounded,
                  color: p.muted,
                  size: 18,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
