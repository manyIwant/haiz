import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'domain/message_intake_bridge.dart';

import 'package:pdfrx/pdfrx.dart';

import 'core/pocket_store.dart';
import 'core/pocket_auth.dart';
import 'core/academic_session.dart';
import 'ui/kit.dart';
import 'ui/pocket_lamp_entrance.dart';
import 'ui/pocket_account_sheet.dart';
import 'ui/ios_theme.dart';
import 'ui/today_page.dart';
import 'ui/schedule_page.dart';
import 'ui/focus_page.dart';
import 'ui/campus_page.dart';
import 'ui/inbox_page.dart';
import 'ui/ticker_lab_page.dart';
import 'ui/academic_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  pdfrxFlutterInitialize();
  SupabaseClient? cloud;
  try {
    cloud = await initializePocketAuth();
  } catch (error) {
    // A configuration/network failure must not destroy offline guest mode.
    debugPrint('Pocket identity initialization unavailable: ${error.runtimeType}');
  }
  runApp(HaizPocketApp(cloudClient: cloud));
}

class HaizPocketApp extends StatefulWidget {
  const HaizPocketApp({super.key, this.cloudClient});
  final SupabaseClient? cloudClient;
  @override
  State<HaizPocketApp> createState() => _HaizPocketAppState();
}

class _HaizPocketAppState extends State<HaizPocketApp> {
  late final PocketStore store = PocketStore();
  late final AcademicSession session = AcademicSession(store);
  late final PocketAuthController pocketAuth =
      PocketAuthController(store, widget.cloudClient);
  int tab = 0;
  // Web Lamp gateway already displayed the entrance. Open the actual
  // device-local Flutter workspace directly after explicit CTA navigation.
  bool _entered = kIsWeb && Uri.base.queryParameters['fromLamp'] == '1';
  bool showLab = false;
  bool showAcademic = false;

  @override
  void initState() {
    super.initState();
    MessageIntakeBridge.channel.setMethodCallHandler((call) async {
      if (call.method == 'sharedNotice') {
        MessageIntakeBridge.markChanged();
        if (mounted) {
          setState(() => _entered = true);
          _switchTab(2);
        }
      }
    });
    pocketAuth
        .start()
        .then((_) async {
          // A cold share launch inserts the item before Flutter is initialized.
          // Open Inbox only when an explicit share just arrived, not for any
          // unrelated historical or silently monitored notification.
          final items = await MessageIntakeBridge.entries();
          final now = DateTime.now();
          if (!mounted) return;
          if (items.any(
            (item) =>
                item.source.startsWith('系统分享') &&
                now.difference(item.receivedAt).inSeconds >= 0 &&
                now.difference(item.receivedAt).inSeconds < 20,
          )) {
            setState(() => _entered = true);
            _switchTab(2);
          }
        })
        .catchError((Object _) {});
  }

