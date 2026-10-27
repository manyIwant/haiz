import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'kit.dart';

ThemeData buildHaizTheme(PocketPalette p) {
  final apple =
      defaultTargetPlatform == TargetPlatform.iOS ||
      defaultTargetPlatform == TargetPlatform.macOS;
  final bright = p.dark ? Brightness.dark : Brightness.light;
  return ThemeData(
    useMaterial3: true,
    brightness: bright,
    fontFamily: apple ? '.SF Pro Text' : null,
    scaffoldBackgroundColor: p.background,
    canvasColor: p.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: p.accent,
      brightness: bright,
      surface: p.card,
    ),
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    hoverColor: p.accent.withValues(alpha: .04),
    dividerColor: p.border,
    sliderTheme: SliderThemeData(
      activeTrackColor: p.accent,
      inactiveTrackColor: p.tertiary,
      thumbColor: p.card,
      trackHeight: 4,
      overlayColor: p.accent.withValues(alpha: .10),
      thumbShape: const RoundSliderThumbShape(
        enabledThumbRadius: 11,
        elevation: 1.2,
        pressedElevation: 1.8,
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: p.grouped,
      selectedColor: p.accent.withValues(alpha: p.dark ? .24 : .12),
      side: BorderSide.none,
      shape: const StadiumBorder(),
      labelStyle: TextStyle(color: p.foreground, fontSize: 12),
      showCheckmark: false,
    ),
    checkboxTheme: CheckboxThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      fillColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? p.accent
            : Colors.transparent,
      ),
      side: BorderSide(color: p.border, width: 1.7),
      checkColor: WidgetStateProperty.all(Colors.white),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.grouped,
      hintStyle: TextStyle(color: p.secondary, fontSize: 14),
      labelStyle: TextStyle(color: p.secondary, fontSize: 13),
      floatingLabelStyle: TextStyle(color: p.accent, fontSize: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(15),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(15),
        borderSide: BorderSide(
          color: p.border.withValues(alpha: .32),
          width: .7,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(15),
        borderSide: BorderSide(
          color: p.accent.withValues(alpha: .70),
          width: 1.2,
        ),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.accent,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: p.accent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.accent,
        side: BorderSide(color: p.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: p.card,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(23)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
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
