import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../ui/kit.dart' show PocketPalette;
import 'tokens.dart';

/// Inherited design context: colours and the reduced-motion preference.
class HaizTheme extends InheritedWidget {
  const HaizTheme({
    super.key,
    required this.colors,
    required this.reduceMotion,
    required super.child,
  });

  final HaizColors colors;
  final bool reduceMotion;

  static HaizTheme of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<HaizTheme>() ??
      const HaizTheme(colors: HaizColors.light, reduceMotion: false, child: SizedBox());

  /// [d] unless reduced motion is on.
  Duration motion(Duration d) => reduceMotion ? Duration.zero : d;

  @override
  bool updateShouldNotify(HaizTheme old) =>
      old.colors != colors || old.reduceMotion != reduceMotion;
}

extension HaizContext on BuildContext {
  HaizColors get c => HaizTheme.of(this).colors;
  HaizTheme get haiz => HaizTheme.of(this);
}

/// Pages kept from 1.5.5 (班级同步, 纸带实验, account and backup sheets) read
/// `PocketSkin`; give them a palette derived from the same tokens so they sit
/// in the 2.0 system until they are rebuilt.
PocketPalette legacyPalette(HaizColors c) => PocketPalette(
  c.canvas, c.surface, c.ink, c.ink2, c.ink, c.rule, c.dark,
);

ThemeData buildHaizThemeData(HaizColors c) {
  final brightness = c.dark ? Brightness.dark : Brightness.light;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: c.ink,
    onPrimary: c.onInverse,
    secondary: c.signal,
    onSecondary: Colors.white,
    error: c.late,
    onError: Colors.white,
    surface: c.surface,
    onSurface: c.ink,
    onSurfaceVariant: c.ink2,
    outline: c.ruleStrong,
    outlineVariant: c.rule,
    surfaceContainerHighest: c.raised,
    surfaceContainerHigh: c.raised,
    surfaceContainer: c.surface,
    surfaceContainerLow: c.surface,
    surfaceContainerLowest: c.canvas,
    inverseSurface: c.inverse,
    onInverseSurface: c.onInverse,
    primaryContainer: c.raised,
    onPrimaryContainer: c.ink,
    secondaryContainer: c.raised,
    onSecondaryContainer: c.ink,
    surfaceTint: Colors.transparent,
  );
  final control = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(Radii.control),
  );
  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.canvas,
    canvasColor: c.canvas,
    dividerColor: c.rule,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    hoverColor: c.raised.withValues(alpha: .5),
    focusColor: c.signalSoft,
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: c.ink, displayColor: c.ink),
    iconTheme: IconThemeData(color: c.ink2, size: 22),
    dividerTheme: DividerThemeData(color: c.rule, thickness: .6, space: .6),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: c.now,
      selectionColor: c.now.withValues(alpha: .22),
      selectionHandleColor: c.now,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.raised.withValues(alpha: c.dark ? .7 : .55),
      hintStyle: TypeScale.callout(c.ink3),
      labelStyle: TypeScale.footnote(c.ink2),
      floatingLabelStyle: TypeScale.footnote(c.ink),
      helperStyle: TypeScale.caption(c.ink3),
      errorStyle: TypeScale.caption(c.late),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.control),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.control),
        borderSide: BorderSide(color: Colors.transparent, width: 1.2),
      ),
      // Focus is visible as an ink edge, not a glow.
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.control),
        borderSide: BorderSide(color: c.ink, width: 1.4),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.control),
        borderSide: BorderSide(color: c.late, width: 1.2),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.control),
        borderSide: BorderSide(color: c.late, width: 1.4),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: c.inverse,
        foregroundColor: c.onInverse,
        disabledBackgroundColor: c.raised,
        disabledForegroundColor: c.ink3,
        minimumSize: const Size(64, 46),
        elevation: 0,
        shape: control,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.ink,
        minimumSize: const Size(64, 44),
        side: BorderSide(color: c.ruleStrong),
        shape: control,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: c.ink,
        minimumSize: const Size(44, 40),
        shape: control,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: c.ink2,
        minimumSize: const Size(44, 44),
        shape: control,
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: c.canvas,
      selectedColor: c.inverse,
      disabledColor: c.raised,
      side: BorderSide(color: c.rule),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.chip)),
      labelStyle: TypeScale.footnote(c.ink),
      secondaryLabelStyle: TypeScale.footnote(c.onInverse),
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 4),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected) ? c.onInverse : c.ink3),
      trackColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected) ? c.ink : c.raised),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
    checkboxTheme: CheckboxThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
      fillColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected) ? c.ink : Colors.transparent),
      checkColor: WidgetStateProperty.all(c.onInverse),
      side: BorderSide(color: c.ruleStrong, width: 1.5),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: c.ink, linearTrackColor: c.rule, circularTrackColor: c.rule),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: c.inverse,
      contentTextStyle: TypeScale.callout(c.onInverse),
      actionTextColor: c.dark ? c.signal.withValues(alpha: .9) : const Color(0xFFFF9A7F),
      elevation: 0,
      insetPadding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.control)),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: c.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.panel)),
      titleTextStyle: TypeScale.headline(c.ink),
      contentTextStyle: TypeScale.callout(c.ink2),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.surface,
      surfaceTintColor: Colors.transparent,
      modalBackgroundColor: c.surface,
      elevation: 0,
      modalElevation: 0,
      dragHandleColor: c.ruleStrong,
      dragHandleSize: const Size(36, 4),
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.sheet)),
      ),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: c.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 6,
      shadowColor: Colors.black.withValues(alpha: c.dark ? .5 : .18),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.control)),
      textStyle: TypeScale.callout(c.ink),
    ),
    datePickerTheme: DatePickerThemeData(
      backgroundColor: c.surface,
      surfaceTintColor: Colors.transparent,
      headerBackgroundColor: c.surface,
      headerForegroundColor: c.ink,
      todayForegroundColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected) ? c.onInverse : c.now),
      todayBorder: BorderSide(color: c.now),
      dayForegroundColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected) ? c.onInverse : c.ink),
      dayBackgroundColor: WidgetStateProperty.resolveWith((s) =>
          s.contains(WidgetState.selected) ? c.inverse : Colors.transparent),
    ),
    timePickerTheme: TimePickerThemeData(
      backgroundColor: c.surface,
      dialBackgroundColor: c.raised,
      hourMinuteColor: c.raised,
    ),
    cupertinoOverrideTheme: CupertinoThemeData(
      primaryColor: c.ink,
      brightness: brightness,
      scaffoldBackgroundColor: c.canvas,
    ),
    pageTransitionsTheme: PageTransitionsTheme(
      builders: {
        for (final p in TargetPlatform.values)
          p: (p == TargetPlatform.iOS || p == TargetPlatform.macOS || kIsWeb)
              ? const CupertinoPageTransitionsBuilder()
              : const FadeForwardsPageTransitionsBuilder(),
      },
    ),
  );
}
