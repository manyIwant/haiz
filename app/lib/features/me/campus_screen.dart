import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../app/nav.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';

/// 校园: the place, its stories, the tools that work offline, and the
/// school services that are not connected (said plainly, never simulated).
class CampusScreen extends StatelessWidget {
  const CampusScreen({super.key, required this.actions});
  final HaizActions actions;

  Future<void> _open(BuildContext context, String path) async {
    final uri = Uri.https('haiz.space', '/$path');
    try {
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
    } catch (_) {
      // A missing browser must not crash the workspace.
    }
    if (context.mounted) showToast(context, '没能打开网页，请检查网络和浏览器。');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final top = MediaQuery.paddingOf(context).top;
    Widget row(String title, String detail, {VoidCallback? onTap, String? tag, bool web = false}) => Pressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 13, Space.gutter - 4, 13),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TypeScale.callout(onTap == null ? c.ink2 : c.ink).copyWith(fontWeight: FontWeight.w500)),
              const SizedBox(height: 1),
              Text(detail, style: TypeScale.caption(c.ink3)),
            ]),
          ),
          if (tag != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(border: Border.all(color: c.ruleStrong), borderRadius: BorderRadius.circular(4)),
              child: Text(tag, style: TypeScale.micro(c.ink2)),
            ),
          if (onTap != null)
            Icon(web ? Icons.north_east_rounded : Icons.chevron_right_rounded, size: 18, color: c.ink3),
        ]),
      ),
    );
    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(slivers: [
        SliverToBoxAdapter(
          child: Stack(children: [
            AspectRatio(
              aspectRatio: 4 / 3,
              child: Semantics(
                label: '校园照片',
                image: true,
                child: Image.asset('assets/campus/campus_erhao.jpg', fit: BoxFit.cover,
                    color: c.dark ? Colors.black.withValues(alpha: .18) : null,
                    colorBlendMode: c.dark ? BlendMode.darken : null),
              ),
            ),
            Positioned(
              top: top + 4,
              left: 8,
              child: Material(
                color: Colors.black.withValues(alpha: .32),
                shape: const CircleBorder(),
                child: IconButton(
                  tooltip: '返回',
                  icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white),
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              ),
            ),
          ]),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Space.gutter, 18, Space.gutter, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('校园', style: TypeScale.largeTitle(c.ink)),
              const SizedBox(height: 4),
              Text('haiz.space 整理的校园影像、地点和故事。网页内容需要联网；学习工具在本机运行。',
                  style: TypeScale.footnote(c.ink2)),
            ]),
          ),
        ),
        SliverToBoxAdapter(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const SectionHeader('走进校园'),
          row('三维校园', '第一人称走进校园和教室 · 网页 · 需要联网与 WebGL', web: true,
              onTap: () => _open(context, 'campus-3d.html')),
          const Hairline(indent: Space.gutter),
          row('建筑观察手册', '实拍照片与建筑细节 · 网页', web: true, onTap: () => _open(context, 'architecture.html')),
          const Hairline(indent: Space.gutter),
          row('校园杂志', '校园照片、地点与故事 · 网页', web: true, onTap: () => _open(context, 'journal.html')),
          const Hairline(indent: Space.gutter),
          row('树荫下的三次停留', '北门、榄仁树与砚池的路线档案 · 网页', web: true, onTap: () => _open(context, 'memory-walk.html')),
          const SectionHeader('学习工具'),
          row('物理纸带实验', '打点计时器采点、测量与速度图表 · 本机运行', onTap: actions.openLab),
          const SectionHeader('学校服务'),
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, 4),
            child: Text('以下服务需要学校正式授权和数据接口。在接入前，HAIZ 不显示任何余额、空闲教室或成绩数据。',
                style: TypeScale.caption(c.ink3)),
          ),
          row('空教室与图书馆座位', '需要学校空间与预约系统', tag: '未接入'),
          const Hairline(indent: Space.gutter),
          row('校园卡与宿舍电量', '需要学校数据接口与本人授权', tag: '未接入'),
          const Hairline(indent: Space.gutter),
          row('考试安排与成绩', '需要教务系统授权', tag: '未接入'),
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.gutter, 24, Space.gutter, 40),
            child: Text('haiz.space 是独立的校园项目，不是海南中学官方网站或应用。', style: TypeScale.caption(c.ink3)),
          ),
        ])),
      ]),
    );
  }
}
