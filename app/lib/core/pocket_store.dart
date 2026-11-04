import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/pocket_models.dart';
import 'haiz_extension.dart';
import 'legacy_archive.dart';
import 'personal_snapshot.dart';
import 'personal_backup.dart';
import 'storage_scope.dart';

export 'haiz_extension.dart'
    show NoteItem, TrashEntry, TaskMeta, FocusSession, FocusPhase;

/// Thrown by a cloud writer when another device saved a newer revision.
/// Unlike transient failures it is not retried automatically.
class SnapshotConflict extends StateError {
  SnapshotConflict(super.message);
}

enum SyncPhase { idle, saving, saved, failed, conflict }

/// Observable save state, separate from the store so a save does not
/// rebuild every list. "saved" means the write was read back (device) or
/// acknowledged with a new revision (cloud).
@immutable
class SyncStatus {
  const SyncStatus(this.phase, {this.at, this.cloud = false});
  final SyncPhase phase;
  final DateTime? at;
  final bool cloud;
}

enum _Fault { none, load, write, conflict }

/// Device-local personal data. Account namespaces require verified identity.
///
/// Responsibilities kept here: namespace isolation, the serialized write
/// queue and every mutation of the personal snapshot. Timer display and save
/// status are exposed as separate listenables so a ticking focus clock or a
/// background save never forces the whole app to rebuild.
class PocketStore extends ChangeNotifier {
  final SharedPreferencesAsync _prefs = SharedPreferencesAsync();
  Future<void> _pending = Future.value();
  bool _disposed = false;
  bool _backupRestoreInProgress = false;
  bool ready = false;
  bool semanticExtractionConsent = false;
  int generation = 0;
  String? namespace;
  Future<void> Function(String json)? _remoteWrite;
  Future<String?> Function()? _remoteRead;
  bool get isCloudAccount => namespace?.startsWith('haiz/cloud/v1/') ?? false;
  String? storageError;
  _Fault _fault = _Fault.none;
  bool legacyArchiveAvailable = false;
  bool _legacyImported = false;
  bool get legacyImported => _legacyImported;
  List<TaskItem> tasks = const [];
  List<CourseSlot> courses = const [];
  List<FocusLog> focusLogs = const [];
  Map<String, String> taskNotes = const {};
  String appearance = 'porcelain';
  HaizExtension ext = const HaizExtension();
  String? activeTaskId;
  String? lastSavedTaskId;
  int selectedWeekday = DateTime.now().weekday;

  /// Save state for the sync indicator.
  final ValueNotifier<SyncStatus> sync =
      ValueNotifier(const SyncStatus(SyncPhase.idle));

  /// Remaining focus seconds, updated once a second only while running.
  final ValueNotifier<int> focusClock = ValueNotifier(25 * 60);
  Timer? _ticker;

  /// Set when a session ended while the app was closed or in background.
  String? focusNotice;

  /// Unsubmitted text (capture box, inbox paste). Memory-only for cloud
  /// accounts; guests also keep it on this device. Cleared on every lock.
  final Map<String, String> _drafts = {};
  Timer? _draftSave;

  /// Injectable clock for deterministic tests.
  DateTime Function() now = DateTime.now;

  void _notify() { if (!_disposed) notifyListeners(); }

  /// Close visibility synchronously, before any disk/network await.
  void lock() {
    generation++;
    _backupRestoreInProgress = false;
    namespace = null;
    _remoteWrite = null;
    _remoteRead = null;
    legacyArchiveAvailable = false;
    semanticExtractionConsent = false;
    ready = false;
    _ticker?.cancel();
    _ticker = null;
    _draftSave?.cancel();
    _draftSave = null;
    _drafts.clear();
    tasks = const [];
    courses = const [];
    focusLogs = const [];
    taskNotes = const {};
    ext = const HaizExtension();
    focusNotice = null;
    activeTaskId = null;
    lastSavedTaskId = null;
    appearance = 'porcelain';
    selectedWeekday = DateTime.now().weekday;
    _legacyImported = false;
    storageError = null;
    _fault = _Fault.none;
    _setSync(const SyncStatus(SyncPhase.idle));
    focusClock.value = focusTargetMinutes * 60;
    _notify();
  }

