import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../core/personal_backup.dart';
import '../core/pocket_store.dart';

/// Explicit local file transfer; no backup bytes are uploaded to HAIZ.
class PocketBackupSheet extends StatefulWidget {
  const PocketBackupSheet({super.key, required this.store});
  final PocketStore store;

  @override
  State<PocketBackupSheet> createState() => _PocketBackupSheetState();
}

class _PocketBackupSheetState extends State<PocketBackupSheet> {
  bool _busy = false;
  String? _prepared;
  PersonalBackup? _preview;
  String? _status;
  int? _preparedGeneration;
  int? _previewGeneration;
  late int _scopeGeneration;

  @override
  void initState() {
    super.initState();
    _scopeGeneration = widget.store.generation;
    widget.store.addListener(_onStoreChanged);
  }

  void _onStoreChanged() {
    if (widget.store.generation == _scopeGeneration) return;
    _scopeGeneration = widget.store.generation;
    // Clear data immediately, even if Navigator keeps the sheet mounted
    // across logout or a guest/account switch.
    _prepared = null;
    _preview = null;
    _status = null;
    _preparedGeneration = null;
    _previewGeneration = null;
    // Identity switches happen outside this sheet's build; refresh now
    // so the old download button disappears in the same frame.
    if (mounted) setState(() {});
  }

