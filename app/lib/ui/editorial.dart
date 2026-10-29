import 'package:flutter/material.dart';

import 'kit.dart';

/// Shared visual language with haiz.space's editorial pages.
/// Photography is bundled so the landing experience works offline.
class EditorialMasthead extends StatelessWidget {
  const EditorialMasthead({super.key, required this.chapter, this.trailing});

  final String chapter;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Row(
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
            fontSize: 20,
            fontWeight: FontWeight.w700,
            letterSpacing: -1.1,
          ),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Text(
            chapter.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.3,
              color: p.secondary,
            ),
          ),
        ),
        if (trailing case final Widget action) action,
      ],
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
        Text(
          title,
          style: TextStyle(
            fontFamily: 'serif',
            fontSize: 37,
            letterSpacing: -1.6,
            height: 1.22,
            fontWeight: FontWeight.w500,
            color: p.foreground,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 9),
          Text(
            subtitle!,
            style: TextStyle(color: p.secondary, fontSize: 13, height: 1.65),
          ),
        ],
      ],
    );
  }
}

/// Photographic entry shared by home and campus: one image, one action.
class CampusPhotoPanel extends StatelessWidget {
  const CampusPhotoPanel({
    super.key,
    required this.asset,
    required this.eyebrow,
    required this.title,
    required this.caption,
    required this.actionLabel,
    required this.onTap,
    this.height = 228,
  });

  final String asset;
  final String eyebrow;
  final String title;
  final String caption;
  final String actionLabel;
  final VoidCallback onTap;
  final double height;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Semantics(
      button: true,
      label: '$title，$actionLabel',
      child: Material(
        clipBehavior: Clip.antiAlias,
        borderRadius: BorderRadius.circular(14),
        color: const Color(0xFF253A32),
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
                      const ColoredBox(color: Color(0xFF253A32)),
                ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x480D211B), Color(0xDC0D211B)],
                      stops: [.03, 1],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(21, 20, 21, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        eyebrow.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 10,
                          letterSpacing: 1.8,
                          color: Color(0xFFE6E8DD),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        title,
                        style: const TextStyle(
                          fontFamily: 'serif',
                          fontSize: 27,
                          color: Color(0xFFF8F3E9),
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        caption,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFFDFE6DB),
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 17),
                      Row(
                        children: [
                          Text(
                            actionLabel,
                            style: const TextStyle(
                              color: Color(0xFFF8F3E9),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 7),
                          const Icon(
                            Icons.arrow_outward_rounded,
                            size: 17,
                            color: Color(0xFFF8F3E9),
                          ),
                          const Spacer(),
                          Container(
                            height: 1,
                            width: 35,
                            color: p.dark
                                ? const Color(0xFFA9B9AA)
                                : const Color(0xFFDFE6DB),
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
        borderRadius: BorderRadius.circular(8),
        child: Container(
          constraints: const BoxConstraints(minHeight: 76),
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: p.border, width: .8)),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 37,
                child: Text(
                  number,
                  style: TextStyle(fontSize: 10, color: p.secondary),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: p.foreground,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: p.secondary,
                        fontSize: 11.5,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
              if (status != null)
                Text(
                  status!,
                  style: TextStyle(color: p.secondary, fontSize: 10.5),
                )
              else
                Icon(
                  external ? Icons.north_east_rounded : Icons.chevron_right,
                  color: p.accent,
                  size: 18,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
