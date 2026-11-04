import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/design/theme.dart';
import 'package:haiz_pocket_flutter/design/tokens.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';

/// The same theme stack the app installs above its Navigator.
Widget haizFrame(Widget child, {bool reduceMotion = false, HaizColors colors = HaizColors.light}) =>
    MaterialApp(
      theme: buildHaizThemeData(colors),
      builder: (context, app) => HaizTheme(
        colors: colors,
        reduceMotion: reduceMotion,
        child: PocketSkin(colors: legacyPalette(colors), reducedMotion: reduceMotion, child: app!),
      ),
      home: Scaffold(body: child),
    );

void phoneSize(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
}
