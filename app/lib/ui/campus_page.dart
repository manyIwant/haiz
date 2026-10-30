import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/pocket_store.dart';
import 'editorial.dart';
import 'kit.dart';

class CampusPage extends StatelessWidget {
  final PocketStore store;
  final VoidCallback onOpenLab;
  final VoidCallback onOpenAcademic;

  const CampusPage({
    super.key,
    required this.store,
    required this.onOpenLab,
    required this.onOpenAcademic,
  });

  Future<void> _openSite(BuildContext context, String path) async {
    final uri = Uri.https('haiz.space', '/$path');
    try {
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
    } catch (_) {
      // A missing browser should not crash the native student workspace.
    }
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('无法打开网页，请检查浏览器与网络连接。')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return SingleChildScrollView(
      key: const PageStorageKey('campus_scroll'),
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(23, 26, 23, 126),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const EditorialMasthead(chapter: '05 / THE CAMPUS'),
              const SizedBox(height: 31),
              const EditorialHeading(
                title: '一所正在发生的学校。',
                subtitle: '从这里进入校园，也处理日常的事。',
              ),
              const SizedBox(height: 24),
              CampusPhotoPanel(
                asset: 'assets/campus/campus_erhao.jpg',
                eyebrow: 'HAIZ / THE PLACE',
                title: '走进海中',
                caption: '从真实校园的建筑、道路和树影开始。',
                actionLabel: '进入三维校园 · 将打开网页',
                height: 249,
                onTap: () => _openSite(context, 'campus-3d.html'),
              ),
              const SizedBox(height: 30),
              const SectionLabel('校园与阅读'),
              const SizedBox(height: 6),
              EditorialLinkRow(
                number: '01',
                title: '校园杂志',
                subtitle: '校园照片、地点与故事',
                external: true,
                onTap: () => _openSite(context, 'journal.html'),
              ),
              EditorialLinkRow(
                number: '02',
                title: '树荫下的三次停留',
                subtitle: '北门、榄仁树与砚池的路线档案',
                external: true,
                onTap: () => _openSite(context, 'memory-walk.html'),
              ),
              const SizedBox(height: 31),
              const SectionLabel('学习工具'),
              const SizedBox(height: 6),
              EditorialLinkRow(
                number: '03',
                title: '班级同步',
                subtitle: '连接自己有权使用的班级服务',
                onTap: onOpenAcademic,
              ),
              EditorialLinkRow(
                number: '04',
                title: '物理纸带实验',
                subtitle: '采点、测量与速度图表',
                onTap: onOpenLab,
              ),
              const SizedBox(height: 31),
              const SectionLabel('待接入服务'),
              const SizedBox(height: 8),
              Text(
                '以下需要学校正式授权。当前版本不提供虚构的余额、空闲教室或预约数据。',
                style: TextStyle(color: p.secondary, fontSize: 12, height: 1.7),
              ),
              const EditorialLinkRow(
                number: '—',
                title: '空教室与图书馆',
                subtitle: '需连接学校空间与预约系统',
                status: '未接入',
              ),
              const EditorialLinkRow(
                number: '—',
                title: '校园卡与宿舍电量',
                subtitle: '需学校数据接口与用户授权',
                status: '未接入',
              ),
              const SizedBox(height: 31),
              const SectionLabel('外观'),
              const SizedBox(height: 13),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final theme in const [
                    ('porcelain', '纸张'),
                    ('obsidian', '夜色'),
                    ('ocean', '深海'),
                  ])
                    ChoiceChip(
                      label: Text(theme.$2),
                      selected: store.appearance == theme.$1,
                      onSelected: (_) => store.setAppearance(theme.$1),
                    ),
                ],
              ),
              const SizedBox(height: 26),
              Divider(color: p.border),
              const SizedBox(height: 12),
              Text(
                'HAIZ.SPACE / INDEPENDENT CAMPUS PROJECT',
                style: TextStyle(
                  color: p.secondary,
                  fontSize: 9,
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '非海南中学官方应用。个人学习记录优先保存在本机；班级功能需自行授权连接。',
                style: TextStyle(
                  color: p.secondary,
                  fontSize: 11,
                  height: 1.65,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
