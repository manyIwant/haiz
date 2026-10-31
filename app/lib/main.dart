import 'dart:async';

import 'package:flutter/material.dart';

import 'domain/message_intake_bridge.dart';

import 'package:pdfrx/pdfrx.dart';

import 'core/pocket_store.dart';
import 'core/academic_session.dart';
import 'ui/kit.dart';
import 'ui/ios_theme.dart';
import 'ui/today_page.dart';
import 'ui/schedule_page.dart';
import 'ui/focus_page.dart';
import 'ui/campus_page.dart';
import 'ui/inbox_page.dart';
import 'ui/ticker_lab_page.dart';
import 'ui/academic_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  pdfrxFlutterInitialize();
  runApp(const HaizPocketApp());
}

class HaizPocketApp extends StatefulWidget {
  const HaizPocketApp({super.key});
  @override
  State<HaizPocketApp> createState() => _HaizPocketAppState();
}

class _HaizPocketAppState extends State<HaizPocketApp> with WidgetsBindingObserver {
  late final PocketStore store = PocketStore();
  late final AcademicSession session = AcademicSession(store);
  int tab = 0;
  bool showLab = false;
  bool showAcademic = false;
  Timer? _classRefreshTimer;
  bool _appIsForeground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Foreground-only pull on both Android and iOS. No claim of background
    // WeChat access, OS push delivery, or persistent login after a restart.
    _classRefreshTimer = Timer.periodic(const Duration(minutes: 3), (_) {
      if (_appIsForeground && session.identity != null) session.refresh();
    });
    MessageIntakeBridge.channel.setMethodCallHandler((call) async {
      if (call.method == 'sharedNotice') {
        MessageIntakeBridge.markChanged();
        if (mounted) _switchTab(2);
      }
    });
    store
        .load()
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
            _switchTab(2);
          }
        })
        .catchError((Object _) {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appIsForeground = state == AppLifecycleState.resumed;
    if (_appIsForeground && session.identity != null) {
      session.refresh();
    }
  }

  @override
  void dispose() {
    _classRefreshTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    MessageIntakeBridge.channel.setMethodCallHandler(null);
    session.dispose();
    store.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([store, session]),
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
                                    key: const ValueKey('today'),
                                    store: store,
                                    session: session,
                                    onNavigate: _switchTab,
                                  ),
                                  1 => SchedulePage(
                                    key: const ValueKey('schedule'),
                                    store: store,
                                  ),
                                  2 => InboxPage(
                                    key: const ValueKey('inbox'),
                                    store: store,
                                    session: session,
                                    onSaved: () => _switchTab(0),
                                  ),
                                  3 => FocusPage(
                                    key: const ValueKey('focus'),
                                    store: store,
                                  ),
                                  _ =>
                                    showAcademic
                                        ? AcademicPage(
                                            key: const ValueKey('academic'),
                                            store: store,
                                            session: session,
                                            onBack: () => setState(
                                              () => showAcademic = false,
                                            ),
                                          )
                                        : showLab
                                        ? TickerLabPage(
                                            key: const ValueKey('lab'),
                                            store: store,
                                            onBack: () =>
                                                setState(() => showLab = false),
                                          )
                                        : CampusPage(
                                            key: const ValueKey('campus'),
                                            store: store,
                                            onOpenLab: () =>
                                                setState(() => showLab = true),
                                            onOpenAcademic: () => setState(
                                              () => showAcademic = true,
                                            ),
                                          ),
                                },
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

  void _switchTab(int index) {
    if (index == tab) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => tab = index);
  }
}