  @override
  void didUpdateWidget(covariant PocketBackupSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.store != widget.store) {
      oldWidget.store.removeListener(_onStoreChanged);
      widget.store.addListener(_onStoreChanged);
      _scopeGeneration = widget.store.generation;
      _prepared = null;
      _preview = null;
      _status = null;
      _preparedGeneration = null;
      _previewGeneration = null;
    }
  }

  @override
  void dispose() {
    widget.store.removeListener(_onStoreChanged);
    super.dispose();
  }

  String _message(Object error) => switch (error) {
    FormatException e => e.message,
    StateError e => e.message.toString(),
    _ => '文件操作未完成，请检查系统权限后重试。',
  };

  Future<void> _prepareExport() async {
    if (_busy) return;
    final generation = widget.store.generation;
    setState(() { _busy = true; _status = null; _prepared = null; _preparedGeneration = null; });
    try {
      final value = await widget.store.exportGuestBackup();
      if (!mounted || generation != widget.store.generation ||
          !widget.store.guestBackupAvailable) {
        return;
      }
      setState(() {
        _prepared = value;
        _preparedGeneration = generation;
        _status = '备份已在本机准备好。点击「保存 JSON」完成下载。';
      });
    } catch (error) {
      if (mounted) setState(() => _status = _message(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveExport() async {
    final data = _prepared;
    if (data == null || _busy ||
        _preparedGeneration != widget.store.generation ||
        !widget.store.guestBackupAvailable) {
      return;
    }
    setState(() { _busy = true; _status = null; });
    try {
      final today = DateTime.now();
      final date = '${today.year}${today.month.toString().padLeft(2, '0')}'
          '${today.day.toString().padLeft(2, '0')}';
      final saved = await FilePicker.saveFile(
        fileName: 'HAIZ-Pocket-$date.json',
        bytes: Uint8List.fromList(utf8.encode(data)),
      );
      if (mounted) {
        setState(() => _status = saved == null
            ? '已取消保存，备份仍可重新下载。'
            : '已交给系统保存。请确认 JSON 文件确实存在于下载目录或「文件」中。');
      }
    } catch (error) {
      if (mounted) setState(() => _status = _message(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickImport() async {
    if (_busy) return;
    final generation = widget.store.generation;
    setState(() { _busy = true; _status = null; _preview = null; _previewGeneration = null; });
    try {
      final file = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: ['json'],
      );
      if (file == null) return;
      final length = file.lengthSync() ?? await file.length();
      if (length != null && length > PersonalBackup.maxBytes) {
        throw const FormatException('备份超过 4 MB，未读取文件');
      }
      final bytes = await file.readAsBytes();
      if (bytes.length > PersonalBackup.maxBytes) {
        throw const FormatException('备份超过 4 MB，未修改任何数据');
      }
      final backup = PersonalBackup.decode(utf8.decode(bytes));
      if (!mounted || generation != widget.store.generation ||
          !widget.store.guestBackupAvailable) {
        return;
      }
      setState(() {
        _preview = backup;
        _previewGeneration = generation;
        _status = '文件已校验。确认后只会补充缺失记录，不会删除已有内容。';
      });
    } catch (error) {
      if (mounted) setState(() => _status = _message(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _restore() async {
    final backup = _preview;
    final generation = widget.store.generation;
    if (backup == null || _busy || _previewGeneration != generation ||
        !widget.store.guestBackupAvailable) {
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('合并这份 HAIZ 备份？'),
        content: Text(
          '将尝试补充 ${backup.taskCount} 条任务、'
          '${backup.courseCount} 条课程和 ${backup.focusCount} 条专注记录。'
          '相同记录跳过，标识相同但内容不一致则取消整个导入。'
          '不会删除已有数据，也不会上传文件。',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('返回'),
          ),
          FilledButton(
            key: const Key('backup-merge-confirm'),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('确认合并'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted ||
        generation != widget.store.generation ||
        !widget.store.guestBackupAvailable) {
      return;
    }
    setState(() { _busy = true; _status = null; });
    try {
      final result = await widget.store.mergeGuestBackup(
        backup, confirmed: true,
      );
      if (!mounted) return;
      setState(() {
        _preview = null;
        _prepared = null;
        _preparedGeneration = null;
        _previewGeneration = null;
        _status = '已保存：新增 ${result.tasksAdded} 条任务、'
            '${result.coursesAdded} 条课程、${result.focusAdded} 条专注记录。';
      });
    } catch (error) {
      if (mounted) setState(() => _status = _message(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.store.guestBackupAvailable;
    final visiblePreview = enabled &&
            _previewGeneration == widget.store.generation
        ? _preview
        : null;
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 28,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('数据备份与恢复', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 10),
            const Text(
              '备份包含任务、备注、课表和专注记录，是未加密的 JSON 文件。'
              '请勿将文件公开分享。',
            ),
            const SizedBox(height: 12),
            if (!enabled)
              const Text(
                '此功能目前仅支持本机访客空间。云端及班级账号'
                '不能通过文件覆盖；请先退出账号。',
                key: Key('guest-backup-only'),
              ),
            const SizedBox(height: 14),
            FilledButton.icon(
              key: const Key('backup-prepare-export'),
              onPressed: enabled && !_busy ? _prepareExport : null,
              icon: const Icon(Icons.archive_outlined),
              label: const Text('准备备份文件'),
            ),
            if (_prepared != null && enabled &&
                _preparedGeneration == widget.store.generation)
              OutlinedButton.icon(
                key: const Key('backup-save-json'),
                onPressed: !_busy ? _saveExport : null,
                icon: const Icon(Icons.download_outlined),
                label: const Text('保存 JSON 文件'),
              ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              key: const Key('backup-pick-json'),
              onPressed: enabled && !_busy ? _pickImport : null,
              icon: const Icon(Icons.file_open_outlined),
              label: const Text('选择备份文件并校验'),
            ),
            if (visiblePreview case final backup?) ...[
              const SizedBox(height: 12),
              Text(
                '备份时间：${backup.createdAt.toLocal()}\n'
                '任务 ${backup.taskCount} · 课表 ${backup.courseCount} · '
                '专注 ${backup.focusCount}',
              ),
              const SizedBox(height: 10),
              FilledButton(
                key: const Key('backup-merge'),
                onPressed: enabled && !_busy ? _restore : null,
                child: const Text('预览完成，确认合并'),
              ),
            ],
            if (_busy) const LinearProgressIndicator(),
            if (_status != null) ...[
              const SizedBox(height: 12),
              Text(_status!, key: const Key('backup-status')),
            ],
            const SizedBox(height: 14),
            const Text(
              '浏览器清理网站数据可能移除本地记录，请妥善保管备份。'
              '文件不会自动同步到其他设备。',
              style: TextStyle(fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> showPocketBackupSheet(BuildContext context, PocketStore store) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => PocketBackupSheet(store: store),
    );
