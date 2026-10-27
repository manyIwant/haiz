import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/pocket_models.dart';

/// All demo data lives on the device. This class does not contact any campus API.
class PocketStore extends ChangeNotifier {
  final SharedPreferencesAsync _prefs = SharedPreferencesAsync();
  bool ready = false;
  List<TaskItem> tasks = [];
  List<CourseSlot> courses = [];
  List<FocusLog> focusLogs = [];
  Map<String, String> taskNotes = {};
  String appearance = 'porcelain';
  String? activeTaskId;
  String? lastSavedTaskId;
  int selectedWeekday = DateTime.now().weekday;
  int focusTargetMinutes = 25;
  int focusRemaining = 25 * 60;
  bool focusRunning = false;
  DateTime? _focusEndsAt;
  Timer? _ticker;

  Future<void> load() async {
    try {
      final tasksJson = await _prefs.getString('pocket.tasks.v1');
      final coursesJson = await _prefs.getString('pocket.courses.v1');
      final focusJson = await _prefs.getString('pocket.focus.v1');
      final notesJson = await _prefs.getString('pocket.taskNotes.v1');
      taskNotes = notesJson == null
          ? {}
          : Map<String, String>.from(jsonDecode(notesJson) as Map);
      appearance =
          (await _prefs.getString('pocket.appearance.v1')) ?? appearance;
      activeTaskId = await _prefs.getString('pocket.activeTask.v1');
      lastSavedTaskId = activeTaskId;
      tasks = tasksJson == null
          ? starterTasks()
          : (jsonDecode(tasksJson) as List)
                .map(
                  (e) => TaskItem.fromJson(Map<String, dynamic>.from(e as Map)),
                )
                .toList();
      courses = coursesJson == null
          ? starterCourses()
          : (jsonDecode(coursesJson) as List)
                .map(
                  (e) =>
                      CourseSlot.fromJson(Map<String, dynamic>.from(e as Map)),
                )
                .toList();
      focusLogs = focusJson == null
          ? []
          : (jsonDecode(focusJson) as List)
                .map(
                  (e) => FocusLog.fromJson(Map<String, dynamic>.from(e as Map)),
                )
                .toList();
    } catch (e) {
      debugPrint('Local cache could not be read: $e');
      tasks = starterTasks();
      courses = starterCourses();
      focusLogs = [];
    } finally {
      ready = true;
      notifyListeners();
    }
  }

  int get remainingCount => tasks.where((x) => !x.completed).length;
  int get doneCount => tasks.where((x) => x.completed).length;

  Future<void> _saveTasks() async {
    await _prefs.setString(
      'pocket.tasks.v1',
      jsonEncode(tasks.map((x) => x.toJson()).toList()),
    );
  }

  Future<void> _saveCourses() async {
    await _prefs.setString(
      'pocket.courses.v1',
      jsonEncode(courses.map((x) => x.toJson()).toList()),
    );
  }

  Future<void> _saveFocus() async {
    await _prefs.setString(
      'pocket.focus.v1',
      jsonEncode(focusLogs.map((x) => x.toJson()).toList()),
    );
  }

  void setAppearance(String value) {
    appearance = value;
    notifyListeners();
    unawaited(_prefs.setString('pocket.appearance.v1', value));
  }

  void addTask(
    String title,
    String subject, {
    DateTime? due,
    String source = '',
    String originalNotice = '',
  }) {
    if (title.trim().isEmpty) return;
    tasks = [
      TaskItem(
        id: newId(),
        title: title.trim(),
        subject: subject,
        dueIso: due == null
            ? null
            : '${due.year.toString().padLeft(4, '0')}-${due.month.toString().padLeft(2, '0')}-${due.day.toString().padLeft(2, '0')}',
        source: source,
        originalNotice: originalNotice,
      ),
      ...tasks,
    ];
    notifyListeners();
    unawaited(_saveTasks());
  }

  void toggleTask(String id) {
    tasks = tasks
        .map((x) => x.id == id ? x.copyWith(completed: !x.completed) : x)
        .toList();
    notifyListeners();
    unawaited(_saveTasks());
  }

