import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/academic_session.dart';
import '../core/pocket_auth.dart';
import '../core/pocket_store.dart';
import '../design/components.dart';
import '../design/theme.dart';
import '../design/tokens.dart';
import '../domain/haiz_app_updates.dart';
import '../features/focus/focus_screen.dart';
import '../features/inbox/inbox_screen.dart';
import '../features/me/me_screen.dart';
import '../features/schedule/schedule_screen.dart';
import '../features/search/search_sheet.dart';
import '../features/tasks/capture_sheet.dart';
import '../features/tasks/task_editor.dart';
import '../features/tasks/tasks_screen.dart';
import '../features/today/today_screen.dart';
import '../ui/academic_page.dart';
import '../ui/pocket_account_sheet.dart';
import '../ui/ticker_lab_page.dart';
import 'nav.dart';

/// Five destinations by frequency of use. Focus is a mode reached from a
/// task (and a persistent bar while running), not a destination of its own.
class HaizShell extends StatefulWidget {
  const HaizShell({
    super.key,
    required this.store,
    required this.auth,
    required this.session,
    required this.initialTab,
    required this.onSignedOut,
  });

  final PocketStore store;
  final PocketAuthController auth;
  final AcademicSession session;
  final HaizTab initialTab;
  final VoidCallback onSignedOut;

  @override
  State<HaizShell> createState() => HaizShellState();
}

class HaizShellState extends State<HaizShell> with TickerProviderStateMixin implements HaizActions {
  late HaizTab _tab = widget.initialTab;
  final Set<HaizTab> _visited = {};
  String? _scope;
  bool _hasUpdate = false;
  late final AnimationController _fade = AnimationController(
    vsync: this, duration: Motion.base, value: 1);

  PocketStore get store => widget.store;

