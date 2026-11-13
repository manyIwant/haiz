import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'domain/message_intake_bridge.dart';
import 'domain/haiz_app_updates.dart';
import 'ui/haiz_update_sheet.dart';

import 'package:pdfrx/pdfrx.dart';

import 'core/pocket_store.dart';
import 'core/pocket_auth.dart';
import 'core/academic_session.dart';
import 'ui/kit.dart';
import 'ui/pocket_lamp_entrance.dart';
import 'ui/pocket_account_sheet.dart';
import 'ui/pocket_backup_sheet.dart';
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

class _HaizPocketAppState extends State<HaizPocketApp> with WidgetsBindingObserver {
  late final PocketStore store = PocketStore();
  late final AcademicSession session = AcademicSession(store);
  late final PocketAuthController pocketAuth =
      PocketAuthController(store, widget.cloudClient);
  Timer? _classRefreshTimer;
  bool _appIsForeground = true;
  int tab = 0;
  // Web Lamp gateway already displayed the entrance. Open the actual
  // device-local Flutter workspace directly after explicit CTA navigation.
  bool _entered = kIsWeb && Uri.base.queryParameters['fromLamp'] == '1';
  // Keeps the entrance up while its lamp shows a successful sign-in.
  bool _holdEntrance = false;
  bool showLab = false;
  bool showAcademic = false;
  bool _hasAppUpdate = false;

