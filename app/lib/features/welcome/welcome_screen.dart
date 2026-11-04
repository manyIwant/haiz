import 'package:flutter/material.dart';

import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';

/// First launch only, fully local (no remote page, no network wait).
/// It says what HAIZ does and where data is kept, then gets out of the way.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({
    super.key,
    required this.onStart,
    required this.onSignIn,
    required this.onRegister,
    required this.accountsAvailable,
  });

  final VoidCallback onStart;
  final void Function(BuildContext) onSignIn;
  final void Function(BuildContext) onRegister;
  final bool accountsAvailable;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final size = MediaQuery.sizeOf(context);
    final photo = (size.height * .38).clamp(180.0, 360.0);
    return Scaffold(
      backgroundColor: c.canvas,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              SizedBox(
                height: photo,
                child: Stack(fit: StackFit.expand, children: [
                  Semantics(
                    image: true,
                    label: '校园照片',
                    child: Image.asset('assets/campus/campus_fengqitang.jpg', fit: BoxFit.cover),
                  ),
                  // Only to keep the photo's lower edge from cutting hard
                  // into the page; it carries no colour of its own.
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: const [.62, 1],
                        colors: [c.canvas.withValues(alpha: 0), c.canvas],
                      ),
                    ),
                  ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(28, 8, 28, 28),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('HAIZ', style: TypeScale.largeTitle(c.ink).copyWith(letterSpacing: 2, fontSize: 30)),
                  const SizedBox(height: 18),
                  for (final (lead, line) in const [
                    ('课', '今天上什么课、下一节在哪个教室'),
                    ('勾', '作业按截止日期排好，做完勾掉'),
                    ('收', '班群通知和截图，确认后才变成任务'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(children: [
                        Container(
                          width: 26,
                          height: 26,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(border: Border.all(color: c.ruleStrong), borderRadius: BorderRadius.circular(6)),
                          child: Text(lead, style: TypeScale.footnote(lead == '勾' ? c.signal : c.ink).copyWith(fontWeight: FontWeight.w700)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Text(line, style: TypeScale.callout(c.ink))),
                      ]),
                    ),
                  const SizedBox(height: 22),
                  HaizButton(
                    key: const Key('welcome-start'),
                    label: '开始使用',
                    expand: true,
                    onPressed: onStart,
                  ),
                  const SizedBox(height: 8),
                  Text('以访客身份开始：记录保存在这台设备，之后可以随时登录。', style: TypeScale.caption(c.ink3)),
                  if (accountsAvailable) ...[
                    const SizedBox(height: 18),
                    Row(children: [
                      Expanded(child: HaizButton(key: const Key('pocket-account-entry'), label: '登录',
                          kind: HaizButtonKind.secondary, expand: true, onPressed: () => onSignIn(context))),
                      const SizedBox(width: 10),
                      Expanded(child: HaizButton(key: const Key('pocket-register-entry'), label: '注册',
                          kind: HaizButtonKind.secondary, expand: true, onPressed: () => onRegister(context))),
                    ]),
                  ],
                  const SizedBox(height: 22),
                  Text('HAIZ 是 haiz.space 的独立校园项目，不是学校官方应用。', style: TypeScale.caption(c.ink3)),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