  @override
  void initState() {
    super.initState();
    _visited.add(_tab);
    _scope = store.namespace;
    store.addListener(_onStore);
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkUpdate());
  }

  Future<void> _checkUpdate() async {
    if (!HaizAppUpdates.available) return;
    try {
      final installed = await HaizAppUpdates.installed();
      final release = await HaizAppUpdates.check(current: installed);
      if (mounted) setState(() => _hasUpdate = release != null);
    } catch (_) {
      // Never block offline use or expose a network error on launch.
    }
  }

  void _onStore() {
    // A different principal gets fresh screens: no draft, scroll position or
    // selection from the previous account survives.
    if (store.namespace != _scope && store.namespace != null) {
      setState(() {
        _scope = store.namespace;
        _visited
          ..clear()
          ..add(HaizTab.today);
        _tab = HaizTab.today;
      });
    }
  }

  @override
  void dispose() {
    store.removeListener(_onStore);
    _fade.dispose();
    super.dispose();
  }

  @override
  bool get hasAppUpdate => _hasUpdate;

  @override
  void goTab(HaizTab tab) {
    if (tab == _tab) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _tab = tab;
      _visited.add(tab);
    });
    if (!HaizTheme.of(context).reduceMotion) _fade.forward(from: 0);
  }

  @override
  Future<void> capture({bool memo = false, String? initialText}) async {
    final result = await showHaizSheet<CaptureResult>(
      context,
      builder: (_) => CaptureSheet(store: store, memo: memo, initialText: initialText),
    );
    if (!mounted || result == null) return;
    showToast(context, result.message, action: '撤销', onAction: result.undo);
  }

  @override
  Future<void> openTask(String taskId) async {
    final task = store.taskById(taskId);
    if (task == null) return;
    await showTaskEditor(context, store: store, task: task, actions: this);
  }

  @override
  Future<void> openFocus({String? taskId}) async {
    if (taskId != null && store.focusSession == null) store.chooseFocusTask(taskId);
    await Navigator.of(context).push(focusRoute(store));
  }

  @override
  Future<void> openSearch() => showSearchSheet(context, store: store, actions: this);

  @override
  Future<void> openAccount({bool register = false}) async {
    // The legacy class-service session and the Pocket identity are separate
    // products; never let an academic namespace stay open under a new login.
    if (widget.session.userId != null) await widget.session.logout();
    if (!mounted) return;
    await showPocketAccountSheet(context, widget.auth, () {
      if (mounted) goTab(HaizTab.today);
    }, initiallyRegister: register);
  }

  @override
  Future<void> confirmSignOut() async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('退出账号？'),
        content: const Text('账号记录会立即从这台设备的界面上锁定，云端记录保留。本机访客空间独立保存，不受影响。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('退出登录')),
        ],
      ),
    );
    if (yes != true) return;
    await widget.auth.signOut();
    widget.onSignedOut();
  }

  @override
  Future<void> openAcademic() async {
    if (widget.auth.authenticated) {
      showToast(context, '班级同步使用独立的学校账号，暂不与 HAIZ 云端账号混用。请先退出 HAIZ 账号。');
      return;
    }
    await Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (route) => Scaffold(
        body: SafeArea(
          child: AcademicPage(
            store: store,
            session: widget.session,
            onBack: () => Navigator.of(route).pop(),
          ),
        ),
      ),
    ));
  }

  @override
  Future<void> openLab() async {
    await Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (route) => Scaffold(
        body: SafeArea(
          child: TickerLabPage(store: store, onBack: () => Navigator.of(route).pop()),
        ),
      ),
    ));
  }

  Widget _page(HaizTab tab) {
    final key = ValueKey('${tab.name}-$_scope');
    return switch (tab) {
      HaizTab.today => TodayScreen(key: key),
      HaizTab.tasks => TasksScreen(key: key),
      HaizTab.schedule => ScheduleScreen(key: key),
      HaizTab.inbox => InboxScreen(
          key: key,
          store: store,
          session: widget.auth.authenticated ? null : widget.session,
          onSaved: () => goTab(HaizTab.tasks),
        ),
      HaizTab.me => MeScreen(key: key),
    };
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    const tabBarHeight = 56.0;
    final bottomSafe = MediaQuery.paddingOf(context).bottom;
    return HaizScope(
      store: store,
      auth: widget.auth,
      session: widget.session,
      actions: this,
      child: Shortcuts(
        shortcuts: const {
          SingleActivator(LogicalKeyboardKey.keyK, control: true): _SearchIntent(),
          SingleActivator(LogicalKeyboardKey.keyK, meta: true): _SearchIntent(),
          SingleActivator(LogicalKeyboardKey.keyN, control: true): _CaptureIntent(),
          SingleActivator(LogicalKeyboardKey.keyN, meta: true): _CaptureIntent(),
        },
        child: Actions(
          actions: {
            _SearchIntent: CallbackAction<_SearchIntent>(onInvoke: (_) => openSearch()),
            _CaptureIntent: CallbackAction<_CaptureIntent>(onInvoke: (_) => capture()),
          },
          child: Focus(
            autofocus: true,
            child: Scaffold(
              backgroundColor: c.canvas,
              resizeToAvoidBottomInset: false,
              // Real Scaffold slots, so toasts and the capture button sit
              // above the tab bar and focus bar instead of covering them.
              floatingActionButton: ListenableBuilder(
                listenable: store,
                builder: (context, _) => _CaptureButton(
                  visible: (_tab == HaizTab.today || _tab == HaizTab.tasks) &&
                      store.ready && store.writable,
                  onTap: () => capture(memo: false),
                ),
              ),
              bottomNavigationBar: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  FocusBar(store: store, onOpen: () => openFocus()),
                  _TabBar(
                    tab: _tab,
                    onSelect: goTab,
                    bottomSafe: bottomSafe,
                    height: tabBarHeight,
                    inboxBadge: InboxScreen.pendingBadge,
                    meBadge: _hasUpdate,
                  ),
                ],
              ),
              body: Stack(
                children: [
                  for (final tab in HaizTab.values)
                    if (_visited.contains(tab))
                      Positioned.fill(
                        child: Offstage(
                          offstage: tab != _tab,
                          child: TickerMode(
                            enabled: tab == _tab,
                            // Same widget structure for every tab, so a
                            // tab keeps its state (scroll, drafts) when
                            // it is not the visible one.
                            child: FadeTransition(
                              opacity: tab == _tab
                                  ? CurvedAnimation(parent: _fade, curve: Motion.standard)
                                  : kAlwaysCompleteAnimation,
                              child: _page(tab),
                            ),
                          ),
                        ),
                      ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SearchIntent extends Intent { const _SearchIntent(); }
class _CaptureIntent extends Intent { const _CaptureIntent(); }

class _CaptureButton extends StatelessWidget {
  const _CaptureButton({required this.visible, required this.onTap});
  final bool visible;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final motion = context.haiz.motion(Motion.base);
    return AnimatedSlide(
      duration: motion,
      curve: Motion.enter,
      offset: Offset(0, visible ? 0 : .4),
      child: AnimatedOpacity(
        duration: motion,
        opacity: visible ? 1 : 0,
        child: IgnorePointer(
          ignoring: !visible,
          child: Tooltip(
            message: '新建（Ctrl/⌘ N）',
            child: Semantics(
              button: true,
              label: '新建任务或备忘',
              excludeSemantics: true,
              child: _Press(
                onTap: onTap,
                child: Container(
                  key: const Key('capture-button'),
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: c.inverse,
                    borderRadius: BorderRadius.circular(17),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: c.dark ? .5 : .16),
                          blurRadius: 14, offset: const Offset(0, 6)),
                    ],
                  ),
                  child: Icon(Icons.add_rounded, color: c.onInverse, size: 28),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Press extends StatefulWidget {
  const _Press({required this.child, required this.onTap});
  final Widget child;
  final VoidCallback onTap;
  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool _down = false;
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTapDown: (_) => setState(() => _down = true),
    onTapUp: (_) => setState(() => _down = false),
    onTapCancel: () => setState(() => _down = false),
    onTap: widget.onTap,
    child: MouseRegion(
      cursor: SystemMouseCursors.click,
      child: AnimatedScale(
        scale: _down && !context.haiz.reduceMotion ? .93 : 1,
        duration: Motion.press,
        child: widget.child,
      ),
    ),
  );
}

/// Solid tab bar on paper. The selected tab is marked by ink weight and a
/// short vermilion stroke at the top edge that travels with spring physics.
class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.tab,
    required this.onSelect,
    required this.bottomSafe,
    required this.height,
    required this.inboxBadge,
    required this.meBadge,
  });

  final HaizTab tab;
  final ValueChanged<HaizTab> onSelect;
  final double bottomSafe;
  final double height;
  final ValueListenable<int> inboxBadge;
  final bool meBadge;

  static const _items = [
    (HaizTab.today, '今天', Icons.wb_sunny_outlined, Icons.wb_sunny_rounded),
    (HaizTab.tasks, '待办', Icons.check_circle_outline_rounded, Icons.check_circle_rounded),
    (HaizTab.schedule, '课表', Icons.grid_view_outlined, Icons.grid_view_rounded),
    (HaizTab.inbox, '收件', Icons.move_to_inbox_outlined, Icons.move_to_inbox_rounded),
    (HaizTab.me, '我的', Icons.person_outline_rounded, Icons.person_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final index = _items.indexWhere((e) => e.$1 == tab);
    return Container(
      decoration: BoxDecoration(
        color: c.canvas,
        border: Border(top: BorderSide(color: c.rule, width: .6)),
      ),
      padding: EdgeInsets.only(bottom: bottomSafe),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: SizedBox(
            height: height,
            child: LayoutBuilder(builder: (context, box) {
              final cell = box.maxWidth / _items.length;
              return Stack(children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(end: index.toDouble()),
                  duration: context.haiz.motion(Motion.slow),
                  curve: Curves.easeOutBack,
                  builder: (context, v, _) => Positioned(
                    top: 0,
                    left: v * cell + cell / 2 - 10,
                    child: Container(width: 20, height: 2,
                        decoration: BoxDecoration(color: c.signal, borderRadius: BorderRadius.circular(1))),
                  ),
                ),
                Row(children: [
                  for (final (i, item) in _items.indexed)
                    Expanded(
                      child: Semantics(
                        selected: i == index,
                        button: true,
                        label: item.$2,
                        excludeSemantics: true,
                        child: GestureDetector(
                          key: Key('tab-${item.$1.name}'),
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            if (i != index) HapticFeedback.selectionClick();
                            onSelect(item.$1);
                          },
                          child: MouseRegion(
                            cursor: SystemMouseCursors.click,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Stack(clipBehavior: Clip.none, children: [
                                  Icon(i == index ? item.$4 : item.$3, size: 23,
                                      color: i == index ? c.ink : c.ink3),
                                  if (item.$1 == HaizTab.inbox)
                                    ValueListenableBuilder<int>(
                                      valueListenable: inboxBadge,
                                      builder: (context, n, _) => n == 0
                                          ? const SizedBox.shrink()
                                          : Positioned(right: -9, top: -4, child: _Badge('$n')),
                                    ),
                                  if (item.$1 == HaizTab.me && meBadge)
                                    Positioned(right: -2, top: -1, child: Container(width: 7, height: 7,
                                        decoration: BoxDecoration(color: c.signal, shape: BoxShape.circle))),
                                ]),
                                const SizedBox(height: 3),
                                Text(item.$2, style: TypeScale.micro(i == index ? c.ink : c.ink3)
                                    .copyWith(fontWeight: i == index ? FontWeight.w700 : FontWeight.w500)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ]),
              ]);
            }),
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      constraints: const BoxConstraints(minWidth: 16),
      height: 16,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(color: c.signal, borderRadius: BorderRadius.circular(8),
          border: Border.all(color: c.canvas, width: 1.5)),
      alignment: Alignment.center,
      child: Text(text, style: const TextStyle(fontSize: 9.5, height: 1, color: Colors.white, fontWeight: FontWeight.w700)),
    );
  }
}
