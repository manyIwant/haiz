import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/ui/lamp_entry.dart';

void main() {
  testWidgets('Lamp guest entry explicitly opens existing workspace', (tester) async {
    var entered = false;
    await tester.pumpWidget(
      MaterialApp(home: LampEntry(onEnter: () => entered = true)),
    );
    await tester.pumpAndSettle();
    expect(find.text('欢迎回来'), findsOneWidget);
    expect(find.textContaining('无账号验证'), findsOneWidget);
    expect(entered, isFalse);
    await tester.tap(find.byKey(const Key('lamp-enter-guest')));
    expect(entered, isTrue);
  });

  testWidgets('Lamp entrance respects reduced motion', (tester) async {
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: MaterialApp(home: LampEntry(onEnter: () {})),
      ),
    );
    await tester.pump();
    expect(find.text('欢迎回来'), findsOneWidget);
  });
}
