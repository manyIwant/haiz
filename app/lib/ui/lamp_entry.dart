import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../core/pocket_auth.dart';

/// HAIZ Pocket entrance: a night brick wall under a real wall lamp.
///
/// The lamp follows what the person is doing. It warms up as they focus the
/// email and password fields, pulses while the server checks the account,
/// dims on an error and floods the wall once the account is verified or the
/// guest space is chosen. The same native screen runs on Android, iOS and
/// the web build, so there is one sign-in, and passwords only ever go to
/// [PocketAuthController] (Supabase Auth over HTTPS).
class LampEntry extends StatefulWidget {
  const LampEntry({
    super.key,
    required this.onEnter,
    this.auth,
    this.onRegister,
    this.onHold,
  });

  /// Opens the workspace: after a verified sign-in or for the guest space.
  final VoidCallback onEnter;

  /// Account service; null or unconfigured leaves only the guest space.
  final PocketAuthController? auth;

  /// Opens account registration.
  final VoidCallback? onRegister;

  /// True while a sign-in is in flight, so the shell keeps this screen up
  /// long enough to show the light coming on.
  final ValueChanged<bool>? onHold;

  @override
  State<LampEntry> createState() => _LampEntryState();
}

enum _Phase { idle, email, password, ready, checking, error, success }

/// How lit the scene is: wall brightness and saturation, the warm pool of
/// light on the bricks, and the bulb itself.
class _Light {
  const _Light(this.wall, this.saturation, this.warmth, this.bulb);
  final double wall;
  final double saturation;
  final double warmth;
  final double bulb;

  static _Light lerp(_Light a, _Light b, double t) => _Light(
    ui.lerpDouble(a.wall, b.wall, t)!,
    ui.lerpDouble(a.saturation, b.saturation, t)!,
    ui.lerpDouble(a.warmth, b.warmth, t)!,
    ui.lerpDouble(a.bulb, b.bulb, t)!,
  );
}

class _LightTween extends Tween<_Light> {
  _LightTween({super.end});
  @override
  _Light lerp(double t) => _Light.lerp(begin!, end!, t);
}

const _lights = <_Phase, _Light>{
  _Phase.idle: _Light(.30, .80, .05, .18),
  _Phase.email: _Light(.44, .89, .30, .40),
  _Phase.password: _Light(.51, .95, .48, .53),
  _Phase.ready: _Light(.58, 1.0, .56, .60),
  _Phase.checking: _Light(.61, 1.04, .60, .78),
  _Phase.error: _Light(.34, .80, .19, .27),
  _Phase.success: _Light(1.0, 1.06, 1.0, 1.0),
};

/// Geometry of `assets/lamp/wall-photo.webp` in source pixels. The photo
/// has a placeholder card baked into it; the panel is sized and placed to
/// cover that card at any screen size.
const _photo = Size(1644, 957);
const _bakedCard = Rect.fromLTRB(600, 323, 1045, 766);
const _lampMouth = Offset(828, 128);

const _ink = Color(0xFFF7F1E6);
const _inkSoft = Color(0xFFE2D5C3);
const _muted = Color(0xFFC2B4A0);
const _warm = Color(0xFFFFDB98);
const _errorInk = Color(0xFFFFCDB8);

