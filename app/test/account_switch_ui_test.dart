import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:haiz_pocket_flutter/core/academic_session.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:haiz_pocket_flutter/ui/academic_page.dart';
import 'package:haiz_pocket_flutter/ui/inbox_page.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:haiz_pocket_flutter/ui/today_page.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

Widget _frame(Widget child) => MaterialApp(
  builder: (context, app) => PocketSkin(
    colors: PocketPalette.forName('porcelain'),
    child: app!,
  ),
  home: Scaffold(body: child),
);

void main() {
  setUp(
    () => SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty(),
  );

  testWidgets('task composed before an account switch is not written to either account', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    await store.openAccount(
      origin: 'https://academic.example.com',
      identity: {
        'instanceId': 'instance-one',
        'userId': 'student-a',
        'role': 'student',
        'authorizedClassIds': ['class-a'],
        'cacheScope': 'haiz/v1/instance-one/student-a',
      },
    );

    await tester.pumpWidget(_frame(TodayPage(store: store, onNavigate: (_) {})));
    await tester.tap(find.byTooltip('添加任务'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextField).last,
      '切换账号后不应写入的任务',
    );

    // The sheet stays open while the account changes underneath it.
    await store.openGuest();

    await tester.tap(find.byKey(const Key('save-task')));
    await tester.pumpAndSettle();

    expect(store.tasks, isEmpty);
    expect(find.text('已切换账号，本次修改没有保存。'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.takeException(), isNull);
  });

  testWidgets('inbox candidates extracted before a switch are never committed', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    await store.openAccount(
      origin: 'https://academic.example.com',
      identity: {
        'instanceId': 'instance-one',
        'userId': 'student-a',
        'role': 'student',
        'authorizedClassIds': ['class-a'],
        'cacheScope': 'haiz/v1/instance-one/student-a',
      },
    );

    await tester.pumpWidget(
      _frame(InboxPage(store: store, onSaved: () {})),
    );
    await tester.enterText(
      find.byKey(const Key('inbox-text')),
      '数学明天交练习册第36-39页。',
    );
    await tester.tap(find.text('提取候选'));
    await tester.pumpAndSettle();
    expect(find.text('确认并加入我的任务'), findsOneWidget);

    // Candidates belong to account A; switching accounts must discard them.
    await store.openGuest();
    await tester.ensureVisible(find.text('确认并加入我的任务'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('确认并加入我的任务'));
    await tester.pumpAndSettle();

    expect(store.tasks, isEmpty);
    expect(find.text('已切换账号，候选任务未写入任何账号。'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.takeException(), isNull);
  });

  testWidgets('a legacy import confirmed across an account switch is refused', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.withData({
          'pocket.tasks.v1': jsonEncode([
            const TaskItem(
              id: 'legacy-task',
              title: '历史数学作业',
              subject: '数学',
            ).toJson(),
          ]),
        });

    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    final session = AcademicSession(
      store,
      clientFactory: () => MockClient((request) async {
        final body = switch (request.url.path) {
          '/api/auth/login' => {
            'user': {'id': 'student-a', 'role': 'student'},
          },
          '/api/v1/identity' => {
            'state': 'Synced',
            'data': {
              'instanceId': 'instance-one',
              'userId': 'student-a',
              'role': 'student',
              'authorizedClassIds': ['class-a'],
              'cacheScope': 'haiz/v1/instance-one/student-a',
            },
            'error': null,
            'meta': {},
          },
          '/api/classes' => {
            'classes': [
              {'id': 'class-a', 'title': '高一 (1) 班', 'status': 'active'},
            ],
          },
          '/api/my/assignments' => {'assignments': <Object>[]},
          _ => <String, Object?>{},
        };
        return http.Response(
          jsonEncode(body),
          200,
          headers: {
            'content-type': 'application/json',
            if (request.url.path == '/api/auth/login')
              'set-cookie': 'hsid=session; HttpOnly',
          },
        );
      }),
    );
    addTearDown(session.dispose);
    await session.login('https://academic.example.com', 'student-a', 'pw');
    expect(session.userId, 'student-a');
    expect(store.legacyArchiveAvailable, isTrue);
    await tester.pumpWidget(
      _frame(AcademicPage(store: store, session: session, onBack: () {})),
    );
    await tester.ensureVisible(find.text('确认并入当前账号'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('确认并入当前账号'));
    await tester.pumpAndSettle();

    // The confirmation dialog is open for account A. The session changes
    // underneath it, which must invalidate the pending confirmation.
    await store.openGuest();
    await tester.pumpAndSettle();
    await tester.tap(find.text('确认并入当前账号').last);
    await tester.pumpAndSettle();

    expect(store.tasks, isEmpty);
    expect(
      await SharedPreferencesAsync().getString('haiz/legacy/v1/owner'),
      isNull,
    );
    expect(find.text('确认期间已切换账号，旧记录未导入任何账号；归档仍完整保留。'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.takeException(), isNull);
  });
}
