import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';

import 'core/pocket_store.dart';
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

class _HaizPocketAppState extends State<HaizPocketApp> {
  late final PocketStore store = PocketStore();
  int tab = 0;
  bool showLab = false;
  bool showAcademic = false;

  @override
  void initState() {
    super.initState();
    store.load();
  }

  @override
  void dispose() {
    store.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: store,
      builder: (context, _) {
        final p = PocketPalette.forName(store.appearance);
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'HAIZ Pocket · 校园学习空间',
          theme: buildHaizTheme(p),
          home: Builder(
            builder: (context) {
              final reduce = MediaQuery.of(context).disableAnimations;
              return PocketSkin(
                colors: p,
                reducedMotion: reduce,
                child: Scaffold(
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
                                      onNavigate: _switchTab,
                                    ),
                                    1 => SchedulePage(
                                      key: const ValueKey('schedule'),
                                      store: store,
                                    ),
                                    2 => InboxPage(
                                      key: const ValueKey('inbox'),
                                      store: store,
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
                                              onBack: () => setState(
                                                () => showAcademic = false,
                                              ),
                                            )
                                          : showLab
                                          ? TickerLabPage(
                                              key: const ValueKey('lab'),
                                              store: store,
                                              onBack: () => setState(
                                                () => showLab = false,
                                              ),
                                            )
                                          : CampusPage(
                                              key: const ValueKey('campus'),
                                              store: store,
                                              onOpenLab: () => setState(
                                                () => showLab = true,
                                              ),
                                              onOpenAcademic: () => setState(
                                                () => showAcademic = true,
                                              ),
                                            ),
                                  },
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
