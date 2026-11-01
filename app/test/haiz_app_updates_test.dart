import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/domain/haiz_app_updates.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const installed = HaizInstalledVersion(
  packageId: 'space.haiz.app.preview',
  versionCode: 10,
  versionName: '1.0.0-rc.1',
);

Map<String, Object> signedManifest({int code = 11}) => {
      'packageId': 'space.haiz.app.preview',
      'versionCode': code,
      'versionName': '1.0.1',
      'apkUrl':
          'https://github.com/manyIwant/haiz/releases/download/haiz-android-v1.0.1/HAIZ-Pocket-Android.apk',
      'sha256': 'a' * 64,
      'sizeBytes': 12000000,
      'notes': '修复收件箱显示',
    };

void main() {
  test('valid production manifest and monotonic version', () async {
    final parsed = HaizUpdateRelease.parse(signedManifest());
    expect(parsed.versionCode, 11);
    expect(parsed.sha256.length, 64);
    final client = MockClient((_) async =>
        http.Response(jsonEncode(signedManifest()), 200));
    final available = await HaizAppUpdates.check(
      current: installed, client: client);
    expect(available?.versionCode, 11);
    client.close();
  });

  test('older and absent releases never trigger an update', () async {
    final client = MockClient((_) async =>
        http.Response(jsonEncode(signedManifest(code: 9)), 200));
    expect(await HaizAppUpdates.check(current: installed, client: client),
        isNull);
    client.close();
    final missing = MockClient((_) async => http.Response('not found', 404));
    expect(await HaizAppUpdates.check(current: installed, client: missing),
        isNull);
    missing.close();
  });

  test('rejects bad APK locations, mismatched package and checksum', () async {
    for (final url in [
      'http://github.com/manyIwant/haiz/releases/download/haiz-android-v1.0.1/HAIZ-Pocket-Android.apk',
      'https://evil.example/update.apk',
      'https://github.com/other/repo/releases/download/haiz-android-v1.0.1/HAIZ-Pocket-Android.apk',
      'https://github.com/manyIwant/haiz/releases/download/haiz-android-v1.0.1/HAIZ-Pocket-Android.apk?redirect=1',
    ]) {
      expect(
        () => HaizUpdateRelease.parse({...signedManifest(), 'apkUrl': url}),
        throwsFormatException,
      );
    }
    expect(
      () => HaizUpdateRelease.parse({...signedManifest(), 'sha256': 'bad'}),
      throwsFormatException,
    );
    expect(
      () => HaizUpdateRelease.parse({...signedManifest(), 'sizeBytes': 1}),
      throwsFormatException,
    );
    final client = MockClient((_) async =>
        http.Response(jsonEncode({...signedManifest(), 'packageId': 'other.app'}), 200));
    await expectLater(
      HaizAppUpdates.check(current: installed, client: client),
      throwsFormatException,
    );
    client.close();
  });

  test('update manifest requires HTTPS', () async {
    final client = MockClient((_) async =>
        http.Response(jsonEncode(signedManifest()), 200));
    await expectLater(
      HaizAppUpdates.check(
        current: installed, client: client,
        endpoint: Uri.parse('http://haiz.space/updates/latest.json')),
      throwsFormatException,
    );
    client.close();
  });
}
