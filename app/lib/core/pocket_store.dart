import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/pocket_models.dart';
import 'legacy_archive.dart';
import 'personal_snapshot.dart';
import 'storage_scope.dart';

/// Device-local personal data. Account namespaces require verified identity.
class PocketStore extends ChangeNotifier {
  final SharedPreferencesAsync _prefs = SharedPreferencesAsync();
  Future<void> _pending = Future.value();
  bool _disposed = false;
  bool ready = false;
  int generation = 0;
  String? namespace;
  Future<void> Function(String json)? _remoteWrite;
  bool get isCloudAccount => namespace?.startsWith('haiz/cloud/v1/') ?? false;
  String? storageError;
  bool legacyArchiveAvailable = false;
  bool _legacyImported = false;
  bool get legacyImported => _legacyImported;
  List<TaskItem> tasks = const [];
  List<CourseSlot> courses = const [];
  List<FocusLog> focusLogs = const [];
  Map<String, String> taskNotes = const {};
  String appearance = 'porcelain';
  String? activeTaskId;
  String? lastSavedTaskId;
  int selectedWeekday = DateTime.now().weekday;
  int focusTargetMinutes = 25;
  int focusRemaining = 25 * 60;
  bool focusRunning = false;
  DateTime? _focusEndsAt;
  Timer? _ticker;

  void _notify() { if (!_disposed) notifyListeners(); }

  /// Close visibility synchronously, before any disk/network await.
  void lock() {
    generation++;
    namespace = null;
    _remoteWrite = null;
    legacyArchiveAvailable = false;
    ready = false;
    _ticker?.cancel();
    _focusEndsAt = null;
    focusRunning = false;
    focusTargetMinutes = 25;
    focusRemaining = 25 * 60;
    tasks = const [];
    courses = const [];
    focusLogs = const [];
    taskNotes = const {};
    activeTaskId = null;
    lastSavedTaskId = null;
    appearance = 'porcelain';
    selectedWeekday = DateTime.now().weekday;
    _legacyImported = false;
    storageError = null;
    _notify();
  }

  Future<void> load() => openGuest();

  Future<void> openGuest() {
    lock();
    final ticket = generation;
    return _open(ticket, () async {
      var id = await _prefs.getString('haiz/installation/v1');
      if (id == null) {
        id = List.generate(24, (_) => Random.secure().nextInt(256)
            .toRadixString(16).padLeft(2, '0')).join();
        await _prefs.setString('haiz/installation/v1', id);
        if (await _prefs.getString('haiz/installation/v1') != id) {
          throw StateError('访客空间初始化校验失败');
        }
      }
      if (!RegExp(r'^[a-zA-Z0-9_-]{16,128}$').hasMatch(id)) {
        throw const FormatException('访客空间标识损坏');
      }
      return 'haiz/guest/v1/$id';
    });
  }

  Future<void> openAccount({required String origin,
      required Map<String, dynamic> identity}) {
    lock();
    final ticket = generation;
    return _open(ticket, () async => accountNamespace(origin, identity));
  }

  /// Signed-in data lives on a per-user RLS-protected server, not in
  /// SharedPreferences. Loading finishes before exposing its namespace.
  Future<void> openCloudAccount({
    required String userId,
    required Future<String?> Function() read,
    required Future<void> Function(String json) write,
  }) async {
    if (!RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(userId)) {
      throw const FormatException('服务器身份标识无效');
    }
    lock();
    final ticket = generation;
    await _pending;
    try {
      final raw = await read();
      if (_disposed || generation != ticket) return;
      final data = raw == null
          ? const PersonalSnapshot()
          : PersonalSnapshot.decode(raw);
      _remoteWrite = write;
      namespace = 'haiz/cloud/v1/$userId';
      _apply(data);
    } catch (error, stack) {
      if (_disposed || generation != ticket) return;
      storageError = '账号记录加载失败。未打开其他人的记录，请检查网络。';
      debugPrint('Cloud account load failed (\${error.runtimeType})\n$stack');
    }
    if (_disposed || generation != ticket) return;
    ready = true;
    _notify();
  }

