import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/ui/lamp_entry.dart';
import 'package:haiz_pocket_flutter/ui/pocket_lamp_entrance.dart';

void main() {
  testWidgets('Native lamp entrance runs on every platform',
      (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.linux;
    var entered = false;
    await tester.pumpWidget(
      MaterialApp(
        home: PocketLampEntrance(onEnter: () => entered = true),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(LampEntry), findsOneWidget);
    expect(find.byKey(const Key('lamp-enter-guest')), findsOneWidget);
    await tester.tap(find.byKey(const Key('lamp-enter-guest')));
    await tester.pump(const Duration(milliseconds: 1500));
    expect(entered, isTrue);
    await tester.pumpAndSettle();
    debugDefaultTargetPlatformOverride = null;
  });
}
