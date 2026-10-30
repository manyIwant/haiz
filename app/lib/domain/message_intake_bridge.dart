import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// An item shared deliberately or captured from a user-authorized
/// school-group notification. Never automatically creates a school task.
class IncomingNotice {
  final String id;
  final String source;
  final String title;
  final String text;
  final DateTime receivedAt;
  const IncomingNotice({
    required this.id,
    required this.source,
    required this.title,
    required this.text,
    required this.receivedAt,
  });

  static IncomingNotice fromNative(Map<Object?, Object?> map) {
    final timestamp = map['receivedAt'];
    return IncomingNotice(
      id: map['id']?.toString() ?? '',
      source: map['source']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      text: map['text']?.toString() ?? '',
      receivedAt: DateTime.fromMillisecondsSinceEpoch(
        timestamp is int ? timestamp : DateTime.now().millisecondsSinceEpoch,
      ),
    );
  }
}

class MonitorConfiguration {
  final bool enabled;
  final bool granted;
  final String groups;
  final bool wechat;
  const MonitorConfiguration({
    required this.enabled,
    required this.granted,
    required this.groups,
    required this.wechat,
  });

  factory MonitorConfiguration.fromNative(Map<Object?, Object?> value) =>
      MonitorConfiguration(
        enabled: value['enabled'] == true,
        granted: value['granted'] == true,
        groups: value['groups']?.toString() ?? '',
        wechat: value['wechat'] == true,
      );
}

/// Android: explicit shares and opt-in filtered notification monitoring.
/// iOS: explicit Share Extension inputs only; iOS cannot monitor WeChat notifications.
/// Web: no native message capture.
class MessageIntakeBridge {
  static final revision = ValueNotifier<int>(0);
  static void markChanged() => revision.value++;

  static const channel = MethodChannel('space.haiz.pocket/message_intake');
  static bool get available =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);
  static bool get supportsNotificationMonitoring =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  static Future<List<IncomingNotice>> entries() async {
    if (!available) return [];
    final raw = await channel.invokeMethod<List<dynamic>>('getEntries') ?? [];
    return raw
        .whereType<Map>()
        .map((m) => IncomingNotice.fromNative(m.map((k, v) => MapEntry(k, v))))
        .where((entry) => entry.id.isNotEmpty)
        .toList();
  }

  static Future<MonitorConfiguration?> configuration() async {
    if (!available) return null;
    final value = await channel.invokeMethod<Map<dynamic, dynamic>>(
      'getConfiguration',
    );
    return value == null
        ? null
        : MonitorConfiguration.fromNative(value.map((k, v) => MapEntry(k, v)));
  }

  static Future<MonitorConfiguration?> configure({
    required bool enabled,
    required String groups,
    bool includeWeChat = false,
  }) async {
    if (!supportsNotificationMonitoring) return null;
    final value = await channel.invokeMethod<Map<dynamic, dynamic>>(
      'setConfiguration',
      {'enabled': enabled, 'groups': groups, 'wechat': includeWeChat},
    );
    return value == null
        ? null
        : MonitorConfiguration.fromNative(value.map((k, v) => MapEntry(k, v)));
  }

  static Future<void> notificationSettings() async {
    if (!supportsNotificationMonitoring) return;
    await channel.invokeMethod<bool>('requestNotificationSettings');
  }

  static Future<void> remove(String id) async {
    if (!available) return;
    await channel.invokeMethod<bool>('removeEntry', {'id': id});
  }

  static Future<void> clear() async {
    if (!available) return;
    await channel.invokeMethod<bool>('clearEntries');
  }
}