  Future<void> _open(int ticket, Future<String> Function() resolve) async {
    await _pending;
    try {
      final scope = await resolve();
      final raw = await _prefs.getString('$scope/personal.v1');
      final data = raw == null ? const PersonalSnapshot() : PersonalSnapshot.decode(raw);
      if (_disposed || ticket != generation) return;
      namespace = scope;
      _apply(data);
      // Archive failures only hide the migration prompt and keep originals;
      // they must never make a healthy namespace read-only.
      try {
        legacyArchiveAvailable = await LegacyArchive(_prefs).quarantine();
      } catch (error, stack) {
        debugPrint('Legacy archive deferred (${error.runtimeType})\n$stack');
        legacyArchiveAvailable = false;
      }
    } catch (error, stack) {
      if (_disposed || ticket != generation) return;
      storageError = '本地记录暂不可用，原始数据已保留。请重试或联系支持。';
      debugPrint('Personal storage open failed (${error.runtimeType})\n$stack');
    }
    if (_disposed || ticket != generation) return;
    ready = true;
    _notify();
  }

  void _apply(PersonalSnapshot data) {
    tasks = List.unmodifiable(data.tasks);
    courses = List.unmodifiable(data.courses);
    focusLogs = List.unmodifiable(data.focusLogs);
    taskNotes = Map.unmodifiable(data.taskNotes);
    appearance = data.appearance;
    activeTaskId = data.activeTaskId;
    lastSavedTaskId = activeTaskId;
    _legacyImported = data.legacyImported;
  }

  PersonalSnapshot _snapshot() => PersonalSnapshot(
    tasks: tasks, courses: courses, focusLogs: focusLogs, taskNotes: taskNotes,
    activeTaskId: activeTaskId, appearance: appearance,
    legacyImported: _legacyImported,
  );

  bool get _writable => ready && namespace != null && storageError == null;

  void _persist() {
    final scope = namespace;
    if (!_writable || scope == null) return;
    final ticket = generation;
    final remoteWrite = _remoteWrite;
    final raw = _snapshot().encode();
    _pending = _pending.then((_) async {
      // Preserve queued legacy/guest writes in their original captured scope.
      // Only cloud writes need invalidation when the verified user changes.
      if (remoteWrite != null &&
          (_disposed || ticket != generation || namespace != scope)) return;
      try {
        if (remoteWrite case final save?) {
          await save(raw);
        } else {
          await _prefs.setString('$scope/personal.v1', raw);
          if (await _prefs.getString('$scope/personal.v1') != raw) {
            throw StateError('个人存储写入校验失败');
          }
        }
      } catch (error, stack) {
        debugPrint('Personal storage write failed (${error.runtimeType})\n$stack');
        if (ticket == generation && !_disposed) {
          storageError = '保存未成功；请保持应用打开并重试，原始记录仍保留。';
          _notify();
        }
      }
    });
  }

  Future<void> flush() async {
    await _pending;
    if (storageError != null) throw StateError(storageError!);
  }

  Future<void> importLegacyArchive({required bool ownerConfirmed}) async {
    final scope = namespace;
    if (!ownerConfirmed || !_writable || scope == null ||
        !scope.startsWith('haiz/v1/')) {
      throw StateError('须登录数据所属账号并明确确认后导入');
    }
    final ticket = generation;
    final archive = LegacyArchive(_prefs);
    await flush();
    try {
      final legacy = await archive.read();
      if (ticket != generation || _disposed) return;
      if (_legacyImported) return;
      // Compute inside the write queue so a queued edit cannot be overwritten
      // by a merge based on stale in-memory state.
      var merged = const PersonalSnapshot();
      final write = _pending.then((_) async {
        // Re-check inside the queue: the account may have been switched or
        // logged out while this migration waited behind earlier writes. The
        // confirmation belongs to the account that was open when it was given,
        // so a stale migration must neither claim the archive nor write it.
        if (ticket != generation ||
            _disposed ||
            namespace != scope ||
            !_writable) {
          throw StateError('账号已切换，旧数据迁移已取消；归档与原始记录仍保留');
        }
        merged = _mergeLegacy(legacy);
        await archive.claim(scope);
        final raw = merged.encode();
        await _prefs.setString('$scope/personal.v1', raw);
        if (await _prefs.getString('$scope/personal.v1') != raw) {
          throw StateError('历史导入校验失败，归档仍保留');
        }
      });
      _pending = write.catchError((Object _) {});
      await write;
      if (ticket == generation && !_disposed) {
        _apply(merged);
        _notify();
      }
    } catch (error) {
      if (ticket == generation && !_disposed && error is! StateError) {
        storageError = '旧数据导入未完成，归档和原始记录仍保留。';
        _notify();
      }
      rethrow;
    }
  }

