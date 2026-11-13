import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/ui/lamp_entry.dart';

void main() {
  testWidgets('Lamp guest entry lights the wall, then opens the workspace',
      (tester) async {
    var entered = false;
    await tester.pumpWidget(
      MaterialApp(home: LampEntry(onEnter: () => entered = true)),
    );
    await tester.pumpAndSettle();
    expect(find.text('登录'), findsWidgets);
    expect(find.byKey(const Key('lamp-wall')), findsOneWidget);
    expect(find.textContaining('无账号验证'), findsOneWidget);
    expect(entered, isFalse);
    await tester.tap(find.byKey(const Key('lamp-enter-guest')));
    await tester.pump();
    expect(find.text('已选择本机访客空间，正在进入'), findsOneWidget);
    expect(entered, isFalse);
    await tester.pump(const Duration(milliseconds: 1500));
    expect(entered, isTrue);
    await tester.pumpAndSettle();
  });

  testWidgets('Without an account service the form explains the guest path',
      (tester) async {
    await tester.pumpWidget(MaterialApp(home: LampEntry(onEnter: () {})));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.byKey(const Key('lamp-email')), 'student@example.com');
    await tester.enterText(find.byKey(const Key('lamp-password')), 'secret');
    await tester.tap(find.byKey(const Key('lamp-sign-in')));
    await tester.pumpAndSettle();
    expect(find.text('账号服务暂时不可用，你仍可进入本机访客空间'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Lamp entrance respects reduced motion', (tester) async {
    var entered = false;
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: MaterialApp(home: LampEntry(onEnter: () => entered = true)),
      ),
    );
    await tester.pump();
    expect(find.text('登录'), findsWidgets);
    await tester.tap(find.byKey(const Key('lamp-enter-guest')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(entered, isTrue);
  });
}
