import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'kit.dart';

/// Material theme built from the active [PocketPalette] and HAIZ tokens:
/// controls at 10px radius, cards 16, sheets and dialogs 20; one accent for
/// the primary action and the selection; hairline borders, no glow.
ThemeData buildHaizTheme(PocketPalette p) {
  final apple =
      defaultTargetPlatform == TargetPlatform.iOS ||
      defaultTargetPlatform == TargetPlatform.macOS;
  final bright = p.dark ? Brightness.dark : Brightness.light;
  final control = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(HaizRadius.control),
  );
  const buttonText = TextStyle(fontWeight: FontWeight.w500, fontSize: 15);
  final scheme = ColorScheme.fromSeed(seedColor: p.accent, brightness: bright)
      .copyWith(
        primary: p.accent,
        onPrimary: p.onAccent,
        secondaryContainer: p.raised,
        onSecondaryContainer: p.foreground,
        surface: p.card,
        onSurface: p.foreground,
        onSurfaceVariant: p.secondary,
        surfaceContainerLowest: p.background,
        surfaceContainerLow: p.card,
        surfaceContainer: p.card,
        surfaceContainerHigh: p.card,
        surfaceContainerHighest: p.raised,
        outline: p.border,
        outlineVariant: p.border,
        error: p.negative,
      );
  return ThemeData(
    useMaterial3: true,
    brightness: bright,
    fontFamily: apple ? '.SF Pro Text' : null,
    colorScheme: scheme,
    scaffoldBackgroundColor: p.background,
    canvasColor: p.background,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    hoverColor: p.foreground.withValues(alpha: .04),
    focusColor: p.accent.withValues(alpha: .12),
    dividerColor: p.border,
    dividerTheme: DividerThemeData(color: p.border, thickness: 1, space: 1),
    iconTheme: IconThemeData(color: p.secondary, size: 20),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: p.accent,
      linearTrackColor: p.raised,
      circularTrackColor: p.raised,
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: p.accent,
      inactiveTrackColor: p.tertiary,
      thumbColor: p.card,
      trackHeight: 4,
      overlayColor: p.accent.withValues(alpha: .10),
      thumbShape: const RoundSliderThumbShape(
        enabledThumbRadius: 10,
        elevation: 1,
        pressedElevation: 2,
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: p.raised,
      selectedColor: p.accent.withValues(alpha: p.dark ? .22 : .12),
      side: BorderSide(color: p.border),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(HaizRadius.inner),
      ),
      labelStyle: TextStyle(color: p.foreground, fontSize: 13),
      secondaryLabelStyle: TextStyle(color: p.foreground, fontSize: 13),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      showCheckmark: false,
    ),
    checkboxTheme: CheckboxThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      fillColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? p.accent
            : Colors.transparent,
      ),
      side: BorderSide(color: p.muted, width: 1.5),
      checkColor: WidgetStateProperty.all(p.onAccent),
    ),
    switchTheme: SwitchThemeData(
      trackColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? p.accent : p.tertiary,
      ),
      thumbColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? p.onAccent : p.card,
      ),
      trackOutlineColor: WidgetStateProperty.all(p.border),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.raised,
      hintStyle: TextStyle(color: p.muted, fontSize: 15),
      labelStyle: TextStyle(color: p.secondary, fontSize: 15),
      floatingLabelStyle: TextStyle(color: p.accent, fontSize: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HaizRadius.control),
        borderSide: BorderSide(color: p.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HaizRadius.control),
        borderSide: BorderSide(color: p.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HaizRadius.control),
        borderSide: BorderSide(color: p.accent, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.accent,
        foregroundColor: p.onAccent,
        disabledBackgroundColor: p.raised,
        disabledForegroundColor: p.muted,
        elevation: 0,
        minimumSize: const Size(64, 44),
        shape: control,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        textStyle: buttonText,
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: p.accent,
        minimumSize: const Size(44, 40),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        shape: control,
        textStyle: buttonText,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.foreground,
        backgroundColor: p.raised,
        side: BorderSide(color: p.border),
        minimumSize: const Size(64, 44),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        shape: control,
        textStyle: buttonText,
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(foregroundColor: p.secondary, shape: control),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: p.card,
      elevation: 2,
      shadowColor: p.shadow,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(HaizRadius.control),
        side: BorderSide(color: p.border),
      ),
      textStyle: TextStyle(color: p.foreground, fontSize: 15),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: p.dark ? p.raised : p.foreground,
      contentTextStyle: TextStyle(
        color: p.dark ? p.foreground : p.background,
        fontSize: 14,
      ),
      actionTextColor: p.dark ? p.accent : const Color(0xFFE2B494),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(HaizRadius.control),
      ),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(
        color: p.dark ? p.raised : p.foreground,
        borderRadius: BorderRadius.circular(HaizRadius.tag),
      ),
      textStyle: TextStyle(
        color: p.dark ? p.foreground : p.background,
        fontSize: 12,
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: p.card,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      titleTextStyle: HaizType.section(p),
      contentTextStyle: HaizType.secondary(p).copyWith(fontSize: 15),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(HaizRadius.panel),
        side: BorderSide(color: p.border),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.card,
      surfaceTintColor: Colors.transparent,
      dragHandleColor: p.tertiary,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(HaizRadius.panel),
        ),
      ),
    ),
    cupertinoOverrideTheme: CupertinoThemeData(
      primaryColor: p.accent,
      brightness: bright,
      scaffoldBackgroundColor: p.background,
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}
