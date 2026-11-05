import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/haiz_app_updates.dart';
import '../../domain/calendar_export.dart';
import '../../domain/planning.dart';
import '../../ui/haiz_update_sheet.dart';
import '../../glass/glass_lab.dart';
import '../../glass/glass_prefs.dart';
import '../../ui/pocket_backup_sheet.dart';
import '../sync/sync_banner.dart';
import 'campus_screen.dart';

/// Shown in 关于; the Android versionName/versionCode stay those of the
/// signed 1.5.5 line until a 2.0 release is authorised.
const haizBuildLabel = '2.1 预览版 · 数据格式兼容 1.5.5';

/// 我的: account and sync, the learning record, campus, settings.
class MeScreen extends StatelessWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = HaizScope.of(context);
    final store = scope.store;
    return ListenableBuilder(
      listenable: Listenable.merge([store, scope.auth]),
      builder: (context, _) => HaizPage(
        storageKey: 'me',
        title: '我的',
        slivers: [
          const SliverToBoxAdapter(child: SyncBanner()),
          const SliverToBoxAdapter(child: _AccountBlock()),
          SliverToBoxAdapter(child: _Record(store: store)),
          SliverToBoxAdapter(child: _Group(title: '校园', rows: [
            _Row(icon: Icons.apartment_outlined, title: '校园', detail: '三维校园、校园故事和学校服务的接入情况',
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => CampusScreen(actions: scope.actions)))),
            _Row(icon: Icons.groups_2_outlined, title: '班级同步',
                detail: scope.session.identity == null ? '连接你有权使用的班级服务' : '已连接 · ${scope.session.selectedClass ?? '未选择班级'}',
                onTap: scope.actions.openAcademic),
          ])),
          SliverToBoxAdapter(child: _Group(title: '设置', rows: [
            _Row(
              icon: Icons.contrast_rounded,
              title: '外观',
              trailing: SizedBox(
                width: 170,
                child: Segmented<String>(
                  key: const Key('theme-mode'),
                  value: store.themeMode,
                  items: const [('system', '自动'), ('light', '浅色'), ('dark', '深色')],
                  onChanged: store.setThemeMode,
                ),
              ),
            ),
            _Row(
              icon: Icons.inventory_2_outlined,
              title: '数据与备份',
              detail: store.isCloudAccount ? '账号记录保存在云端' : '导出或合并本机备份文件',
              onTap: () => store.isCloudAccount
                  ? _cloudDataInfo(context)
                  : showPocketBackupSheet(context, store),
            ),
            _Row(
              icon: Icons.event_available_outlined,
              title: '导出截止日期到日历',
              detail: store.upcomingTasks.isEmpty
                  ? '没有设了截止日期的未完成任务'
                  : '${store.upcomingTasks.length} 项任务 · .ics 文件，可导入系统日历',
              onTap: store.upcomingTasks.isEmpty ? null : () => _exportCalendar(context, store),
            ),
            _Row(icon: Icons.privacy_tip_outlined, title: '收件与隐私',
                detail: '通知接入、AI 识别和数据去向', onTap: () => scope.actions.goTab(HaizTab.inbox)),
            if (HaizAppUpdates.available)
              _Row(icon: Icons.system_update_alt_rounded, title: '应用更新',
                  detail: scope.actions.hasAppUpdate ? '有新版本' : '检查签名正式版',
                  badge: scope.actions.hasAppUpdate,
                  onTap: () => showHaizUpdateSheet(context)),
            _Row(
              icon: Icons.blur_on_rounded,
              title: '玻璃材质',
              detail: '导航和悬浮按钮的光学玻璃；「不透明」更省电、对比更高',
              trailing: SizedBox(
                width: 150,
                child: ValueListenableBuilder<String>(
                  valueListenable: GlassPreference.value,
                  builder: (context, v, _) => Segmented<String>(
                    key: const Key('glass-mode'),
                    value: v,
                    items: const [('auto', '玻璃'), ('solid', '不透明')],
                    onChanged: GlassPreference.set,
                  ),
                ),
              ),
            ),
            _Row(icon: Icons.info_outline_rounded, title: '关于 HAIZ', detail: haizBuildLabel,
                // Developers: long-press opens the Glass Lab.
                onLongPress: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => const GlassLabScreen())),
                onTap: () => _about(context)),
          ])),
          if (scope.auth.authenticated)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(Space.gutter - 6, 18, Space.gutter, 0),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: LinkAction('退出登录', key: const Key('account-signout'), color: context.c.late,
                      onTap: scope.actions.confirmSignOut),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _exportCalendar(BuildContext context, PocketStore store) async {
    try {
      final target = await FilePicker.saveFile(
        fileName: 'HAIZ-作业日历.ics',
        mimeType: 'text/calendar',
        bytes: CalendarExport.bytes(store.upcomingTasks),
      );
      if (context.mounted && target != null) showToast(context, '日历文件已保存，可在日历应用中导入。');
    } catch (error) {
      if (context.mounted) showToast(context, '导出没有完成：$error');
    }
  }

  void _cloudDataInfo(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('账号数据'),
        content: const Text(
          '登录后，任务、课表、备忘和专注记录保存在你的 HAIZ 云端账号里，只有你本人可读写（服务器按账号隔离）。\n\n'
          '本机备份文件只用于访客空间，避免把账号数据导出到不受保护的文件。退出登录后，本机访客空间可以单独备份。\n\n'
          '离线时账号记录暂不可编辑；这是当前版本的限制。'),
        actions: [TextButton(onPressed: () => Navigator.pop(d), child: const Text('知道了'))],
      ),
    );
  }

  void _about(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('关于 HAIZ'),
        content: const Text(
          '$haizBuildLabel\n\n'
          'HAIZ 是 haiz.space 的独立校园学习工具，不是海南中学官方应用。\n\n'
          '访客模式下，记录只保存在这台设备；登录后保存在你的云端账号。班级服务需要单独授权。'),
        actions: [TextButton(onPressed: () => Navigator.pop(d), child: const Text('关闭'))],
      ),
    );
  }
}

