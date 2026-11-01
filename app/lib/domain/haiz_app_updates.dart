import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

/// Native app updates only; Flutter web/iOS never request unknown-source installs.
class HaizAppUpdates {
  HaizAppUpdates._();

  static const channel = MethodChannel('space.haiz.pocket/app_updates');
  static const manifestUrl = 'https://haiz.space/updates/latest.json';
  static const maxApkBytes = 250 * 1024 * 1024;

  static bool get available =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  static Future<HaizInstalledVersion> installed() async {
    if (!available) throw const FormatException('仅 Android 支持应用内 APK 更新');
    final raw = await channel.invokeMapMethod<String, dynamic>('getInstalledVersion');
    if (raw == null) throw const FormatException('无法获取当前安装版本');
    return HaizInstalledVersion(
      packageId: raw['packageId'] as String,
      versionCode: (raw['versionCode'] as num).toInt(),
      versionName: (raw['versionName'] as String?) ?? '',
    );
  }

  /// 404 means no signed production release has been published yet.
  static Future<HaizUpdateRelease?> check({
    required HaizInstalledVersion current,
    http.Client? client,
    Uri? endpoint,
  }) async {
    final uri = endpoint ?? Uri.parse(manifestUrl);
    if (uri.scheme != 'https') {
      throw const FormatException('更新清单必须使用 HTTPS');
    }
    final ownClient = client == null;
    final httpClient = client ?? http.Client();
    try {
      final response = await httpClient
          .get(uri, headers: {'Accept': 'application/json'})
          .timeout(const Duration(seconds: 12));
      if (response.statusCode == 404) return null;
      if (response.statusCode != 200 || response.bodyBytes.length > 65536) {
        throw const FormatException('无法读取可信更新清单');
      }
      final parsed = jsonDecode(utf8.decode(response.bodyBytes));
      final release = HaizUpdateRelease.parse(parsed);
      if (release.packageId != current.packageId) {
        throw const FormatException('更新包名与已安装应用不一致');
      }
      return release.versionCode > current.versionCode ? release : null;
    } finally {
      if (ownClient) httpClient.close();
    }
  }

  /// Stream into private cache; never invoke Android installer before a full
  /// byte-count and SHA-256 match against the release manifest.
  static Future<String> downloadVerified(
    HaizUpdateRelease release, {
    required ValueChanged<double> onProgress,
    http.Client? client,
  }) async {
    if (!available) throw const FormatException('此设备不支持 APK 更新');
    final ownClient = client == null;
    final httpClient = client ?? http.Client();
    final root = await getTemporaryDirectory();
    final directory = Directory('${root.path}/haiz_updates');
    await directory.create(recursive: true);
    final output = File('${directory.path}/haiz-update.apk');
    if (await output.exists()) await output.delete();
    final sink = output.openWrite();
    var closed = false;
    var success = false;
    try {
      final request = http.Request('GET', release.apkUrl);
      final response = await httpClient.send(request)
          .timeout(const Duration(seconds: 25));
      if (response.statusCode != 200) {
        throw const FormatException('安装包下载失败');
      }
      var received = 0;
      await for (final bytes in response.stream.timeout(const Duration(seconds: 40))) {
        received += bytes.length;
        if (received > maxApkBytes || received > release.sizeBytes) {
          throw const FormatException('安装包超出预期大小');
        }
        sink.add(bytes);
        onProgress(received / release.sizeBytes);
      }
      await sink.flush();
      await sink.close();
      closed = true;
      if (received != release.sizeBytes) {
        throw const FormatException('下载不完整，文件大小不匹配');
      }
      final digest = await sha256.bind(output.openRead()).first;
      if (digest.toString().toLowerCase() != release.sha256) {
        throw const FormatException('安装包 SHA-256 校验失败');
      }
      success = true;
      return output.path;
    } finally {
      if (!closed) await sink.close();
      if (!success && await output.exists()) await output.delete();
      if (ownClient) httpClient.close();
    }
  }

  /// Opens the OS installer; never claims installation succeeded at this point.
  static Future<String> openInstaller(String verifiedPath, HaizUpdateRelease release) async {
    return await channel.invokeMethod<String>('installApk', {
          'path': verifiedPath,
          'versionCode': release.versionCode,
        }) ??
        'unknown';
  }
}

class HaizInstalledVersion {
  const HaizInstalledVersion({
    required this.packageId,
    required this.versionCode,
    required this.versionName,
  });
  final String packageId;
  final int versionCode;
  final String versionName;
}

class HaizUpdateRelease {
  const HaizUpdateRelease({
    required this.packageId,
    required this.versionCode,
    required this.versionName,
    required this.apkUrl,
    required this.sha256,
    required this.sizeBytes,
    required this.notes,
  });

  final String packageId;
  final int versionCode;
  final String versionName;
  final Uri apkUrl;
  final String sha256;
  final int sizeBytes;
  final String notes;

  factory HaizUpdateRelease.parse(Object? payload) {
    if (payload is! Map<String, dynamic>) {
      throw const FormatException('更新清单格式错误');
    }
    final packageId = payload['packageId'];
    final code = payload['versionCode'];
    final name = payload['versionName'];
    final rawUrl = payload['apkUrl'];
    final sha = payload['sha256'];
    final size = payload['sizeBytes'];
    final notes = payload['notes'];
    if (packageId is! String ||
        code is! int || code < 1 ||
        name is! String || name.isEmpty ||
        rawUrl is! String ||
        sha is! String ||
        size is! int || size < 1024 * 1024 || size > HaizAppUpdates.maxApkBytes ||
        !RegExp(r'^[0-9a-fA-F]{64}$').hasMatch(sha)) {
      throw const FormatException('更新清单缺少可信字段');
    }
    final url = Uri.tryParse(rawUrl);
    // A release manifest cannot redirect the app to arbitrary APK providers.
    if (url == null || url.scheme != 'https' || url.host != 'github.com' ||
        !RegExp(r'^/manyIwant/haiz/releases/download/haiz-android-v[^/]+/HAIZ-Pocket-Android\\.apk$')
            .hasMatch(url.path) ||
        url.hasQuery || url.hasFragment) {
      throw const FormatException('不可信的安装包下载地址');
    }
    return HaizUpdateRelease(
      packageId: packageId,
      versionCode: code,
      versionName: name,
      apkUrl: url,
      sha256: sha.toLowerCase(),
      sizeBytes: size,
      notes: notes is String ? notes.substring(0, notes.length.clamp(0, 2000)) : '',
    );
  }
}
