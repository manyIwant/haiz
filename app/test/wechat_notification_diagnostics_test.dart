import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/domain/message_intake_bridge.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('wechat diagnostics separates permissions, connection and filtering', () {
    const cfg = MonitorConfiguration(
      enabled: true, granted: true, groups: '测试班群', wechat: true,
    );
    final raw = <Object?, Object?>{
      'listenerConnected': true,
      'observedCount': 3,
      'savedCount': 0,
      'lastObservedAt': 1793500000000,
      'lastResult': 'group_mismatch',
    };
    final diag = WechatNotificationDiagnostics.fromNative(raw);
    expect(diag.status(cfg), contains('群名未匹配'));
    expect(diag.observedCount, 3);
    expect(diag.lastObservedAt, isNotNull);
    expect(diag.status(const MonitorConfiguration(
        enabled: true, granted: false, groups: '测试班群', wechat: true,
    )), contains('通知使用权'));
    expect(diag.status(const MonitorConfiguration(
        enabled: true, granted: true, groups: '测试班群', wechat: false,
    )), contains('未开启'));
    expect(WechatNotificationDiagnostics.fromNative(
        {...raw, 'listenerConnected': false}).status(cfg), contains('服务未连接'));
    expect(WechatNotificationDiagnostics.fromNative(
        {...raw, 'observedCount': 0}).status(cfg), contains('尚未观察'));
    expect(WechatNotificationDiagnostics.fromNative(
        {...raw, 'lastResult': 'action_mismatch'}).status(cfg), contains('作业行动'));
    expect(WechatNotificationDiagnostics.fromNative(
        {...raw, 'lastResult': 'accepted'}).status(cfg), contains('已入箱'));
  });

  test('native bridge can read and reset counters', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    final methods = <String>[];
    messenger.setMockMethodCallHandler(MessageIntakeBridge.channel, (call) async {
      methods.add(call.method);
      return <String, Object?>{
        'listenerConnected': true,
        'observedCount': call.method == 'resetWechatDiagnostics' ? 0 : 3,
        'savedCount': 1,
        'lastObservedAt': 1793500000000,
        'lastResult': 'accepted',
      };
    });
    addTearDown(() {
      messenger.setMockMethodCallHandler(MessageIntakeBridge.channel, null);
      debugDefaultTargetPlatformOverride = null;
    });
    expect((await MessageIntakeBridge.wechatDiagnostics())?.observedCount, 3);
    expect((await MessageIntakeBridge.resetWechatDiagnostics())?.observedCount, 0);
    expect(methods, ['getWechatDiagnostics', 'resetWechatDiagnostics']);
  });
}
