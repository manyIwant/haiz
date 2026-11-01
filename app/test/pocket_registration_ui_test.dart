import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_auth.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/ui/pocket_account_sheet.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  testWidgets('Registration opens directly and rejects unequal passwords',
      (tester) async {
    final store = PocketStore();
    final auth = PocketAuthController(
      store,
      SupabaseClient('https://example.supabase.co', 'sb_publishable_test'),
    );
    addTearDown(() {
      auth.dispose();
      store.dispose();
    });
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: PocketAccountSheet(
        auth: auth, onSuccess: () {}, initiallyRegister: true,
      )),
    ));
    await tester.pumpAndSettle();
    expect(find.text('创建 HAIZ 账号'), findsOneWidget);
    expect(find.byKey(const Key('account-confirm-password')), findsOneWidget);
    expect(find.byKey(const Key('auth-forgot-password')), findsNothing);
    await tester.enterText(find.byKey(const Key('account-email')),
        'student@example.com');
    await tester.enterText(find.byKey(const Key('account-password')),
        'safe-password-123');
    await tester.enterText(find.byKey(const Key('account-confirm-password')),
        'different-password');
    await tester.ensureVisible(find.byKey(const Key('account-submit')));
    await tester.tap(find.byKey(const Key('account-submit')));
    await tester.pump();
    expect(find.text('两次输入的密码不一致'), findsOneWidget);
    expect(auth.busy, false);
  });

  testWidgets('Login hides register fields and allows guest mode',
      (tester) async {
    final store = PocketStore();
    final auth = PocketAuthController(
      store,
      SupabaseClient('https://example.supabase.co', 'sb_publishable_test'),
    );
    addTearDown(() {
      auth.dispose();
      store.dispose();
    });
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: PocketAccountSheet(
        auth: auth, onSuccess: () {},
      )),
    ));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('account-confirm-password')), findsNothing);
    expect(find.byKey(const Key('auth-forgot-password')), findsOneWidget);
    expect(find.byKey(const Key('auth-continue-guest')), findsOneWidget);
    await tester.tap(find.text('注册').first);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('account-confirm-password')), findsOneWidget);
    expect(find.byKey(const Key('auth-forgot-password')), findsNothing);
  });
}