  void _setSync(SyncStatus value) {
    if (!_disposed) sync.value = value;
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
      _remoteRead = read;
      namespace = 'haiz/cloud/v1/$userId';
      _apply(data);
      _setSync(SyncStatus(SyncPhase.saved, at: now(), cloud: true));
    } catch (error, stack) {
      if (_disposed || generation != ticket) return;
      storageError = '账号记录加载失败。未打开其他人的记录，请检查网络。';
      _fault = _Fault.load;
      debugPrint('Cloud account load failed (${error.runtimeType})\n$stack');
    }
    if (_disposed || generation != ticket) return;
    ready = true;
    _reconcileFocus();
    _notify();
  }

  Future<void> _open(int ticket, Future<String> Function() resolve) async {
    await _pending;
    try {
      final scope = await resolve();
      final raw = await _prefs.getString('$scope/personal.v1');
      final data = raw == null ? const PersonalSnapshot() : PersonalSnapshot.decode(raw);
      if (_disposed || ticket != generation) return;
      // One-time rollback point before 2.0 adds its extension to a 1.5.5
      // record. Never overwritten; failure to create it never blocks use.
      if (raw != null && data.ext.isEmpty) {
        try {
          final backupKey = '$scope/personal.v1.pre2';
          if (await _prefs.getString(backupKey) == null) {
            await _prefs.setString(backupKey, raw);
          }
        } catch (error) {
          debugPrint('Pre-2.0 rollback copy skipped (${error.runtimeType})');
        }
        if (_disposed || ticket != generation) return;
      }
      namespace = scope;
      _apply(data);
      semanticExtractionConsent = scope.startsWith('haiz/v1/') &&
          await _prefs.getBool('$scope/semantic-extraction-consent.v1') == true;
      if (_disposed || ticket != generation) return;
      if (scope.startsWith('haiz/guest/v1/')) {
        try {
          final drafts = await _prefs.getString('$scope/drafts.v1');
          if (drafts != null) {
            final value = jsonDecode(drafts);
            if (value is Map) {
              for (final e in value.entries) {
                if (e.key is String && e.value is String) {
                  _drafts[e.key as String] = e.value as String;
                }
              }
            }
          }
        } catch (_) {
          // A damaged draft cache is disposable; personal data is not.
        }
        if (_disposed || ticket != generation) return;
      }
      // Archive failures only hide the migration prompt and keep originals;
      // they must never make a healthy namespace read-only.
      try {
        legacyArchiveAvailable = await LegacyArchive(_prefs).quarantine();
      } catch (error, stack) {
        debugPrint('Legacy archive deferred (${error.runtimeType})\n$stack');
        legacyArchiveAvailable = false;
      }
      _setSync(SyncStatus(SyncPhase.saved, at: now()));
    } catch (error, stack) {
      if (_disposed || ticket != generation) return;
      storageError = '本地记录暂不可用，原始数据已保留。请重试或联系支持。';
      _fault = _Fault.load;
      debugPrint('Personal storage open failed (${error.runtimeType})\n$stack');
    }
    if (_disposed || ticket != generation) return;
    ready = true;
    _reconcileFocus();
    _notify();
  }

  void _apply(PersonalSnapshot data) {
    tasks = List.unmodifiable(data.tasks);
    courses = List.unmodifiable(data.courses);
    focusLogs = List.unmodifiable(data.focusLogs);
    taskNotes = Map.unmodifiable(data.taskNotes);
    appearance = data.appearance;
    ext = data.ext;
    activeTaskId = data.activeTaskId;
    lastSavedTaskId = activeTaskId;
    _legacyImported = data.legacyImported;
    focusClock.value = focusRemaining;
  }

  PersonalSnapshot _snapshot() => PersonalSnapshot(
    tasks: tasks, courses: courses, focusLogs: focusLogs, taskNotes: taskNotes,
    activeTaskId: activeTaskId, appearance: appearance,
    legacyImported: _legacyImported, ext: ext,
  );

  bool get _writable => ready && namespace != null &&
      storageError == null && !_backupRestoreInProgress;

  /// True when edits are accepted right now.
  bool get writable => _writable;

  bool get guestBackupAvailable => _writable &&
      (namespace?.startsWith('haiz/guest/v1/') ?? false);

  /// Guest backups are never posted to the server or mixed with RLS accounts.
  Future<String> exportGuestBackup() async {
    if (!guestBackupAvailable) throw StateError('仅本机访客空间支持手动备份');
    final ticket = generation;
    final scope = namespace;
    await flush();
    if (ticket != generation || scope != namespace ||
        !guestBackupAvailable) {
      throw StateError('数据空间已切换，已取消导出');
    }
    return PersonalBackup.create(_snapshot());
  }

  /// Add nonconflicting records into the current guest workspace.
  /// The existing snapshot is never overwritten or deleted.
  Future<BackupMerge> mergeGuestBackup(
    PersonalBackup backup, {required bool confirmed}
  ) async {
    if (!confirmed || !guestBackupAvailable) {
      throw StateError('须在本机访客空间明确确认后才能导入备份');
    }
    final ticket = generation;
    final scope = namespace!;
    _backupRestoreInProgress = true;
    try {
      await flush();
      if (_disposed || generation != ticket || namespace != scope) {
        throw StateError('数据空间已切换，导入已取消');
      }
      final result = PersonalBackup.merge(_snapshot(), backup.snapshot);
      final raw = result.merged.encode();
      // Save and read back before showing restored personal information.
      await _prefs.setString('$scope/personal.v1', raw);
      if (await _prefs.getString('$scope/personal.v1') != raw) {
        throw StateError('备份保存校验失败，原始文件仍保留');
      }
      if (_disposed || generation != ticket || namespace != scope) {
        throw StateError('账号已经切换，未向新空间载入备份');
      }
      _apply(result.merged);
      _notify();
      return result;
    } finally {
      if (generation == ticket) _backupRestoreInProgress = false;
    }
  }

  void _persist() {
    final scope = namespace;
    if (!_writable || scope == null) return;
    final ticket = generation;
    final remoteWrite = _remoteWrite;
    final raw = _snapshot().encode();
    _setSync(SyncStatus(SyncPhase.saving, cloud: remoteWrite != null));
    _pending = _pending.then((_) async {
      // Preserve queued legacy/guest writes in their original captured scope.
      // Only cloud writes need invalidation when the verified user changes.
      if (remoteWrite != null &&
          (_disposed || ticket != generation || namespace != scope)) {
        return;
      }
      try {
        await _write(scope, raw, remoteWrite);
        if (ticket == generation && !_disposed && _fault == _Fault.none) {
          _setSync(SyncStatus(SyncPhase.saved, at: now(), cloud: remoteWrite != null));
        }
      } catch (error, stack) {
        debugPrint('Personal storage write failed (${error.runtimeType})\n$stack');
        if (ticket == generation && !_disposed) {
          _markWriteFault(error);
          _notify();
        }
      }
    });
  }

  Future<void> _write(String scope, String raw,
      Future<void> Function(String)? remoteWrite) async {
    if (remoteWrite case final save?) {
      await save(raw);
    } else {
      await _prefs.setString('$scope/personal.v1', raw);
      if (await _prefs.getString('$scope/personal.v1') != raw) {
        throw StateError('个人存储写入校验失败');
      }
    }
  }

  void _markWriteFault(Object error) {
    if (error is SnapshotConflict) {
      _fault = _Fault.conflict;
      storageError = '另一台设备更新了云端记录。为避免覆盖，本机已暂停保存。';
      _setSync(SyncStatus(SyncPhase.conflict, cloud: true));
    } else {
      if (_fault != _Fault.conflict) _fault = _Fault.write;
      storageError ??= '保存未成功；请保持应用打开并重试，原始记录仍保留。';
      _setSync(SyncStatus(SyncPhase.failed, cloud: isCloudAccount));
    }
  }

  /// The failure can be recovered by writing the current state again.
  bool get canRetrySave => _fault == _Fault.write;

  /// A newer cloud revision exists; the user must choose how to continue.
  bool get hasCloudConflict => _fault == _Fault.conflict;

  /// Writes the current in-memory state again after a transient failure.
  /// Load failures and cloud conflicts are never "fixed" by a blind write.
  Future<bool> retrySave() async {
    final scope = namespace;
    if (!canRetrySave || scope == null || !ready) return false;
    final ticket = generation;
    final remoteWrite = _remoteWrite;
    final raw = _snapshot().encode();
    _setSync(SyncStatus(SyncPhase.saving, cloud: remoteWrite != null));
    try {
      await _pending;
      await _write(scope, raw, remoteWrite);
      if (ticket != generation || _disposed) return false;
      storageError = null;
      _fault = _Fault.none;
      _setSync(SyncStatus(SyncPhase.saved, at: now(), cloud: remoteWrite != null));
      _notify();
      return true;
    } catch (error) {
      if (ticket == generation && !_disposed) {
        _markWriteFault(error);
        _notify();
      }
      return false;
    }
  }

  /// Conflict option A: discard this device's unsaved state, load the cloud.
  Future<bool> reloadFromCloud() => _resolveConflict(merge: false);

  /// Conflict option B: keep every record from both sides (by id; this
  /// device's version wins for the same id), then save as a new revision.
  Future<bool> mergeWithCloud() => _resolveConflict(merge: true);

  Future<bool> _resolveConflict({required bool merge}) async {
    final read = _remoteRead;
    final write = _remoteWrite;
    if (!hasCloudConflict || read == null || write == null) return false;
    final ticket = generation;
    final local = _snapshot();
    try {
      await _pending;
      final raw = await read(); // Also refreshes the expected revision.
      if (ticket != generation || _disposed) return false;
      final remote = raw == null ? const PersonalSnapshot() : PersonalSnapshot.decode(raw);
      final next = merge ? mergeSnapshots(local: local, remote: remote) : remote;
      if (merge) await write(next.encode());
      if (ticket != generation || _disposed) return false;
      _apply(next);
      storageError = null;
      _fault = _Fault.none;
      _setSync(SyncStatus(SyncPhase.saved, at: now(), cloud: true));
      _reconcileFocus();
      _notify();
      return true;
    } catch (error) {
      if (ticket == generation && !_disposed) {
        _markWriteFault(error is SnapshotConflict ? error : SnapshotConflict('$error'));
        _notify();
      }
      return false;
    }
  }

  Future<void> setSemanticExtractionConsent(bool value) async {
    final scope = namespace;
    if (!_writable || scope == null || !scope.startsWith('haiz/v1/')) {
      throw StateError('请先登录已核准的班级账号。');
    }
    final ticket = generation;
    await _prefs.setBool('$scope/semantic-extraction-consent.v1', value);
    if (_disposed || ticket != generation || namespace != scope) return;
    semanticExtractionConsent = value;
    _notify();
  }

  Future<void> flush() async {
    await _pending;
    if (storageError != null) throw StateError(storageError!);
  }

  Future<void> importLegacyArchive({required bool ownerConfirmed}) async {
    final scope = namespace;
    if (!ownerConfirmed ||
        !_writable ||
        scope == null ||
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
      // Serialize the archive write but rebase against live in-memory edits.
      // Ordinary edits remain synchronous and can occur across any await.
      final write = _pending.then((_) async {
        if (ticket != generation ||
            _disposed ||
            namespace != scope ||
            !_writable) {
          throw StateError('账号已切换，旧数据迁移已取消；归档与原始记录仍保留');
        }
        if (_legacyImported) {
          return; // A second concurrent import is already done.
        }
        _mergeLegacy(legacy); // Check conflicts BEFORE claiming ownership.
        await archive.claim(scope);
        if (ticket != generation ||
            _disposed ||
            namespace != scope ||
            !_writable) {
          // The ownership claim was for the former account. Never bring
          // its data into the new account; the original owner can retry.
          return;
        }

        // Incorporate edits performed during the ownership claim.
        final mergedForDisk = _mergeLegacy(legacy);
        final raw = mergedForDisk.encode();
        await _prefs.setString('$scope/personal.v1', raw);
        if (await _prefs.getString('$scope/personal.v1') != raw) {
          throw StateError('历史导入校验失败，归档仍保留');
        }
        if (ticket != generation ||
            _disposed ||
            namespace != scope ||
            !_writable) {
          return; // Never expose A's archive in another account's state.
        }

        // More edits may have happened while the destination write was pending.
        // Rebase again and queue a final snapshot AFTER those ordinary writes;
        // otherwise an older queued save would silently erase the imported data.
        final current = _mergeLegacy(legacy);
        _apply(current);
        _persist();
        _notify();
      });
      _pending = write.catchError((Object _) {});
      await write;
      await flush(); // Do not report import complete before the final save.
    } catch (error) {
      if (ticket == generation && !_disposed && error is! StateError) {
        storageError = '旧数据导入未完成，归档和原始记录仍保留。';
        _fault = _Fault.load;
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
      appearance: appearance, legacyImported: true, ext: ext,
    );
  }

  // ---------------------------------------------------------------- tasks

  int get remainingCount => tasks.where((x) => !x.completed).length;
  int get doneCount => tasks.where((x) => x.completed).length;

  TaskMeta metaFor(String id) => ext.taskMeta[id] ?? const TaskMeta();

  void _setMeta(String id, TaskMeta meta) {
    ext = ext.copyWith(taskMeta: Map.unmodifiable({...ext.taskMeta, id: meta}));
  }

  void setAppearance(String value) {
    if (!_writable || !['porcelain', 'obsidian', 'ocean'].contains(value)) return;
    appearance = value;
    _persist(); _notify();
  }

  /// 'system', 'light' or 'dark'. The 1.5.5 field follows explicit choices
  /// so a 1.5.5 client opening the same record shows a matching theme.
  String get themeMode => ext.themeMode;

  void setThemeMode(String mode) {
    if (!_writable || !HaizExtension.themeModes.contains(mode)) return;
    ext = ext.copyWith(themeMode: mode);
    if (mode == 'light') appearance = 'porcelain';
    if (mode == 'dark') appearance = 'obsidian';
    _persist(); _notify();
  }

  static String _iso(DateTime due) =>
      '${due.year.toString().padLeft(4, '0')}-${due.month.toString().padLeft(2, '0')}-${due.day.toString().padLeft(2, '0')}';

  /// Returns the new task id, or null when nothing was written.
  String? addTask(String title, String subject, {DateTime? due,
      String source = '', String originalNotice = '', String note = ''}) {
    if (!_writable || title.trim().isEmpty) return null;
    final id = newId();
    tasks = List.unmodifiable([
      TaskItem(id: id, title: title.trim(), subject: subject,
        dueIso: due == null ? null : _iso(due),
        source: source, originalNotice: originalNotice), ...tasks,
    ]);
    final stamp = now();
    _setMeta(id, TaskMeta(createdAt: stamp, updatedAt: stamp));
    if (note.trim().isNotEmpty) {
      taskNotes = Map.unmodifiable({...taskNotes, id: note.trim()});
    }
    _persist(); _notify();
    return id;
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
      dueIso: due == null ? null : _iso(due),
      source: old.source,
      originalNotice: old.originalNotice,
    );
    tasks = List.unmodifiable([...tasks]..[index] = updated);
    _setMeta(id, metaFor(id).copyWith(updatedAt: now()));
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
    ext = ext.copyWith(trash: List.unmodifiable(
        ext.trash.where((entry) => entry.task.id != task.id)));
    _persist();
    _notify();
    return true;
  }

  /// Restore from "最近删除".
  bool restoreFromTrash(String id) {
    final matches = ext.trash.where((e) => e.task.id == id);
    if (matches.isEmpty) return false;
    final entry = matches.first;
    return restoreTask(entry.task, note: entry.note);
  }

  void emptyTrash() {
    if (!_writable || ext.trash.isEmpty) return;
    ext = ext.copyWith(trash: const []);
    _persist(); _notify();
  }

  void toggleTask(String id) {
    final task = tasks.where((x) => x.id == id);
    if (task.isEmpty) return;
    setTaskCompleted(id, !task.first.completed);
  }

  void setTaskCompleted(String id, bool completed) {
    if (!_writable || !tasks.any((x) => x.id == id && x.completed != completed)) {
      return;
    }
    tasks = List.unmodifiable(tasks.map((x) => x.id == id
        ? x.copyWith(completed: completed) : x));
    final meta = metaFor(id);
    _setMeta(id, completed
        ? meta.copyWith(completedAt: now(), updatedAt: now())
        : meta.copyWith(clearCompleted: true, updatedAt: now()));
    _persist(); _notify();
  }

  /// Deletes a task; it is kept in 最近删除 unless [toTrash] is false
  /// (used when undoing a capture that was never really kept).
  void deleteTask(String id, {bool toTrash = true}) {
    if (!_writable) return;
    final removed = tasks.where((x) => x.id == id).toList();
    tasks = List.unmodifiable(tasks.where((x) => x.id != id));
    final note = taskNotes[id] ?? '';
    taskNotes = Map.unmodifiable({for (final e in taskNotes.entries)
      if (e.key != id) e.key: e.value});
    if (activeTaskId == id) { activeTaskId = null; lastSavedTaskId = null; }
    if (removed.isNotEmpty && toTrash) {
      ext = ext.copyWith(trash: List.unmodifiable([
        TrashEntry(task: removed.first, deletedAt: now(), note: note),
        ...ext.trash.where((e) => e.task.id != id),
      ].take(HaizExtension.maxTrash)));
    }
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

  TaskItem? taskById(String? id) {
    if (id == null) return null;
    for (final task in tasks) { if (task.id == id) return task; }
    return null;
  }

  void chooseFocusTask(String? id) {
    if (!_writable || (id != null && !tasks.any((t) => t.id == id))) return;
    activeTaskId = id; lastSavedTaskId = id;
    _persist(); _notify();
  }

  // ---------------------------------------------------------------- notes

  List<NoteItem> get notes => List.unmodifiable(
      [...ext.notes]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt)));

  NoteItem? noteById(String id) {
    for (final note in ext.notes) { if (note.id == id) return note; }
    return null;
  }

  String? addNote(String text) {
    if (!_writable || text.trim().isEmpty ||
        ext.notes.length >= HaizExtension.maxNotes) {
      return null;
    }
    final stamp = now();
    final note = NoteItem(id: newId(), text: text.trim(), createdAt: stamp, updatedAt: stamp);
    ext = ext.copyWith(notes: List.unmodifiable([note, ...ext.notes]));
    _persist(); _notify();
    return note.id;
  }

  bool updateNote(String id, String text) {
    if (!_writable) return false;
    final index = ext.notes.indexWhere((n) => n.id == id);
    if (index < 0 || ext.notes[index].text == text) return false;
    final list = [...ext.notes]..[index] = ext.notes[index].copyWith(text: text, updatedAt: now());
    ext = ext.copyWith(notes: List.unmodifiable(list));
    _persist(); _notify();
    return true;
  }

  NoteItem? deleteNote(String id) {
    if (!_writable) return null;
    final note = noteById(id);
    if (note == null) return null;
    ext = ext.copyWith(notes: List.unmodifiable(ext.notes.where((n) => n.id != id)));
    _persist(); _notify();
    return note;
  }

  bool restoreNote(NoteItem note) {
    if (!_writable || noteById(note.id) != null) return false;
    ext = ext.copyWith(notes: List.unmodifiable([note, ...ext.notes]));
    _persist(); _notify();
    return true;
  }

  /// Explicit user action only: creates a task and keeps the memo, linked
  /// both ways so the task's source remains traceable.
  String? convertNoteToTask(String noteId, {required String title,
      required String subject, DateTime? due}) {
    final note = noteById(noteId);
    if (note == null || !_writable) return null;
    final id = addTask(title, subject, due: due, source: '来自备忘');
    if (id == null) return null;
    _setMeta(id, metaFor(id).copyWith(noteId: noteId));
    final list = ext.notes.map((n) => n.id == noteId ? n.copyWith(taskId: id) : n);
    ext = ext.copyWith(notes: List.unmodifiable(list));
    _persist(); _notify();
    return id;
  }

  // -------------------------------------------------------------- courses

  void setDay(int day) { selectedWeekday = day.clamp(1, 7); _notify(); }

  static bool _validCourse(String name, int weekday, int start, int end) =>
      name.trim().isNotEmpty && end > start && weekday >= 1 && weekday <= 7 &&
      start >= 0 && end <= 1440;

  String? addCourse({required String name, required int weekday,
      required int startMinute, required int endMinute, String location = ''}) {
    if (!_writable || !_validCourse(name, weekday, startMinute, endMinute)) {
      return null;
    }
    final id = newId();
    courses = List.unmodifiable([...courses,
      CourseSlot(id: id, name: name.trim(), weekday: weekday,
        startMinute: startMinute, endMinute: endMinute, location: location.trim())]);
    _persist(); _notify();
    return id;
  }

  /// Edit a course in place; its id stays stable.
  bool updateCourse(String id, {required String name, required int weekday,
      required int startMinute, required int endMinute, String location = ''}) {
    if (!_writable || !_validCourse(name, weekday, startMinute, endMinute)) {
      return false;
    }
    final index = courses.indexWhere((c) => c.id == id);
    if (index < 0) return false;
    courses = List.unmodifiable([...courses]..[index] = CourseSlot(
      id: id, name: name.trim(), weekday: weekday, startMinute: startMinute,
      endMinute: endMinute, location: location.trim()));
    _persist(); _notify();
    return true;
  }

  void deleteCourse(String id) {
    if (!_writable) return;
    courses = List.unmodifiable(courses.where((x) => x.id != id));
    _persist(); _notify();
  }

  bool restoreCourse(CourseSlot course) {
    if (!_writable || courses.any((c) => c.id == course.id)) return false;
    courses = List.unmodifiable([...courses, course]);
    _persist(); _notify();
    return true;
  }

  // ---------------------------------------------------------------- focus

  FocusSession? get focusSession => ext.focus;
  bool get focusRunning => ext.focus?.phase == FocusPhase.running;
  bool get focusPaused => ext.focus?.phase == FocusPhase.paused;
  int get focusTargetMinutes => ext.focusMinutes;

  int get focusRemaining =>
      ext.focus?.remainingAt(now()) ?? focusTargetMinutes * 60;

  void setFocusDuration(int minutes) {
    if (!_writable || ext.focus != null) return;
    ext = ext.copyWith(focusMinutes: minutes.clamp(1, 180));
    focusClock.value = focusTargetMinutes * 60;
    _persist();
    _notify();
  }

  /// Starts a new session or resumes a paused one.
  void startFocus() {
    if (!_writable || focusRunning) return;
    final stamp = now();
    final current = ext.focus;
    if (current != null) {
      ext = ext.copyWith(focus: FocusSession(
        id: current.id, taskId: current.taskId, label: current.label,
        targetSeconds: current.targetSeconds, startedAt: current.startedAt,
        phase: FocusPhase.running,
        endsAt: stamp.add(Duration(seconds: current.remainingAt(stamp))),
      ));
    } else {
      final task = activeTask;
      ext = ext.copyWith(focus: FocusSession(
        id: newId(), taskId: task?.id, label: task?.title ?? '自主学习',
        targetSeconds: focusTargetMinutes * 60, startedAt: stamp,
        phase: FocusPhase.running,
        endsAt: stamp.add(Duration(minutes: focusTargetMinutes)),
      ));
    }
    focusNotice = null;
    _startTicker();
    _persist();
    _notify();
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    focusClock.value = focusRemaining;
  }

  void _tick() {
    if (!focusRunning) { _ticker?.cancel(); _ticker = null; return; }
    final remaining = focusRemaining;
    focusClock.value = remaining;
    if (remaining == 0) finishFocus(auto: true);
  }

  void pauseFocus() {
    final current = ext.focus;
    if (!_writable || current == null || current.phase != FocusPhase.running) return;
    final remaining = current.remainingAt(now());
    _ticker?.cancel();
    _ticker = null;
    if (remaining == 0) { finishFocus(auto: true); return; }
    ext = ext.copyWith(focus: FocusSession(
      id: current.id, taskId: current.taskId, label: current.label,
      targetSeconds: current.targetSeconds, startedAt: current.startedAt,
      phase: FocusPhase.paused, remainingSeconds: remaining,
    ));
    focusClock.value = remaining;
    _persist(); _notify();
  }

  /// Records the elapsed part of the session (if at least half a minute)
  /// exactly once, then returns to idle. [auto] marks timer completion.
  void finishFocus({bool auto = false}) {
    final current = ext.focus;
    _ticker?.cancel();
    _ticker = null;
    if (!_writable) return;
    if (current == null) {
      focusClock.value = focusTargetMinutes * 60;
      _notify();
      return;
    }
    final stamp = now();
    final elapsed = current.elapsedAt(stamp);
    final minutes = (elapsed / 60).round();
    final already = ext.completedSessions.contains(current.id);
    if (minutes > 0 && !already) {
      final label = taskById(current.taskId)?.title ?? current.label;
      focusLogs = List.unmodifiable([
        FocusLog(at: stamp, minutes: minutes, label: label), ...focusLogs]);
    }
    ext = ext.copyWith(
      clearFocus: true,
      completedSessions: List.unmodifiable(
          [current.id, ...ext.completedSessions.where((id) => id != current.id)].take(20)),
    );
    focusClock.value = focusTargetMinutes * 60;
    _persist(); _notify();
  }

  /// Ends the session without a learning record.
  void discardFocus() {
    if (!_writable || ext.focus == null) return;
    _ticker?.cancel();
    _ticker = null;
    ext = ext.copyWith(clearFocus: true);
    focusClock.value = focusTargetMinutes * 60;
    _persist(); _notify();
  }

  /// Call on load and whenever the app returns to the foreground: a session
  /// that ended while the process was suspended or killed is completed once,
  /// using its wall-clock end time, and the user is told what happened.
  void reconcileFocus() {
    if (!ready) return;
    _reconcileFocus();
    _notify();
  }

  void _reconcileFocus() {
    final current = ext.focus;
    if (current == null || !_writable) {
      focusClock.value = focusRemaining;
      return;
    }
    if (current.phase == FocusPhase.running) {
      if (current.remainingAt(now()) == 0) {
        final end = current.endsAt!;
        focusNotice = '上次专注已在 ${minutesText(end.hour * 60 + end.minute)} 结束，'
            '已记录 ${(current.targetSeconds / 60).round()} 分钟。';
        finishFocus(auto: true);
      } else {
        _startTicker();
      }
    } else {
      focusClock.value = focusRemaining;
    }
  }

  void clearFocusNotice() {
    if (focusNotice == null) return;
    focusNotice = null;
    _notify();
  }

  int get todayFocusMinutes => focusMinutesToday(focusLogs, now());

  // --------------------------------------------------------------- drafts

  String draft(String key) => _drafts[key] ?? '';

  /// Keeps unsubmitted text across tab switches and, for guests, restarts.
  void setDraft(String key, String value) {
    if (namespace == null) return;
    if (value.isEmpty) {
      if (_drafts.remove(key) == null) return;
    } else {
      if (_drafts[key] == value) return;
      _drafts[key] = value;
    }
    final scope = namespace!;
    if (!scope.startsWith('haiz/guest/v1/')) return;
    final ticket = generation;
    _draftSave?.cancel();
    _draftSave = Timer(const Duration(milliseconds: 600), () {
      if (ticket != generation || namespace != scope || _disposed) return;
      unawaited(_prefs.setString('$scope/drafts.v1', jsonEncode(_drafts))
          .catchError((Object _) => false));
    });
  }

  @override
  void dispose() {
    _disposed = true;
    generation++;
    _ticker?.cancel();
    _draftSave?.cancel();
    sync.dispose();
    focusClock.dispose();
    super.dispose();
  }
}