  PersonalSnapshot _mergeLegacy(PersonalSnapshot legacy) {
    final ids = tasks.map((t) => t.id).toSet();
    final courseIds = courses.map((c) => c.id).toSet();
    if (legacy.tasks.any((t) => ids.contains(t.id)) ||
        legacy.courses.any((c) => courseIds.contains(c.id)) ||
        legacy.taskNotes.keys.any(taskNotes.containsKey)) {
      throw StateError('历史标识与当前记录冲突，请联系支持；双方记录均已保留');
    }
    return PersonalSnapshot(
      tasks: [...tasks, ...legacy.tasks], courses: [...courses, ...legacy.courses],
      focusLogs: [...focusLogs, ...legacy.focusLogs],
      taskNotes: {...legacy.taskNotes, ...taskNotes},
      activeTaskId: activeTaskId ?? legacy.activeTaskId,
      appearance: appearance, legacyImported: true,
    );
  }

  int get remainingCount => tasks.where((x) => !x.completed).length;
  int get doneCount => tasks.where((x) => x.completed).length;

  void setAppearance(String value) {
    if (!_writable || !['porcelain', 'obsidian', 'ocean'].contains(value)) return;
    appearance = value;
    _persist(); _notify();
  }

  void addTask(String title, String subject, {DateTime? due,
      String source = '', String originalNotice = ''}) {
    if (!_writable || title.trim().isEmpty) return;
    tasks = List.unmodifiable([
      TaskItem(id: newId(), title: title.trim(), subject: subject,
        dueIso: due == null ? null :
          '${due.year.toString().padLeft(4, '0')}-${due.month.toString().padLeft(2, '0')}-${due.day.toString().padLeft(2, '0')}',
        source: source, originalNotice: originalNotice), ...tasks,
    ]);
    _persist(); _notify();
  }

  /// Correct a task without changing its identifier, completion, or source trail.
  bool updateTask(
    String id, {
    required String title,
    required String subject,
    DateTime? due,
  }) {
    if (!_writable || title.trim().isEmpty || subject.trim().isEmpty) {
      return false;
    }
    final index = tasks.indexWhere((x) => x.id == id);
    if (index < 0) return false;
    final old = tasks[index];
    final updated = TaskItem(
      id: old.id,
      title: title.trim(),
      subject: subject.trim(),
      completed: old.completed,
      example: false,
      dueIso: due == null
          ? null
          : '${due.year.toString().padLeft(4, '0')}-${due.month.toString().padLeft(2, '0')}-${due.day.toString().padLeft(2, '0')}',
      source: old.source,
      originalNotice: old.originalNotice,
    );
    tasks = List.unmodifiable([...tasks]..[index] = updated);
    _persist();
    _notify();
    return true;
  }

  /// Restore a just-deleted task, including its private note. No cross-account undo.
  bool restoreTask(TaskItem task, {String note = '', bool reactivate = false}) {
    if (!_writable || tasks.any((t) => t.id == task.id)) return false;
    tasks = List.unmodifiable([...tasks, task]);
    if (note.isNotEmpty) {
      taskNotes = Map.unmodifiable({...taskNotes, task.id: note});
    }
    if (reactivate) {
      activeTaskId = task.id;
      lastSavedTaskId = task.id;
    }
    _persist();
    _notify();
    return true;
  }

