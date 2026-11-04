import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/pocket_models.dart';

/// Shown in the content flow when saving needs the user: a failed save that
/// can be retried, a cloud conflict that needs a decision, or a record that
/// could not be read (kept untouched, read-only).
class SyncBanner extends StatefulWidget {
  const SyncBanner({super.key, this.store});

  /// Defaults to the workspace store from [HaizScope].
  final PocketStore? store;
  @override
  State<SyncBanner> createState() => _SyncBannerState();
}

class _SyncBannerState extends State<SyncBanner> {
  bool _busy = false;

  Future<void> _run(Future<bool> Function() action, String ok) async {
    setState(() => _busy = true);
    final done = await action();
    if (!mounted) return;
    setState(() => _busy = false);
    showToast(context, done ? ok : '仍未成功，记录保持不变。请检查网络后重试。');
  }

  Future<void> _resolve(PocketStore store) async {
    final choice = await showDialog<String>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('云端有更新的版本'),
        content: const Text(
          '另一台设备在你编辑期间保存了这个账号的记录。为了不覆盖它，本机暂停了保存。\n\n'
          '合并：保留两边所有的任务、课程、备忘和专注记录（同一条记录以本机为准），再保存为新版本。被另一台设备删除的记录会重新出现。\n\n'
          '使用云端版本：放弃本机尚未保存的修改。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog), child: const Text('稍后')),
          TextButton(onPressed: () => Navigator.pop(dialog, 'reload'), child: const Text('使用云端版本')),
          FilledButton(onPressed: () => Navigator.pop(dialog, 'merge'), child: const Text('合并')),
        ],
      ),
    );
    if (!mounted || choice == null) return;
    if (choice == 'merge') {
      await _run(store.mergeWithCloud, '已合并并保存到云端');
    } else {
      await _run(store.reloadFromCloud, '已载入云端版本');
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.store ?? HaizScope.maybeOf(context)?.store;
    if (store == null) return const SizedBox.shrink();
    return ListenableBuilder(
      listenable: Listenable.merge([store, store.sync]),
      builder: (context, _) {
        final error = store.storageError;
        if (error == null || !store.ready) return const SizedBox.shrink();
        if (store.hasCloudConflict) {
          return HaizBanner(
            tone: BannerTone.warning,
            icon: Icons.sync_problem_rounded,
            message: error,
            actions: [LinkAction(_busy ? '处理中…' : '选择如何继续', onTap: _busy ? null : () => _resolve(store))],
          );
        }
        if (store.canRetrySave) {
          return HaizBanner(
            tone: BannerTone.danger,
            icon: Icons.error_outline_rounded,
            message: '${store.isCloudAccount ? '没能保存到云端' : '没能保存到本机'}。修改仍在屏幕上，暂停编辑以免丢失；重试成功后可继续。',
            actions: [LinkAction(_busy ? '重试中…' : '重试保存', key: const Key('retry-save'),
                onTap: _busy ? null : () => _run(store.retrySave, '已保存'))],
          );
        }
        return HaizBanner(tone: BannerTone.danger, icon: Icons.lock_outline_rounded, message: error);
      },
    );
  }
}

/// Small inline state line: "已保存到本机 10:12" / "已同步 10:12" / "保存中…".
class SyncLine extends StatelessWidget {
  const SyncLine({super.key, required this.store});
  final PocketStore store;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return ValueListenableBuilder<SyncStatus>(
      valueListenable: store.sync,
      builder: (context, s, _) {
        final at = s.at == null ? '' : ' ${minutesText(s.at!.hour * 60 + s.at!.minute)}';
        final (text, color) = switch (s.phase) {
          SyncPhase.idle => ('', c.ink3),
          SyncPhase.saving => (s.cloud ? '正在保存到云端…' : '正在保存…', c.ink3),
          SyncPhase.saved => (s.cloud ? '已同步到云端$at' : '已保存在这台设备$at', c.ink3),
          SyncPhase.failed => (s.cloud ? '云端保存失败' : '本机保存失败', c.signal),
          SyncPhase.conflict => ('云端有更新的版本', c.amber),
        };
        return Text(text, style: TypeScale.caption(color));
      },
    );
  }
}
