import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
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

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return SingleChildScrollView(
      key: const PageStorageKey('campus_scroll'),
      padding: const EdgeInsets.fromLTRB(23, 31, 23, 130),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Eyebrow('CAMPUS / A QUIETER WAY'),
              const SizedBox(height: 23),
              const PageTitle(
                title: '让校园信息，变简单。',
                subtitle: '把真正需要的服务放在触手可及的位置。',
              ),
              const SizedBox(height: 25),
              PocketCard(
                onTap: onOpenAcademic,
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: p.accent.withValues(alpha: .13),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        Icons.school_outlined,
                        color: p.accent,
                        size: 27,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'HAIZ Academic · 班级同步',
                            style: TextStyle(
                              color: p.foreground,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            '连接授权班级 · 核对后加入个人任务',
                            style: TextStyle(color: p.secondary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.arrow_forward_ios_rounded,
                      color: p.accent,
                      size: 17,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              PocketCard(
                onTap: onOpenLab,
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: p.accent.withValues(alpha: .13),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        Icons.science_outlined,
                        color: p.accent,
                        size: 27,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'HAIZ Teach · 物理实验',
                            style: TextStyle(
                              color: p.foreground,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            '打点计时器 · 纸带测量 · v–t 图像',
                            style: TextStyle(color: p.secondary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.arrow_forward_ios_rounded,
                      color: p.accent,
                      size: 17,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              PocketCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.info_outline_rounded,
                          color: p.accent,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          '当前为本地预览',
                          style: TextStyle(
                            color: p.foreground,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 9),
                    Text(
                      '班级协作已支持连接自建 HAIZ Academic 服务；学校正式统一身份认证、校园卡和学校课表仍需取得授权才能接入。',
                      style: TextStyle(
                        color: p.secondary,
                        height: 1.65,
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 27),
              const SectionLabel('校园服务'),
              const SizedBox(height: 13),
              _service(
                context,
                Icons.meeting_room_outlined,
                '空教室',
                '按日期与节次查询空闲空间',
              ),
              _service(context, Icons.local_library_outlined, '图书馆', '预约与馆内信息'),
              _service(context, Icons.credit_card_outlined, '校园卡', '余额与消费记录'),
              _service(context, Icons.bolt_outlined, '宿舍电量', '照明与空调用量'),
              const SizedBox(height: 28),
              const SectionLabel('外观与体验'),
              const SizedBox(height: 13),
              PocketCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '界面主题',
                      style: TextStyle(
                        color: p.foreground,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 11),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final entry in const [
                          ('porcelain', 'Porcelain · 瓷白'),
                          ('obsidian', 'Obsidian · 黑曜'),
                          ('ocean', 'Ocean · 深海'),
                        ])
                          ChoiceChip(
                            selected: store.appearance == entry.$1,
                            label: Text(entry.$2),
                            onSelected: (_) => store.setAppearance(entry.$1),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '高频操作优先于装饰性动画；遵从系统减少动态效果设置。',
                      style: TextStyle(color: p.secondary, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 25),
              Eyebrow('BASED ON 3BEUML / ZZUPOCKET · MIT'),
              const SizedBox(height: 7),
              Text(
                '学生端工作流研究版本 · 并非郑州大学官方应用，也不是海南中学官方服务。',
                style: TextStyle(color: p.secondary, fontSize: 11, height: 1.6),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _service(
    BuildContext context,
    IconData icon,
    String title,
    String detail,
  ) {
    final p = PocketSkin.of(context).colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: PocketCard(
        onTap: () => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$title：尚未接入真实学校服务'),
            behavior: SnackBarBehavior.floating,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: p.accent.withValues(alpha: .1),
                borderRadius: BorderRadius.circular(15),
              ),
              child: Icon(icon, color: p.accent, size: 23),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: p.foreground,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    detail,
                    style: TextStyle(color: p.secondary, fontSize: 11.5),
                  ),
                ],
              ),
            ),
            Text('待接入', style: TextStyle(color: p.secondary, fontSize: 10)),
            const SizedBox(width: 6),
            Icon(Icons.chevron_right_rounded, size: 18, color: p.secondary),
          ],
        ),
      ),
    );
  }
}