class _LampEntryState extends State<LampEntry> with TickerProviderStateMixin {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 450),
  );
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1950),
  );
  late final AnimationController _arrive = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  );

  _Phase _phase = _Phase.idle;
  bool _errorLatched = false;
  bool _busy = false;
  bool _showPassword = false;
  String? _message;
  bool _messageIsError = false;
  Timer? _enterTimer;

  bool get _reduced => MediaQuery.of(context).disableAnimations;
  bool get _accountsAvailable => widget.auth?.configured ?? false;

  @override
  void initState() {
    super.initState();
    _emailFocus.addListener(_followFocus);
    _passwordFocus.addListener(_followFocus);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_reduced) {
      _arrive.value = 1;
    } else if (!_arrive.isAnimating && _arrive.value == 0) {
      _arrive.forward();
    }
  }

  @override
  void dispose() {
    _enterTimer?.cancel();
    _email.dispose();
    _password.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _shake.dispose();
    _pulse.dispose();
    _arrive.dispose();
    super.dispose();
  }

  void _setPhase(_Phase next) {
    if (_phase == next) return;
    setState(() => _phase = next);
    if (next == _Phase.checking && !_reduced) {
      _pulse.repeat(reverse: true);
    } else {
      _pulse.stop();
      _pulse.value = 0;
    }
  }

  /// The light tracks focus and input, unless a result is being shown.
  void _followFocus() {
    if (!mounted || _busy || _errorLatched || _phase == _Phase.success) {
      return;
    }
    if (_passwordFocus.hasFocus) {
      _setPhase(_Phase.password);
    } else if (_emailFocus.hasFocus) {
      _setPhase(_Phase.email);
    } else if (_email.text.trim().isNotEmpty && _password.text.isNotEmpty) {
      _setPhase(_Phase.ready);
    } else if (_email.text.trim().isNotEmpty) {
      _setPhase(_Phase.email);
    } else {
      _setPhase(_Phase.idle);
    }
  }

  void _onInput(String _) {
    _errorLatched = false;
    if (_message != null) setState(() => _message = null);
    _followFocus();
  }

  void _say(String text, {bool error = false}) => setState(() {
    _message = text;
    _messageIsError = error;
  });

  void _deny(String text) {
    _errorLatched = true;
    _setPhase(_Phase.error);
    _say(text, error: true);
    if (!_reduced) _shake.forward(from: 0);
  }

  void _illuminate(String text) {
    _setPhase(_Phase.success);
    _say(text);
    _enterTimer?.cancel();
    _enterTimer = Timer(Duration(milliseconds: _reduced ? 150 : 1450), () {
      if (mounted) widget.onEnter();
    });
  }

  static final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

  Future<void> _signIn() async {
    if (_busy || _phase == _Phase.success) return;
    final auth = widget.auth;
    if (auth == null || !auth.configured) {
      _deny('账号服务暂时不可用，你仍可进入本机访客空间');
      return;
    }
    final email = _email.text.trim();
    if (email.isEmpty) {
      _deny('请输入邮箱');
      _emailFocus.requestFocus();
      return;
    }
    if (!_emailPattern.hasMatch(email)) {
      _deny('请输入有效的邮箱');
      _emailFocus.requestFocus();
      return;
    }
    if (_password.text.isEmpty) {
      _deny('请输入密码');
      _passwordFocus.requestFocus();
      return;
    }
    FocusManager.instance.primaryFocus?.unfocus();
    _errorLatched = false;
    setState(() => _busy = true);
    _setPhase(_Phase.checking);
    _say('正在验证身份…');
    widget.onHold?.call(true);
    try {
      await auth.signIn(email, _password.text);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted) return;
    if (auth.authenticated) {
      _password.clear();
      _illuminate('身份已验证，正在进入 HAIZ Pocket');
    } else {
      widget.onHold?.call(false);
      _deny(auth.error ?? '登录未完成，请检查邮箱和密码后重试');
    }
  }

  Future<void> _forgot() async {
    final auth = widget.auth;
    if (auth == null || !auth.configured) {
      _say('找回密码需要账号服务，目前暂不可用');
      return;
    }
    final email = _email.text.trim();
    if (!_emailPattern.hasMatch(email)) {
      _say('先在上方输入账号邮箱，再点忘记密码', error: true);
      _emailFocus.requestFocus();
      return;
    }
    auth.clearError();
    setState(() => _busy = true);
    await auth.sendReset(email);
    if (!mounted) return;
    setState(() => _busy = false);
    if (auth.error != null) {
      _say(auth.error!, error: true);
    } else {
      _say('如果邮箱已注册，系统会发送密码重置说明');
    }
  }

  void _guest() {
    if (_busy || _phase == _Phase.success) return;
    FocusManager.instance.primaryFocus?.unfocus();
    _illuminate('已选择本机访客空间，正在进入');
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    return Theme(
      data: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: const ColorScheme.dark(primary: _warm),
        textSelectionTheme: const TextSelectionThemeData(
          cursorColor: _warm,
          selectionColor: Color(0x55FFDB98),
          selectionHandleColor: _warm,
        ),
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFF071A34),
        resizeToAvoidBottomInset: false,
        body: LayoutBuilder(
          builder: (context, box) {
            final size = box.biggest;
            final scale = math.max(
              size.width / _photo.width,
              size.height / _photo.height,
            );
            final offset = Offset(
              (_photo.width * scale - size.width) / 2,
              (_photo.height * scale - size.height) / 2,
            );
            Offset map(Offset p) => p * scale - offset;
            final card = Rect.fromPoints(
              map(_bakedCard.topLeft),
              map(_bakedCard.bottomRight),
            );
            final lamp = map(_lampMouth);
            final panelWidth = math.min(
              460.0,
              math.min(size.width - 24, math.max(card.width + 24, 340.0)),
            );
            return TweenAnimationBuilder<_Light>(
              tween: _LightTween(end: _lights[_phase]!),
              duration: _reduced
                  ? Duration.zero
                  : Duration(
                      milliseconds: _phase == _Phase.success ? 1500 : 1100,
                    ),
              curve: const Cubic(.18, .7, .26, 1),
              builder: (context, light, _) => Stack(
                fit: StackFit.expand,
                children: [
                  AnimatedScale(
                    scale: _phase == _Phase.success ? 1.018 : 1,
                    duration: _reduced
                        ? Duration.zero
                        : const Duration(milliseconds: 1800),
                    curve: Curves.easeOut,
                    child: ColorFiltered(
                      colorFilter: ColorFilter.matrix(
                        _wallMatrix(light.wall, light.saturation),
                      ),
                      child: Image.asset(
                        'assets/lamp/wall-photo.webp',
                        key: const Key('lamp-wall'),
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) =>
                            const ColoredBox(color: Color(0xFF071A34)),
                      ),
                    ),
                  ),
                  IgnorePointer(
                    child: AnimatedBuilder(
                      animation: _pulse,
                      builder: (context, _) => CustomPaint(
                        key: const Key('lamp-light'),
                        painter: _LampLightPainter(
                          lamp: lamp,
                          scale: scale,
                          warmth: light.warmth,
                          bulb: light.bulb,
                          pulse: _pulse.value,
                        ),
                      ),
                    ),
                  ),
                  CustomSingleChildLayout(
                    delegate: _PanelPlacement(
                      centerY: card.center.dy,
                      top: media.padding.top + 12,
                      bottom:
                          math.max(
                            media.padding.bottom,
                            media.viewInsets.bottom,
                          ) +
                          12,
                    ),
                    child: AnimatedBuilder(
                      animation: Listenable.merge([_shake, _arrive]),
                      builder: (context, child) {
                        final t = Curves.easeOutCubic.transform(_arrive.value);
                        return Opacity(
                          opacity: t,
                          child: Transform.translate(
                            offset: Offset(
                              _shakeOffset(_shake.value),
                              (1 - t) * 12,
                            ),
                            child: child,
                          ),
                        );
                      },
                      child: SizedBox(
                        width: panelWidth,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: card.height + 16,
                          ),
                          child: _panel(context),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _panel(BuildContext context) {
    final lit = _phase == _Phase.success;
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: AnimatedContainer(
          duration: _reduced
              ? Duration.zero
              : const Duration(milliseconds: 700),
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
          decoration: BoxDecoration(
            color: lit ? const Color(0xB0302823) : const Color(0xB81B1A1E),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: lit ? const Color(0x99FFE7BC) : const Color(0x3DF6ECD8),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'HAIZ Pocket',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFFE5CDA7),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '登录',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: _ink,
                  fontSize: 28,
                  height: 1.2,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 24),
              const _FieldLabel('邮箱'),
              const SizedBox(height: 8),
              TextField(
                key: const Key('lamp-email'),
                controller: _email,
                focusNode: _emailFocus,
                enabled: !_busy,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                onChanged: _onInput,
                onSubmitted: (_) => _passwordFocus.requestFocus(),
                style: const TextStyle(color: _ink, fontSize: 15),
                decoration: _fieldDecoration(
                  hint: 'name@example.com',
                  suffix: const Icon(Icons.person_outline_rounded, size: 18),
                ),
              ),
              const SizedBox(height: 16),
              const _FieldLabel('密码'),
              const SizedBox(height: 8),
              TextField(
                key: const Key('lamp-password'),
                controller: _password,
                focusNode: _passwordFocus,
                enabled: !_busy,
                obscureText: !_showPassword,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                onChanged: _onInput,
                onSubmitted: (_) => _signIn(),
                style: const TextStyle(color: _ink, fontSize: 15),
                decoration: _fieldDecoration(
                  hint: '输入你的密码',
                  suffix: IconButton(
                    tooltip: _showPassword ? '隐藏密码' : '显示密码',
                    onPressed: () =>
                        setState(() => _showPassword = !_showPassword),
                    icon: Icon(
                      _showPassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      size: 18,
                    ),
                  ),
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  key: const Key('lamp-forgot-password'),
                  style: TextButton.styleFrom(
                    foregroundColor: _inkSoft,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    textStyle: const TextStyle(fontSize: 13),
                  ),
                  onPressed: _busy ? null : _forgot,
                  child: const Text('忘记密码？'),
                ),
              ),
              const SizedBox(height: 4),
              FilledButton(
                key: const Key('lamp-sign-in'),
                onPressed: _busy || lit ? null : _signIn,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFF7F3EC),
                  foregroundColor: const Color(0xFF242026),
                  disabledBackgroundColor: const Color(0xD9F7F3EC),
                  disabledForegroundColor: const Color(0xFF242026),
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                child: _busy && _phase == _Phase.checking
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF29252A),
                        ),
                      )
                    : Text(lit ? '正在进入' : '登录'),
              ),
              const SizedBox(height: 4),
              SizedBox(
                height: 2,
                child: _phase == _Phase.checking || lit
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(
                          value: lit ? 1 : null,
                          minHeight: 2,
                          color: const Color(0xFFFFE3A6),
                          backgroundColor: const Color(0x14FFE6B8),
                        ),
                      )
                    : null,
              ),
              AnimatedSize(
                duration: Duration(milliseconds: _reduced ? 1 : 300),
                curve: Curves.easeOut,
                child: _message == null
                    ? const SizedBox(width: double.infinity)
                    : Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(
                          _message!,
                          key: const Key('lamp-status'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: _messageIsError
                                ? _errorInk
                                : const Color(0xFFFFF2D0),
                            fontSize: 13,
                            height: 1.5,
                          ),
                        ),
                      ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    '还没有账号？',
                    style: TextStyle(color: _inkSoft, fontSize: 13),
                  ),
                  TextButton(
                    key: const Key('pocket-register-entry'),
                    style: TextButton.styleFrom(
                      foregroundColor: _ink,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      textStyle: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    onPressed: _busy || !_accountsAvailable
                        ? null
                        : widget.onRegister,
                    child: const Text('注册'),
                  ),
                ],
              ),
              TextButton(
                key: const Key('lamp-enter-guest'),
                style: TextButton.styleFrom(
                  foregroundColor: _warm,
                  textStyle: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                onPressed: _busy ? null : _guest,
                child: const Text('进入本机访客空间'),
              ),
              const SizedBox(height: 4),
              Text(
                _accountsAvailable
                    ? '访客数据只保存在这台设备 · 无账号验证或云端同步'
                    : '账号服务暂未开放 · 访客空间无账号验证或云端同步',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: _muted,
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _fieldDecoration({
    required String hint,
    required Widget suffix,
  }) {
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: color, width: width),
        );
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0x8AFFFFFF), fontSize: 15),
      filled: true,
      fillColor: const Color(0x3D14141E),
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      suffixIcon: suffix,
      suffixIconColor: WidgetStateColor.resolveWith(
        (states) => states.contains(WidgetState.focused)
            ? _warm
            : const Color(0xD9F4E8DD),
      ),
      enabledBorder: border(
        _errorLatched ? const Color(0x99FFB995) : const Color(0x5EEDE7E1),
      ),
      disabledBorder: border(const Color(0x33EDE7E1)),
      focusedBorder: border(const Color(0xE6FFDB98), 1.5),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      color: Color(0xFFF6E7D2),
      fontSize: 13,
      fontWeight: FontWeight.w500,
    ),
  );
}

