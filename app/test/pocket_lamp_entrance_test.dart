import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/ui/lamp_entry.dart';
import 'package:haiz_pocket_flutter/ui/pocket_lamp_entrance.dart';

void main() {
  testWidgets('Local fallback entrance stays available on non-mobile platforms',
      (tester) async {
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
    expect(entered, isTrue);
  });
}
