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
import '../design/morph_route.dart';
import '../glass/glass.dart';
import '../glass/glass_prefs.dart';
import '../ui/ticker_lab_page.dart';
import 'chrome.dart';
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
  final GlobalKey _captureAnchor = GlobalKey();
  final Map<HaizTab, GlobalKey> _tabKeys = {for (final t in HaizTab.values) t: GlobalKey()};
  final ValueNotifier<(HaizTab, int)?> _pulse = ValueNotifier(null);
  int _pulses = 0;

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
    _pulse.dispose();
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

  /// Shows where something went: a token travels from [from] into the tab
  /// that now holds it, which bumps once on arrival.
  @override
  void deliver(HaizTab tab, Rect from, String label, {VoidCallback? onArrived}) {
    final overlay = Overlay.maybeOf(context);
    final target = _tabKeys[tab]?.currentContext?.findRenderObject() as RenderBox?;
    void bump() {
      _pulse.value = (tab, ++_pulses);
      if (mounted) onArrived?.call();
    }
    if (overlay == null || target == null || !target.attached || HaizTheme.of(context).reduceMotion) {
      bump();
      return;
    }
    // Nothing may sit over the token's path into the tab bar.
    ScaffoldMessenger.maybeOf(context)?.hideCurrentSnackBar();
    final to = target.localToGlobal(target.size.center(Offset.zero));
    late OverlayEntry entry;
    entry = OverlayEntry(builder: (_) => DeliveryToken(
      from: from.center,
      to: to,
      label: label,
      colors: context.c,
      onArrive: bump,
      onDone: () => entry.remove(),
    ));
    overlay.insert(entry);
  }

  @override
  Future<void> capture({bool memo = false, String? initialText}) async {
    // The sheet grows out of the "+" it came from (or, from the keyboard
    // shortcut or an empty state, out of the bottom edge).
    final anchor = _captureAnchor.currentContext?.findRenderObject() as RenderBox?;
    final size = MediaQuery.sizeOf(context);
    final origin = anchor != null && anchor.hasSize && anchor.attached
        ? anchor.localToGlobal(Offset.zero) & anchor.size
        : Rect.fromLTWH(size.width / 2 - 28, size.height - 80, 56, 56);
    final result = await showMorphSheet<CaptureResult>(
      context,
      origin: origin,
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
          onSaved: () {},
          onCommitted: (from, count) {
            // The confirmation appears once the token has landed in 待办,
            // so the destination is never hidden behind the toast.
            deliver(HaizTab.tasks, from, '+$count', onArrived: () =>
                showToast(context, '已加入待办 $count 项', action: '查看', onAction: () => goTab(HaizTab.tasks)));
          },
        ),
      HaizTab.me => MeScreen(key: key),
    };
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final media = MediaQuery.of(context);
    final bottomSafe = media.padding.bottom;
    final barBottom = bottomSafe + ChromeMetrics.gap;
    final rowBottom = barBottom + ChromeMetrics.barHeight + 12;
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
              body: ValueListenableBuilder<String>(
                valueListenable: GlassPreference.value,
                builder: (context, pref, _) => GlassScope(
                  mode: GlassPreference.resolve(context, pref),
                  dark: c.dark,
                  paper: c.canvas,
                  ink: c.inverse,
                  ground: c.canvas,
                  // Pages run under the floating chrome; their scroll content
                  // is padded so the last row can always rise above it.
                  content: MediaQuery(
                    data: media.copyWith(padding: media.padding.copyWith(bottom: barBottom + ChromeMetrics.barHeight)),
                    child: Stack(children: [
                      for (final tab in HaizTab.values)
                        if (_visited.contains(tab))
                          Positioned.fill(
                            child: Offstage(
                              offstage: tab != _tab,
                              child: TickerMode(
                                enabled: tab == _tab,
                                // Same structure for every tab, so a tab keeps
                                // its state when not visible; shared-element
                                // transitions only consider the visible tab.
                                child: HeroMode(
                                  enabled: tab == _tab,
                                  child: FadeTransition(
                                    opacity: tab == _tab
                                        ? CurvedAnimation(parent: _fade, curve: Motion.standard)
                                        : kAlwaysCompleteAnimation,
                                    child: _page(tab),
                                  ),
                                ),
                              ),
                            ),
                          ),
                    ]),
                  ),
                  overlay: ListenableBuilder(
                    listenable: store,
                    builder: (context, _) {
                      final capture = (_tab == HaizTab.today || _tab == HaizTab.tasks) && store.ready && store.writable;
                      final focus = store.focusSession != null;
                      ChromeMetrics.lift = (focus || capture ? rowBottom + ChromeMetrics.rowHeight : barBottom + ChromeMetrics.barHeight) + 8;
                      return Stack(children: [
                        Positioned(
                          left: 16,
                          right: 16,
                          bottom: rowBottom,
                          child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                            Expanded(child: focus ? FocusCapsule(store: store, onOpen: () => openFocus()) : const SizedBox.shrink()),
                            if (focus && capture) const SizedBox(width: 10),
                            GlassCaptureButton(anchor: _captureAnchor, visible: capture, onTap: () => this.capture()),
                          ]),
                        ),
                        Positioned(
                          left: 16,
                          right: 16,
                          bottom: barBottom,
                          child: Center(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 520),
                              child: GlassTabBar(
                                tab: _tab,
                                onSelect: goTab,
                                inboxBadge: InboxScreen.pendingBadge,
                                meBadge: _hasUpdate,
                                pulse: _pulse,
                                itemKeys: _tabKeys,
                              ),
                            ),
                          ),
                        ),
                      ]);
                    },
                  ),
                ),
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