/// Damped horizontal shake for a rejected sign-in, in logical pixels.
double _shakeOffset(double t) {
  if (t <= 0 || t >= 1) return 0;
  return math.sin(t * math.pi * 6) * 7 * (1 - t);
}

/// CSS `brightness(b) saturate(s)` as a colour matrix.
List<double> _wallMatrix(double b, double s) => [
  b * (0.213 + 0.787 * s),
  b * (0.715 - 0.715 * s),
  b * (0.072 - 0.072 * s),
  0,
  0,
  b * (0.213 - 0.213 * s),
  b * (0.715 + 0.285 * s),
  b * (0.072 - 0.072 * s),
  0,
  0,
  b * (0.213 - 0.213 * s),
  b * (0.715 - 0.715 * s),
  b * (0.072 + 0.928 * s),
  0,
  0,
  0,
  0,
  0,
  1,
  0,
];

/// Centres the panel on the photo's baked card, kept inside the safe area
/// and above the keyboard.
class _PanelPlacement extends SingleChildLayoutDelegate {
  const _PanelPlacement({
    required this.centerY,
    required this.top,
    required this.bottom,
  });

  final double centerY;
  final double top;
  final double bottom;

  @override
  BoxConstraints getConstraintsForChild(BoxConstraints constraints) =>
      constraints.loosen();