class _AccountBlock extends StatelessWidget {
  const _AccountBlock();
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final scope = HaizScope.of(context);
    final auth = scope.auth;
    final signedIn = auth.authenticated;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.gutter, 14, Space.gutter, 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: c.raised, borderRadius: BorderRadius.circular(22)),
          alignment: Alignment.center,
          child: signedIn
              ? Text((auth.userEmail ?? '?').characters.first.toUpperCase(), style: TypeScale.headline(c.ink))
              : Icon(Icons.person_outline_rounded, color: c.ink2),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(signedIn ? (auth.userEmail ?? 'HAIZ 账号') : '访客', style: TypeScale.headline(c.ink)),
            const SizedBox(height: 2),
            if (signedIn)
              SyncLine(store: scope.store)
            else
              Text('记录只保存在这台设备。登录后保存到你的云端账号，可在其他设备继续使用。',
                  style: TypeScale.footnote(c.ink2)),
            if (auth.error != null) ...[
              const SizedBox(height: 4),
              Text(auth.error!, style: TypeScale.caption(c.late)),
            ],
            if (!signedIn) ...[
              const SizedBox(height: 10),
              if (auth.configured)
                Row(children: [
                  HaizButton(key: const Key('pocket-account-entry'), label: '登录', dense: true,
                      onPressed: () => scope.actions.openAccount()),
                  const SizedBox(width: 8),
                  HaizButton(key: const Key('pocket-register-entry'), label: '注册', dense: true,
                      kind: HaizButtonKind.secondary, onPressed: () => scope.actions.openAccount(register: true)),
                ])
              else
                Text('这个版本没有配置云端账号服务。', style: TypeScale.caption(c.ink3)),
            ],
          ]),
        ),
      ]),
    );
  }
}

/// This week's real numbers only. No streaks, no scores.
class _Record extends StatelessWidget {
  const _Record({required this.store});
  final PocketStore store;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final now = DateTime.now();
    final monday = dayOf(now).subtract(Duration(days: now.weekday - 1));
    final perDay = List<int>.filled(7, 0);
    for (final log in store.focusLogs) {
      final d = dayOf(log.at).difference(monday).inDays;
      if (d >= 0 && d < 7) perDay[d] += log.minutes;
    }
    final total = perDay.fold(0, (a, b) => a + b);
    final peak = perDay.fold(0, (a, b) => b > a ? b : a);
    final completed = store.tasks.where((t) {
      final at = store.metaFor(t.id).completedAt;
      return t.completed && at != null && !dayOf(at).isBefore(monday);
    }).length;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionHeader('本周'),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(total == 0 ? '还没有专注记录' : '专注 ${durationText(total)}', style: TypeScale.headline(c.ink)),
              const SizedBox(height: 2),
              Text('完成 $completed 项任务', style: TypeScale.footnote(c.ink2)),
            ]),
          ),
          SizedBox(
            height: 44,
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              for (var i = 0; i < 7; i++)
                Padding(
                  padding: const EdgeInsets.only(left: 5),
                  child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                    Container(
                      width: 10,
                      height: peak == 0 ? 2 : (2 + 26 * perDay[i] / peak),
                      decoration: BoxDecoration(
                        color: i == now.weekday - 1 ? c.ink : (perDay[i] == 0 ? c.rule : c.ink3),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(weekdayName(i + 1).substring(1), style: TypeScale.micro(i == now.weekday - 1 ? c.ink : c.ink3)
                        .copyWith(fontSize: 9)),
                  ]),
                ),
            ]),
          ),
        ]),
      ),
    ]);
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.rows});
  final String title;
  final List<Widget> rows;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    SectionHeader(title),
    for (final (i, r) in rows.indexed) ...[
      r,
      if (i < rows.length - 1) const Hairline(indent: 56),
    ],
  ]);
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.title, this.detail, this.onTap, this.trailing, this.badge = false, this.onLongPress});
  final VoidCallback? onLongPress;
  final IconData icon;
  final String title;
  final String? detail;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool badge;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Pressable(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 12, 12, 12),
        child: Row(children: [
          Icon(icon, size: 21, color: c.ink2),
          const SizedBox(width: 15),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(title, style: TypeScale.callout(c.ink)),
                if (badge) ...[
                  const SizedBox(width: 6),
                  Container(width: 7, height: 7, decoration: BoxDecoration(color: c.now, shape: BoxShape.circle)),
                ],
              ]),
              if (detail != null) Text(detail!, style: TypeScale.caption(c.ink3)),
            ]),
          ),
          ?trailing,
          if (trailing == null && onTap != null) Icon(Icons.chevron_right_rounded, color: c.ink3, size: 20),
        ]),
      ),
    );
  }
}
