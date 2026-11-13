import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_auth.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/ui/pocket_account_sheet.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });
  testWidgets('Registration opens directly and rejects unequal passwords',
      (tester) async {
    final store = PocketStore();
    final auth = PocketAuthController(
      store,
      SupabaseClient('https://example.supabase.co', 'sb_publishable_test'),
    );
    // Production refresh loop is disabled in deterministic widget tests.
    auth.client!.auth.stopAutoRefresh();
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
    // Production refresh loop is disabled in deterministic widget tests.
    auth.client!.auth.stopAutoRefresh();
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

  testWidgets('Full-page login is not a bottom sheet and keeps guest navigation',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final store = PocketStore();
    final auth = PocketAuthController(
      store,
      SupabaseClient('https://example.supabase.co', 'sb_publishable_test'),
    );
    auth.client!.auth.stopAutoRefresh();
    addTearDown(() {
      auth.dispose();
      store.dispose();
    });

    var guestSelected = false;
    var backSelected = false;
    await tester.pumpWidget(MaterialApp(
      home: PocketAccountPage(
        auth: auth,
        onSuccess: () {},
        onContinueGuest: () => guestSelected = true,
        onBack: () => backSelected = true,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('pocket-account-page')), findsOneWidget);
    expect(find.byType(BottomSheet), findsNothing);
    expect(find.text('欢迎回来'), findsOneWidget);
    expect(find.byKey(const Key('account-email')), findsOneWidget);
    expect(find.byKey(const Key('account-password')), findsOneWidget);
    expect(find.byKey(const Key('auth-forgot-password')), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.ensureVisible(find.byKey(const Key('auth-continue-guest')));
    await tester.tap(find.byKey(const Key('auth-continue-guest')));
    expect(guestSelected, isTrue);
    await tester.tap(find.byKey(const Key('auth-back')));
    expect(backSelected, isTrue);
  });

}