  @override
  Offset getPositionForChild(Size size, Size child) {
    final maxY = size.height - bottom - child.height;
    final y = (centerY - child.height / 2)
        .clamp(top, math.max(top, maxY))
        .toDouble();
    return Offset((size.width - child.width) / 2, y);
  }

  @override
  bool shouldRelayout(_PanelPlacement old) =>
      centerY != old.centerY || top != old.top || bottom != old.bottom;
}

/// Warm light from the wall lamp, added on top of the photo with a screen
/// blend: a pool on the bricks below the lamp, a soft haze and the bulb.
class _LampLightPainter extends CustomPainter {
  const _LampLightPainter({
    required this.lamp,
    required this.scale,
    required this.warmth,
    required this.bulb,
    required this.pulse,
  });

  final Offset lamp;
  final double scale;
  final double warmth;
  final double bulb;
  final double pulse;

  void _pool(
    Canvas canvas,
    Offset center,
    double radius,
    double stretch,
    List<Color> colors,
    List<double> stops,
  ) {
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(1, stretch);
    final rect = Rect.fromCircle(center: Offset.zero, radius: radius);
    canvas.drawRect(
      rect,
      Paint()
        ..blendMode = BlendMode.screen
        ..shader = ui.Gradient.radial(Offset.zero, radius, colors, stops),
    );
    canvas.restore();
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final w = warmth.clamp(0.0, 1.0);
    if (w > 0.001) {
      _pool(
        canvas,
        lamp + Offset(0, 170 * scale),
        430 * scale,
        1.25,
        [
          const Color(0xFFFFD38B).withValues(alpha: .34 * w),
          const Color(0xFFEE9E43).withValues(alpha: .15 * w),
          const Color(0x00EE9E43),
        ],
        const [0, .44, 1],
      );
      _pool(
        canvas,
        lamp + Offset(0, 70 * scale),
        340 * scale,
        1,
        [
          const Color(0xFFFFF4C9).withValues(alpha: .27 * w),
          const Color(0xFFF6B146).withValues(alpha: .17 * w),
          const Color(0x00F6B146),
        ],
        const [0, .48, 1],
      );
      _pool(
        canvas,
        lamp,
        640 * scale,
        .9,
        [
          const Color(0xFFFFCC6C).withValues(alpha: .20 * w),
          const Color(0xFFF8B75A).withValues(alpha: .07 * w),
          const Color(0x00F8B75A),
        ],
        const [0, .4, 1],
      );
    }
    final b = (bulb * (0.75 + 0.25 * pulse) + 0.2 * pulse).clamp(0.0, 1.0);
    if (b > 0.001) {
      canvas.drawOval(
        Rect.fromCenter(
          center: lamp + Offset(0, 4 * scale),
          width: 230 * scale,
          height: 30 * scale,
        ),
        Paint()
          ..blendMode = BlendMode.screen
          ..color = const Color(0xFFFFF5C4).withValues(alpha: .55 * b)
          ..maskFilter = ui.MaskFilter.blur(ui.BlurStyle.normal, 18 * scale),
      );
    }
  }

  @override
  bool shouldRepaint(_LampLightPainter old) =>
      old.lamp != lamp ||
      old.scale != scale ||
      old.warmth != warmth ||
      old.bulb != bulb ||
      old.pulse != pulse;
}
