import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/academic_session.dart';
import '../core/pocket_auth.dart';
import '../core/pocket_store.dart';
import '../design/theme.dart';
import '../design/tokens.dart';
import '../domain/message_intake_bridge.dart';
import '../features/welcome/welcome_screen.dart';
import '../ui/kit.dart' show PocketSkin;
import '../ui/pocket_account_sheet.dart';
import 'nav.dart';
import 'shell.dart';

/// Root of HAIZ 2.0. Owns long-lived services and decides only two things:
/// the theme, and which top-level view (loading / welcome / workspace) is
/// shown. Neither rebuilds when a task changes.
class HaizApp extends StatefulWidget {
  const HaizApp({super.key, this.cloudClient, this.store});
  final SupabaseClient? cloudClient;

  /// Injected only by tests; the app otherwise owns its store.
  final PocketStore? store;

  @override
  State<HaizApp> createState() => _HaizAppState();
}

enum _Gate { loading, welcome, locked, workspace }

class _HaizAppState extends State<HaizApp> with WidgetsBindingObserver {
  static const _welcomeKey = 'haiz/welcome/v2';

  late final PocketStore store = widget.store ?? PocketStore();
  late final AcademicSession session = AcademicSession(store);
  late final PocketAuthController auth = PocketAuthController(store, widget.cloudClient);
  final _shell = GlobalKey<HaizShellState>();
  late final ValueNotifier<String> _themeMode = ValueNotifier('system');
  final ValueNotifier<_Gate> _gate = ValueNotifier(_Gate.loading);
  Timer? _classRefresh;
  bool? _welcomed;
  bool _foreground = true;
  HaizTab _initialTab = HaizTab.today;

  // The Lamp web gateway already showed a welcome before linking here.
  final bool _fromLamp = kIsWeb && Uri.base.queryParameters['fromLamp'] == '1';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    store.addListener(_onStore);
    auth.addListener(_updateGate);
    _classRefresh = Timer.periodic(const Duration(minutes: 3), (_) {
      if (_foreground && session.identity != null && !auth.authenticated) {
        session.refresh();
      }
    });
    MessageIntakeBridge.channel.setMethodCallHandler((call) async {
      if (call.method == 'sharedNotice' || call.method == 'nativeNotice') {
        MessageIntakeBridge.markChanged();
        if (call.method == 'sharedNotice') _openInbox();
      }
    });
    _loadWelcome();
    auth.start().then((_) async {
      // A cold share launch inserts the item before Flutter starts. Open the
      // inbox only for an explicit share that just arrived.
      final items = await MessageIntakeBridge.entries();
      final now = DateTime.now();
      if (items.any((item) =>
          (item.source.startsWith('系统分享') || item.source.startsWith('iOS 分享')) &&
          now.difference(item.receivedAt).inSeconds >= 0 &&
          now.difference(item.receivedAt).inSeconds < 20)) {
        _openInbox();
      }
    }).catchError((Object _) {});
  }

  Future<void> _loadWelcome() async {
    bool seen;
    try {
      seen = _fromLamp || await SharedPreferencesAsync().getBool(_welcomeKey) == true;
    } catch (_) {
      seen = true; // A storage fault must not trap the user on a welcome page.
    }
    if (!mounted) return;
    _welcomed = seen;
    _updateGate();
  }

  Future<void> _finishWelcome() async {
    _welcomed = true;
    _updateGate();
    try {
      await SharedPreferencesAsync().setBool(_welcomeKey, true);
    } catch (_) {}
  }

  void _openInbox() {
    if (!mounted) return;
    _initialTab = HaizTab.inbox;
    if (_welcomed != true) _finishWelcome();
    _shell.currentState?.goTab(HaizTab.inbox);
  }

  void _onStore() {
    if (_themeMode.value != store.themeMode) _themeMode.value = store.themeMode;
    _updateGate();
  }

  void _updateGate() {
    final next = auth.loading || _welcomed == null
        ? _Gate.loading
        : (_welcomed == false && !auth.authenticated)
            ? _Gate.welcome
            : !store.ready
                ? _Gate.locked
                : _Gate.workspace;
    if (_gate.value != next) _gate.value = next;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (!_foreground) return;
    if (session.identity != null && !auth.authenticated) session.refresh();
    // Wall-clock focus sessions and failed saves recover on return.
    store.reconcileFocus();
    if (store.canRetrySave) unawaited(store.retrySave());
  }

  @override
  void dispose() {
    _classRefresh?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    MessageIntakeBridge.channel.setMethodCallHandler(null);
    store.removeListener(_onStore);
    auth.removeListener(_updateGate);
    auth.dispose();
    session.dispose();
    if (widget.store == null) store.dispose();
    _themeMode.dispose();
    _gate.dispose();
    super.dispose();
  }

  Future<void> _account(BuildContext context, {bool register = false}) async {
    if (session.userId != null) await session.logout();
    if (!context.mounted) return;
    await showPocketAccountSheet(context, auth, () {
      if (mounted) _finishWelcome();
    }, initiallyRegister: register);
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: _themeMode,
      builder: (context, mode, _) => MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'HAIZ',
        theme: buildHaizThemeData(HaizColors.light),
        darkTheme: buildHaizThemeData(HaizColors.night),
        themeMode: switch (mode) {
          'light' => ThemeMode.light,
          'dark' => ThemeMode.dark,
          _ => ThemeMode.system,
        },
        builder: (context, child) {
          final dark = switch (mode) {
            'light' => false,
            'dark' => true,
            _ => MediaQuery.platformBrightnessOf(context) == Brightness.dark,
          };
          final colors = dark ? HaizColors.night : HaizColors.light;
          final reduce = MediaQuery.of(context).disableAnimations;
          return HaizTheme(
            colors: colors,
            reduceMotion: reduce,
            child: PocketSkin(
              colors: legacyPalette(colors),
              reducedMotion: reduce,
              child: child ?? const SizedBox.shrink(),
            ),
          );
        },
        home: ValueListenableBuilder<_Gate>(
          valueListenable: _gate,
          builder: (context, gate, _) => AnimatedSwitcher(
            duration: HaizTheme.of(context).motion(Motion.base),
            child: switch (gate) {
              _Gate.loading || _Gate.locked => const _Loading(key: ValueKey('loading')),
              _Gate.welcome => WelcomeScreen(
                  key: const ValueKey('welcome'),
                  accountsAvailable: auth.configured,
                  onStart: _finishWelcome,
                  onSignIn: (ctx) => _account(ctx),
                  onRegister: (ctx) => _account(ctx, register: true),
                ),
              _Gate.workspace => HaizShell(
                  key: _shell,
                  store: store,
                  auth: auth,
                  session: session,
                  initialTab: _initialTab,
                  onSignedOut: () {},
                ),
            },
          ),
        ),
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading({super.key});
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      backgroundColor: c.canvas,
      body: Center(
        child: SizedBox.square(
          dimension: 18,
          child: CircularProgressIndicator(strokeWidth: 1.8, color: c.ink3),
        ),
      ),
    );
  }
}
