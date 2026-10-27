import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'personal_snapshot.dart';

/// Quarantines unowned v1 data. Originals and verified backup are never removed.
class LegacyArchive {
  LegacyArchive(this.prefs);
  final SharedPreferencesAsync prefs;
  static const archiveKey = 'haiz/legacy/v1/archive';
  static const markerKey = 'haiz/legacy/v1/complete';
  static const ownerKey = 'haiz/legacy/v1/owner';
  static const keys = [
    'pocket.tasks.v1', 'pocket.courses.v1', 'pocket.focus.v1',
    'pocket.taskNotes.v1', 'pocket.activeTask.v1', 'pocket.appearance.v1',
  ];

  Future<bool> quarantine() async {
    final existing = await prefs.getString(archiveKey);
    if (existing != null) {
      _rawMap(existing);
      await prefs.setString(markerKey, '1');
      return true;
    }
    final values = await prefs.getAll(allowList: keys.toSet());
    if (values.isEmpty) return false;
    final raw = jsonEncode(values);
    await prefs.setString(archiveKey, raw);
    if (await prefs.getString(archiveKey) != raw) {
      throw StateError('旧数据备份校验失败，原始记录仍保留');
    }
    await prefs.setString(markerKey, '1');
    return true;
  }

  Future<PersonalSnapshot> read() async {
    final raw = await prefs.getString(archiveKey);
    if (raw == null) throw StateError('没有历史归档');
    final values = _rawMap(raw);
    dynamic decoded(String key, dynamic fallback) {
      final value = values['pocket.$key.v1'];
      if (value == null) return fallback;
      if (value is! String) throw const FormatException('旧数据类型无效，原记录已保留');
      return jsonDecode(value);
    }
    return PersonalSnapshot.fromFields({
      'tasks': decoded('tasks', []),
      'courses': decoded('courses', []),
      'focusLogs': decoded('focus', []),
      'taskNotes': decoded('taskNotes', {}),
      'activeTaskId': values['pocket.activeTask.v1'],
      'appearance': values['pocket.appearance.v1'] ?? 'porcelain',
    });
  }

  static Map<String, dynamic> _rawMap(String raw) {
    final value = jsonDecode(raw);
    if (value is! Map<String, dynamic> ||
        value.keys.any((key) => !keys.contains(key))) {
      throw const FormatException('旧数据归档格式无效，原始记录仍保留');
    }
    return value;
  }

  Future<void> claim(String namespace) async {
    final owner = await prefs.getString(ownerKey);
    if (owner != null && owner != namespace) {
      throw StateError('旧数据已由其他账号认领，不能再次导入');
    }
    // Claim first: an interrupted destination write can only be retried by owner.
    await prefs.setString(ownerKey, namespace);
    if (await prefs.getString(ownerKey) != namespace) {
      throw StateError('旧数据归属校验失败');
    }
  }
}
