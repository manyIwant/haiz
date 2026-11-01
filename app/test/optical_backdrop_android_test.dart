import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/ui/optical_backdrop.dart';

void main() {
  testWidgets('Android floating lens uses a bounded blur, not a GPU shader',
      (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    addTearDown(() => debugDefaultTargetPlatformOverride = null);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 320,
              height: 66,
              child: ClipRRect(
                borderRadius: BorderRadius.all(Radius.circular(29)),
                child: OpticalBackdrop(
                  dark: false,
                  child: ColoredBox(
                    color: Color(0x33FFFFFF),
                    child: SizedBox.expand(),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    // On Android the unsafe fragment-program path must never be constructed;
    // the clip keeps the filtered region inside the floating dock.
    expect(find.byType(FutureBuilder<ui.FragmentProgram?>), findsNothing);
    expect(find.byType(BackdropFilter), findsOneWidget);
    expect(find.byType(ClipRect), findsOneWidget);
    expect(tester.getSize(find.byType(BackdropFilter)), const Size(320, 66));
    expect(tester.takeException(), isNull);
  });
}