  void toggleTask(String id) {
    if (!_writable) return;
    tasks = List.unmodifiable(tasks.map((x) => x.id == id
        ? x.copyWith(completed: !x.completed) : x));
    _persist(); _notify();
  }

  void deleteTask(String id) {
    if (!_writable) return;
    tasks = List.unmodifiable(tasks.where((x) => x.id != id));
    taskNotes = Map.unmodifiable({for (final e in taskNotes.entries)
      if (e.key != id) e.key: e.value});
    if (activeTaskId == id) { activeTaskId = null; lastSavedTaskId = null; }
    _persist(); _notify();
  }

  String noteFor(String id) => taskNotes[id] ?? '';

  void setTaskNote(String id, String note) {
    if (!_writable || !tasks.any((t) => t.id == id)) return;
    taskNotes = Map.unmodifiable({...taskNotes, id: note});
    _persist(); _notify();
  }

  List<TaskItem> get upcomingTasks => tasks
      .where((t) => !t.completed && t.dueIso != null).toList()
      ..sort((a, b) => a.dueIso!.compareTo(b.dueIso!));

  TaskItem? get activeTask {
    for (final task in tasks) { if (task.id == activeTaskId) return task; }
    return null;
  }

  void chooseFocusTask(String? id) {
    if (!_writable || (id != null && !tasks.any((t) => t.id == id))) return;
    activeTaskId = id; lastSavedTaskId = id;
    _persist(); _notify();
  }

  void setDay(int day) { selectedWeekday = day.clamp(1, 7); _notify(); }

  void addCourse({required String name, required int weekday,
      required int startMinute, required int endMinute, String location = ''}) {
    if (!_writable || name.trim().isEmpty || endMinute <= startMinute ||
        weekday < 1 || weekday > 7 || startMinute < 0 || endMinute > 1440) {
      return;
    }
    courses = List.unmodifiable([...courses,
      CourseSlot(id: newId(), name: name.trim(), weekday: weekday,
        startMinute: startMinute, endMinute: endMinute, location: location.trim())]);
    _persist(); _notify();
  }

  void deleteCourse(String id) {
    if (!_writable) return;
    courses = List.unmodifiable(courses.where((x) => x.id != id));
    _persist(); _notify();
  }

  void setFocusDuration(int minutes) {
    if (!_writable || focusRunning) return;
    focusTargetMinutes = minutes.clamp(1, 90);
    focusRemaining = focusTargetMinutes * 60;
    _notify();
  }

  void startFocus() {
    if (!_writable || focusRunning) return;
    focusRunning = true;
    _focusEndsAt = DateTime.now().add(Duration(seconds: focusRemaining));
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    _notify();
  }

  void _tick() {
    final endAt = _focusEndsAt;
    if (!focusRunning || endAt == null) return;
    focusRemaining = endAt.difference(DateTime.now()).inSeconds
        .clamp(0, focusTargetMinutes * 60);
    if (focusRemaining == 0) { finishFocus(auto: true); } else { _notify(); }
  }

  void pauseFocus() {
    if (!focusRunning) return;
    _tick(); focusRunning = false; _focusEndsAt = null;
    _ticker?.cancel(); _notify();
  }

  void finishFocus({bool auto = false}) {
    if (!_writable) return;
    if (focusRunning && !auto) {
      final endAt = _focusEndsAt;
      if (endAt != null) {
        focusRemaining = endAt.difference(DateTime.now()).inSeconds
            .clamp(0, focusTargetMinutes * 60);
      }
    }
    _ticker?.cancel(); _focusEndsAt = null; focusRunning = false;
    final minutes = ((focusTargetMinutes * 60 - focusRemaining) / 60).round();
    if (minutes > 0) {
      focusLogs = List.unmodifiable([FocusLog(at: DateTime.now(), minutes: minutes,
        label: activeTask?.title ?? '自主学习'), ...focusLogs]);
      _persist();
    }
    focusRemaining = focusTargetMinutes * 60; _notify();
  }

  int get todayFocusMinutes => focusMinutesToday(focusLogs, DateTime.now());

  @override
  void dispose() { _disposed = true; generation++; _ticker?.cancel(); super.dispose(); }
}