  void deleteTask(String id) {
    tasks.removeWhere((x) => x.id == id);
    taskNotes.remove(id);
    unawaited(_prefs.setString('pocket.taskNotes.v1', jsonEncode(taskNotes)));
    if (activeTaskId == id) chooseFocusTask(null);
    notifyListeners();
    unawaited(_saveTasks());
  }

  String noteFor(String id) => taskNotes[id] ?? '';

  void setTaskNote(String id, String note) {
    taskNotes[id] = note;
    notifyListeners();
    unawaited(_prefs.setString('pocket.taskNotes.v1', jsonEncode(taskNotes)));
  }

  List<TaskItem> get upcomingTasks {
    final pending = tasks
        .where((t) => !t.completed && t.dueIso != null)
        .toList();
    pending.sort((a, b) => a.dueIso!.compareTo(b.dueIso!));
    return pending;
  }

  TaskItem? get activeTask {
    final id = activeTaskId;
    if (id == null) return null;
    for (final t in tasks) {
      if (t.id == id) return t;
    }
    return null;
  }

  void chooseFocusTask(String? id) {
    activeTaskId = id;
    lastSavedTaskId = id;
    notifyListeners();
    if (id == null) {
      unawaited(_prefs.remove('pocket.activeTask.v1'));
    } else {
      unawaited(_prefs.setString('pocket.activeTask.v1', id));
    }
  }

  void setDay(int day) {
    selectedWeekday = day.clamp(1, 7);
    notifyListeners();
  }

  void addCourse({
    required String name,
    required int weekday,
    required int startMinute,
    required int endMinute,
    String location = '',
  }) {
    if (name.trim().isEmpty || endMinute <= startMinute) return;
    courses.add(
      CourseSlot(
        id: newId(),
        name: name.trim(),
        weekday: weekday,
        startMinute: startMinute,
        endMinute: endMinute,
        location: location.trim(),
      ),
    );
    notifyListeners();
    unawaited(_saveCourses());
  }

  void deleteCourse(String id) {
    courses.removeWhere((x) => x.id == id);
    notifyListeners();
    unawaited(_saveCourses());
  }

  void setFocusDuration(int minutes) {
    if (focusRunning) return;
    focusTargetMinutes = minutes.clamp(1, 90);
    focusRemaining = focusTargetMinutes * 60;
    notifyListeners();
  }

  void startFocus() {
    if (focusRunning) return;
    focusRunning = true;
    _focusEndsAt = DateTime.now().add(Duration(seconds: focusRemaining));
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    notifyListeners();
  }

  void _tick() {
    final endAt = _focusEndsAt;
    if (!focusRunning || endAt == null) return;
    focusRemaining = endAt
        .difference(DateTime.now())
        .inSeconds
        .clamp(0, focusTargetMinutes * 60);
    if (focusRemaining == 0) {
      finishFocus(auto: true);
    } else {
      notifyListeners();
    }
  }

  void pauseFocus() {
    if (!focusRunning) return;
    _tick();
    focusRunning = false;
    _focusEndsAt = null;
    _ticker?.cancel();
    notifyListeners();
  }

  void finishFocus({bool auto = false}) {
    if (focusRunning && !auto) {
      final endAt = _focusEndsAt;
      if (endAt != null) {
        focusRemaining = endAt
            .difference(DateTime.now())
            .inSeconds
            .clamp(0, focusTargetMinutes * 60);
      }
    }
    _ticker?.cancel();
    _focusEndsAt = null;
    focusRunning = false;
    final elapsed = focusTargetMinutes * 60 - focusRemaining;
    final minutes = (elapsed / 60).round();
    if (minutes > 0) {
      focusLogs.insert(
        0,
        FocusLog(
          at: DateTime.now(),
          minutes: minutes,
          label: activeTask?.title ?? '自主学习',
        ),
      );
      unawaited(_saveFocus());
    }
    focusRemaining = focusTargetMinutes * 60;
    notifyListeners();
  }

  int get todayFocusMinutes => focusMinutesToday(focusLogs, DateTime.now());

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }
}