/// Union by id; for the same id this device's record wins. Nothing present
/// on either side is dropped, so a conflict never silently loses a record.
PersonalSnapshot mergeSnapshots({
  required PersonalSnapshot local,
  required PersonalSnapshot remote,
}) {
  List<T> union<T>(List<T> mine, List<T> theirs, String Function(T) id) {
    final seen = mine.map(id).toSet();
    return [...mine, ...theirs.where((x) => seen.add(id(x)))];
  }

  final tasks = union(local.tasks, remote.tasks, (t) => t.id);
  final logs = union(local.focusLogs, remote.focusLogs,
      (l) => jsonEncode(l.toJson()));
  final taskIds = tasks.map((t) => t.id).toSet();
  final notes = {...remote.taskNotes, ...local.taskNotes}
    ..removeWhere((key, _) => !taskIds.contains(key));
  final localNotes = {for (final n in local.ext.notes) n.id: n};
  for (final note in remote.ext.notes) {
    final mine = localNotes[note.id];
    if (mine == null || note.updatedAt.isAfter(mine.updatedAt)) {
      localNotes[note.id] = note;
    }
  }
  final trashIds = local.ext.trash.map((e) => e.task.id).toSet();
  return PersonalSnapshot(
    tasks: tasks,
    courses: union(local.courses, remote.courses, (c) => c.id),
    focusLogs: logs,
    taskNotes: notes,
    activeTaskId: local.activeTaskId,
    appearance: local.appearance,
    legacyImported: local.legacyImported || remote.legacyImported,
    ext: local.ext.copyWith(
      notes: localNotes.values.toList(),
      taskMeta: {...remote.ext.taskMeta, ...local.ext.taskMeta},
      trash: [
        ...local.ext.trash,
        ...remote.ext.trash.where((e) => trashIds.add(e.task.id)),
      ].where((e) => !taskIds.contains(e.task.id)).take(HaizExtension.maxTrash).toList(),
      completedSessions: {
        ...local.ext.completedSessions, ...remote.ext.completedSessions,
      }.take(20).toList(),
    ),
  );
}