  @override
  void dispose() {
    MessageIntakeBridge.channel.setMethodCallHandler(null);
    pocketAuth.dispose();
    session.dispose();
    store.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([store, session, pocketAuth]),
      builder: (context, _) {
        final p = PocketPalette.forName(store.appearance);
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'HAIZ Pocket · 校园学习空间',
          theme: buildHaizTheme(p),
          // Put inherited styling ABOVE Navigator so bottom sheets and dialogs
          // get the same palette as the screen that opened them.
          builder: (context, child) => PocketSkin(
            colors: p,
            reducedMotion: MediaQuery.of(context).disableAnimations,
            child: child ?? const SizedBox.shrink(),
          ),
          home: Builder(
            builder: (context) {
              final reduce = MediaQuery.of(context).disableAnimations;
              if (pocketAuth.loading) {
                return const Scaffold(
                  body: Center(child: CircularProgressIndicator()),
                );
              }
              if (!_entered && !pocketAuth.authenticated) {
                return Stack(
                  children: [
                    PocketLampEntrance(
                      onEnter: () => setState(() => _entered = true),
                    ),
                    Positioned(
                      right: 20,
                      top: 40,
                      child: SafeArea(
                        child: FilledButton.tonalIcon(
                          key: const Key('pocket-account-entry'),
                          onPressed: () => _openAccountLogin(context),
                          icon: const Icon(Icons.person_outline),
                          label: const Text('账号登录'),
                        ),
                      ),
                    ),
                  ],
                );
              }
              return Scaffold(
                body: SafeArea(
                  bottom: false,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: !store.ready
                            ? Center(
                                child: CircularProgressIndicator(
                                  color: p.accent,
                                ),
                              )
                            : AnimatedSwitcher(
                                duration: Duration(
                                  milliseconds: reduce ? 0 : 230,
                                ),
                                switchInCurve: Curves.easeOutCubic,
                                switchOutCurve: Curves.easeInCubic,
                                transitionBuilder: (child, animation) =>
                                    FadeTransition(
                                      opacity: animation,
                                      child: SlideTransition(
                                        position: Tween<Offset>(
                                          begin: const Offset(0, 0.012),
                                          end: Offset.zero,
                                        ).animate(animation),
                                        child: child,
                                      ),
                                    ),
                                child: switch (tab) {
                                  0 => TodayPage(
                                    key: ValueKey('today-${store.namespace}'),
                                    store: store,
                                    onNavigate: _switchTab,
                                  ),
                                  1 => SchedulePage(
                                    key: ValueKey('schedule-${store.namespace}'),
                                    store: store,
                                  ),
                                  2 => InboxPage(
                                    key: ValueKey('inbox-${store.namespace}'),
                                    store: store,
                                    onSaved: () => _switchTab(0),
                                  ),
                                  3 => FocusPage(
                                    key: ValueKey('focus-${store.namespace}'),
                                    store: store,
                                  ),
                                  _ =>
                                    showAcademic
                                        ? AcademicPage(
                                            key: ValueKey('academic-${store.namespace}'),
                                            store: store,
                                            session: session,
                                            onBack: () => setState(
                                              () => showAcademic = false,
                                            ),
                                          )
                                        : showLab
                                        ? TickerLabPage(
                                            key: ValueKey('lab-${store.namespace}'),
                                            store: store,
                                            onBack: () =>
                                                setState(() => showLab = false),
                                          )
                                        : CampusPage(
                                            key: ValueKey('campus-${store.namespace}'),
                                            store: store,
                                            onOpenLab: () =>
                                                setState(() => showLab = true),
                                            onOpenAcademic: () {
                                              if (pocketAuth.authenticated) {
                                                ScaffoldMessenger.of(context).showSnackBar(
                                                  const SnackBar(
                                                    content: Text('独立的教务账号暂不与 Pocket 云端账号混用，请先退出 Pocket 账号。'),
                                                  ),
                                                );
                                              } else {
                                                setState(() => showAcademic = true);
                                              }
                                            },
                                          ),
                                },
                              ),
                      ),
                      if (store.ready)
                        Positioned(
                          right: 12,
                          top: 8,
                          child: SafeArea(
                            child: Material(
                              color: p.card,
                              borderRadius: BorderRadius.circular(24),
                              child: IconButton(
                                key: const Key('account-switch'),
                                tooltip: pocketAuth.authenticated
                                    ? '账号与退出登录'
                                    : '账号登录',
                                icon: Icon(
                                  pocketAuth.authenticated
                                      ? Icons.verified_user_outlined
                                      : Icons.person_outline_rounded,
                                  color: p.accent,
                                ),
                                onPressed: () => pocketAuth.authenticated
                                    ? _confirmLogout(context)
                                    : _openAccountLogin(context),
                              ),
                            ),
                          ),
                        ),
                      if (store.ready && store.storageError != null)
                        Positioned(
                          left: 16,
                          right: 16,
                          top: 8,
                          child: Material(
                            color: p.card,
                            borderRadius: BorderRadius.circular(14),
                            child: Padding(
                              padding: const EdgeInsets.all(13),
                              child: Text(
                                store.storageError!,
                                style: TextStyle(
                                  color: p.secondary,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        ),
                      if (store.ready)
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: GlassDock(index: tab, onChange: _switchTab),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Future<void> _openAccountLogin(BuildContext context) async {
    // The existing AcademicSession and Pocket identity are different products.
    // Never let a legacy academic namespace overwrite the new RLS namespace.
    if (session.userId != null) {
      await session.logout();
    }
    if (!mounted || !context.mounted) return;
    await showPocketAccountSheet(
      context,
      pocketAuth,
      () {
        if (mounted) {
          setState(() {
            _entered = true;
            tab = 0;
            showAcademic = false;
            showLab = false;
          });
        }
      },
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('退出 Pocket 账号？'),
        content: const Text('账号数据将立即锁定。本机访客空间会保持独立。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true),
              child: const Text('退出登录')),
        ],
      ),
    );
    if (yes == true) {
      await pocketAuth.signOut();
      if (mounted) setState(() {
        _entered = false;
        tab = 0;
        showLab = false;
        showAcademic = false;
      });
    }
  }

  void _switchTab(int index) {
    if (index == tab) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => tab = index);
  }
}