  Future<void> _checkAppUpdateQuietly() async {
    if (!HaizAppUpdates.available) return;
    try {
      final installed = await HaizAppUpdates.installed();
      final release = await HaizAppUpdates.check(current: installed);
      if (mounted) setState(() => _hasAppUpdate = release != null);
    } catch (_) {
      // Never block offline use or expose a network error on launch.
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkAppUpdateQuietly());
    _classRefreshTimer = Timer.periodic(const Duration(minutes: 3), (_) {
      if (_appIsForeground && session.identity != null && !pocketAuth.authenticated) {
        session.refresh();
      }
    });
    MessageIntakeBridge.channel.setMethodCallHandler((call) async {
      if (call.method == 'sharedNotice' || call.method == 'nativeNotice') {
        MessageIntakeBridge.markChanged();
        if (call.method == 'sharedNotice' && mounted) {
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
                (item.source.startsWith('系统分享') ||
                 item.source.startsWith('iOS 分享')) &&
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
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appIsForeground = state == AppLifecycleState.resumed;
    if (_appIsForeground && session.identity != null && !pocketAuth.authenticated) {
      session.refresh();
    }
  }

  @override
  void dispose() {
    _classRefreshTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
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
              if (!_entered &&
                  (!pocketAuth.authenticated || _holdEntrance)) {
                return PocketLampEntrance(
                  auth: pocketAuth,
                  onHold: (hold) => setState(() => _holdEntrance = hold),
                  onRegister: () => _openAccountLogin(context, register: true),
                  onEnter: () => setState(() {
                    _entered = true;
                    _holdEntrance = false;
                    tab = 0;
                    showAcademic = false;
                    showLab = false;
                  }),
                );
              }
              return Scaffold(
                body: SafeArea(
                  bottom: false,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: PocketHeaderAction(
                          action: _PocketMenuButton(
                            authenticated: pocketAuth.authenticated,
                            hasUpdate: _hasAppUpdate,
                            onAccount: () => pocketAuth.authenticated
                                ? _confirmLogout(context)
                                : _openAccountLogin(context),
                            onBackup: () =>
                                showPocketBackupSheet(context, store),
                            onUpdate: HaizAppUpdates.available
                                ? () => showHaizUpdateSheet(context)
                                : null,
                          ),
                          child: !store.ready
                            ? Center(
                                child: CircularProgressIndicator(
                                  color: p.accent,
                                ),
                              )
                            : AnimatedSwitcher(
                                duration: reduce
                                    ? Duration.zero
                                    : HaizMotion.menu,
                                switchInCurve: HaizMotion.ease,
                                switchOutCurve: Curves.easeIn,
                                // Pages fill the viewport; a short page must
                                // start at the top, not float centered.
                                layoutBuilder: (current, previous) => Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    ...previous,
                                    ?current,
                                  ],
                                ),
                                transitionBuilder: (child, animation) =>
                                    FadeTransition(
                                      opacity: animation,
                                      child: SlideTransition(
                                        position: Tween<Offset>(
                                          begin: const Offset(0, 0.01),
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
                                    session: pocketAuth.authenticated ? null : session,
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
                      ),
                      if (store.ready && store.storageError != null)
                        Positioned(
                          left: 16,
                          right: 16,
                          top: 8,
                          child: SafeArea(
                            child: Material(
                              color: p.card,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                  HaizRadius.control,
                                ),
                                side: BorderSide(color: p.negative),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Text(
                                  store.storageError!,
                                  style: HaizType.secondary(p),
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

  Future<void> _openAccountLogin(BuildContext context, {bool register = false}) async {
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
      initiallyRegister: register,
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
      if (mounted) {
        setState(() {
        _entered = false;
        tab = 0;
        showLab = false;
        showAcademic = false;
        });
      }
    }
  }

  void _switchTab(int index) {
    if (index == tab) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => tab = index);
  }
}

/// The one global control: account, backup and updates in a single menu,
/// so pages keep a quiet header. A dot marks an available update.
class _PocketMenuButton extends StatelessWidget {
  const _PocketMenuButton({
    required this.authenticated,
    required this.hasUpdate,
    required this.onAccount,
    required this.onBackup,
    required this.onUpdate,
  });

  final bool authenticated;
  final bool hasUpdate;
  final VoidCallback onAccount;
  final VoidCallback onBackup;
  final VoidCallback? onUpdate;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Material(
      color: p.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(HaizRadius.control),
        side: BorderSide(color: p.border),
      ),
      child: PopupMenuButton<String>(
        key: const Key('account-switch'),
        tooltip: '账号、备份与更新',
        position: PopupMenuPosition.under,
        onSelected: (value) => switch (value) {
          'account' => onAccount(),
          'backup' => onBackup(),
          'update' => onUpdate?.call(),
          _ => null,
        },
        itemBuilder: (_) => [
          PopupMenuItem(
            value: 'account',
            child: _MenuRow(
              icon: authenticated
                  ? Icons.logout_rounded
                  : Icons.person_outline_rounded,
              label: authenticated ? '账号与退出登录' : '账号登录',
            ),
          ),
          const PopupMenuItem(
            key: Key('pocket-backup-entry'),
            value: 'backup',
            child: _MenuRow(
              icon: Icons.cloud_download_outlined,
              label: '备份与恢复',
            ),
          ),
          if (onUpdate != null)
            PopupMenuItem(
              key: const Key('app-update-entry'),
              value: 'update',
              child: _MenuRow(
                icon: Icons.system_update_alt_rounded,
                label: hasUpdate ? '有新版本可安装' : '检查 HAIZ 更新',
                dot: hasUpdate,
              ),
            ),
        ],
        child: SizedBox(
          width: 40,
          height: 40,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(
                authenticated
                    ? Icons.verified_user_outlined
                    : Icons.person_outline_rounded,
                size: 20,
                color: p.secondary,
              ),
              if (hasUpdate)
                Positioned(
                  right: 8,
                  top: 8,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: p.accent,
                      shape: BoxShape.circle,
                    ),
                    child: const SizedBox(width: 6, height: 6),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.icon, required this.label, this.dot = false});

  final IconData icon;
  final String label;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return Row(
      children: [
        Icon(icon, size: 18, color: p.secondary),
        const SizedBox(width: 12),
        Text(label),
        if (dot) ...[
          const SizedBox(width: 8),
          DecoratedBox(
            decoration: BoxDecoration(color: p.accent, shape: BoxShape.circle),
            child: const SizedBox(width: 6, height: 6),
          ),
        ],
      ],
    );
  }
}
