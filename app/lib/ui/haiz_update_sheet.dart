import 'package:flutter/material.dart';

import '../domain/haiz_app_updates.dart';

/// User-triggered updater. There is no silent APK installation or data reset.
class HaizUpdateSheet extends StatefulWidget {
  const HaizUpdateSheet({super.key});

  @override
  State<HaizUpdateSheet> createState() => _HaizUpdateSheetState();
}

class _HaizUpdateSheetState extends State<HaizUpdateSheet> {
  HaizInstalledVersion? _installed;
  HaizUpdateRelease? _release;
  String? _verifiedPath;
  String? _message;
  double _progress = 0;
  bool _busy = false;
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    if (!HaizAppUpdates.available) return;
    setState(() {
      _checking = true;
      _message = null;
    });
    try {
      final installed = await HaizAppUpdates.installed();
      final available = await HaizAppUpdates.check(current: installed);
      if (!mounted) return;
      setState(() {
        _installed = installed;
        _release = available;
        _message = available == null ? '当前已是最新版本，或尚未发布签名正式版。' : null;
      });
    } catch (error) {
      if (mounted) setState(() => _message = '检查失败：$error');
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _install() async {
    final release = _release;
    if (_busy || release == null) return;
    setState(() {
      _busy = true;
      _message = null;
      _progress = 0;
    });
    try {
      final file = _verifiedPath ?? await HaizAppUpdates.downloadVerified(
        release,
        onProgress: (progress) {
          if (mounted) setState(() => _progress = progress);
        },
      );
      if (!mounted) return;
      _verifiedPath = file;
      final status = await HaizAppUpdates.openInstaller(file, release);
      if (!mounted) return;
      setState(() {
        _message = status == 'permission_required'
            ? '请在系统设置中允许 HAIZ 安装更新，返回此页面再次点击「继续安装」。'
            : status == 'installer_opened'
                ? '已打开 Android 安装器。请确认更新，完成后仍是同一个 HAIZ 应用。'
                : '尚未完成安装，请重试。';
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _verifiedPath = null;
          _message = '更新失败：$error';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final release = _release;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 15, 24, 30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Row(
              children: [
                Icon(Icons.system_update_alt_rounded, size: 25),
                SizedBox(width: 12),
                Expanded(
                  child: Text('HAIZ · 软件更新',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(
              _installed == null
                  ? '检查 Android 安装版本…'
                  : '当前版本 ${_installed!.versionName}（${_installed!.versionCode}）',
            ),
            if (release != null) ...[
              const SizedBox(height: 9),
              Text('可更新至 ${release.versionName}（${release.versionCode}）',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              Text(release.notes.isEmpty ? '安全修复与体验改进' : release.notes),
              const SizedBox(height: 8),
              Text('完整安装包 · ${(release.sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB · SHA-256 校验'),
            ],
            if (_busy && _verifiedPath == null) ...[
              const SizedBox(height: 17),
              LinearProgressIndicator(value: _progress),
              const SizedBox(height: 5),
              Text('下载中 ${(_progress * 100).toStringAsFixed(0)}%'),
            ],
            if (_message != null) ...[
              const SizedBox(height: 14),
              Text(_message!, style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 18),
            if (!HaizAppUpdates.available)
              const Text('当前平台不支持 APK 覆盖安装。请使用 Android 版本。')
            else if (_checking)
              const Center(child: CircularProgressIndicator())
            else if (release != null)
              FilledButton.icon(
                key: const Key('haiz-install-update'),
                onPressed: _busy ? null : _install,
                icon: const Icon(Icons.download_for_offline_outlined),
                label: Text(_busy
                    ? '正在准备更新…'
                    : _verifiedPath == null ? '下载并安装' : '继续安装'),
              )
            else
              OutlinedButton.icon(
                key: const Key('haiz-check-update'),
                onPressed: _checking ? null : _check,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('重新检查更新'),
              ),
            const SizedBox(height: 11),
            const Text(
              '通过系统安装器覆盖旧版本。Android 可能要求首次授权安装来源；'
              '签名证书不一致时不会强行覆盖，也不会替你卸载或清空数据。',
              style: TextStyle(fontSize: 11, height: 1.6),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> showHaizUpdateSheet(BuildContext context) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const HaizUpdateSheet(),
    );
