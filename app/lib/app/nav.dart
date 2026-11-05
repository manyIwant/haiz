import 'package:flutter/widgets.dart';

import '../core/academic_session.dart';
import '../core/pocket_auth.dart';
import '../core/pocket_store.dart';

enum HaizTab { today, tasks, schedule, inbox, me }

/// App-wide services and navigation available to every screen.
class HaizScope extends InheritedWidget {
  const HaizScope({
    super.key,
    required this.store,
    required this.auth,
    required this.session,
    required this.actions,
    required super.child,
  });

  final PocketStore store;
  final PocketAuthController auth;
  final AcademicSession session;
  final HaizActions actions;

  static HaizScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<HaizScope>();
    assert(scope != null, 'HaizScope missing');
    return scope!;
  }

  static HaizScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<HaizScope>();

  @override
  bool updateShouldNotify(HaizScope old) =>
      old.store != store || old.auth != auth || old.session != session ||
      old.actions != actions;
}

/// Cross-screen actions. Implemented by the shell so a screen never needs
/// to know where another screen lives.
abstract class HaizActions {
  void goTab(HaizTab tab);

  /// Shows that something landed in [tab] (a token flies there from [from]).
  void deliver(HaizTab tab, Rect from, String label, {VoidCallback? onArrived});
  Future<void> capture({bool memo = false, String? initialText});
  Future<void> openFocus({String? taskId});
  Future<void> openTask(String taskId);
  Future<void> openSearch();
  Future<void> openAccount({bool register = false});
  Future<void> confirmSignOut();
  Future<void> openAcademic();
  Future<void> openLab();
  bool get hasAppUpdate;
}
