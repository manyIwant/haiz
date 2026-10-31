import 'package:flutter/material.dart';

/// A visual entrance to the existing device-local guest workspace.
/// This is not account authentication: verified account sign-in is not offered.
class LampEntry extends StatefulWidget {
  const LampEntry({super.key, required this.onEnter});

  final VoidCallback onEnter;

  @override
  State<LampEntry> createState() => _LampEntryState();
}

class _LampEntryState extends State<LampEntry>
    with SingleTickerProviderStateMixin {
  late final AnimationController _light = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1450),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.of(context).disableAnimations) {
      _light.value = 1;
    } else if (!_light.isAnimating && _light.value == 0) {
      _light.forward();
    }
  }

  @override
  void dispose() {
    _light.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF08131D),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => AnimatedBuilder(
            animation: _light,
            builder: (context, _) {
              final t = Curves.easeOutCubic.transform(_light.value);
              return Stack(
                fit: StackFit.expand,
                children: [
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xFF0B2434), Color(0xFF08131D)],
                      ),
                    ),
                  ),
                  // Two soft beams and a narrow horizon: no shader, asset,
                  // external dependency or costly blur filter is required.
                  Positioned(
                    top: -60,
                    left: -constraints.maxWidth * .3,
                    right: -constraints.maxWidth * .3,
                    height: constraints.maxHeight * .58,
                    child: Opacity(
                      opacity: t * .8,
                      child: Transform.scale(
                        scale: .78 + t * .22,
                        alignment: Alignment.topCenter,
                        child: const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: RadialGradient(
                              center: Alignment(0, -.8),
                              radius: .95,
                              colors: [
                                Color(0x8854CAD6),
                                Color(0x363F9AAE),
                                Color(0x00102237),
                              ],
                              stops: [0, .38, 1],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: constraints.maxHeight * .32,
                    left: constraints.maxWidth * .16,
                    right: constraints.maxWidth * .16,
                    height: 2,
                    child: Opacity(
                      opacity: t * .9,
                      child: const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Color(0x0056DFE2),
                              Color(0xFF91E8E8),
                              Color(0x0056DFE2),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 28,
                        vertical: 24,
                      ),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: Opacity(
                          opacity: t,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const SizedBox(height: 52),
                              const Text(
                                'HAIZ',
                                style: TextStyle(
                                  color: Color(0xFFF0FBFC),
                                  fontSize: 49,
                                  fontWeight: FontWeight.w300,
                                  letterSpacing: 13,
                                ),
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'POCKET  /  CAMPUS COMPANION',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Color(0xFFA4C6CE),
                                  fontSize: 10,
                                  letterSpacing: 2,
                                ),
                              ),
                              const SizedBox(height: 88),
                              Container(
                                padding: const EdgeInsets.all(24),
                                decoration: BoxDecoration(
                                  color: const Color(0xCC142B38),
                                  borderRadius: BorderRadius.circular(26),
                                  border: Border.all(
                                    color: const Color(0x446DC8D0),
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    const Text(
                                      '欢迎回来',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 25,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    const Text(
                                      '你的课表、待办与校园空间，\n从这里开始。',
                                      style: TextStyle(
                                        color: Color(0xFFB5CDD4),
                                        height: 1.6,
                                      ),
                                    ),
                                    const SizedBox(height: 26),
                                    FilledButton(
                                      key: const Key('lamp-enter-guest'),
                                      onPressed: widget.onEnter,
                                      style: FilledButton.styleFrom(
                                        backgroundColor:
                                            const Color(0xFFB6E7E7),
                                        foregroundColor:
                                            const Color(0xFF092430),
                                        minimumSize: const Size.fromHeight(52),
                                        shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(16),
                                        ),
                                      ),
                                      child: const Text('进入本机空间  →'),
                                    ),
                                    const SizedBox(height: 12),
                                    const Text(
                                      '仅打开此设备的访客数据 · 无账号验证或云端同步',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        color: Color(0xFF9DBCC4),
                                        fontSize: 11,
                                        height: 1.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 28),
                              const Text(
                                'A QUIETER WAY TO STAY CONNECTED',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Color(0xFF86A7B1),
                                  fontSize: 10,
                                  letterSpacing: 1.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
