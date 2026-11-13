import 'dart:async';
import 'dart:js_interop';
import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

import '../core/pocket_auth.dart';
import 'pocket_account_sheet.dart';

/// The existing /lamp-preview/ page is the actual wall-and-light UI used by
/// Flutter on mobile. Flutter Web embeds that unmodified same-origin scene.
///
/// The old page only owns presentation; its legacy /api/auth/login handler is
/// intercepted before execution. The existing PocketAuthController exclusively
/// owns Supabase sign-in, sign-up, password reset and verified data namespaces.
/// Credentials never travel through URLs, postMessage, or browser storage here.
Widget buildPocketWallAuth({
  required PocketAuthController auth,
  required VoidCallback onSuccess,
  required VoidCallback onContinueGuest,
  required VoidCallback onBack,
  bool initiallyRegister = false,
}) => _OriginalWallAccount(
  auth: auth,
  onSuccess: onSuccess,
  onContinueGuest: onContinueGuest,
  onBack: onBack,
  initiallyRegister: initiallyRegister,
);

class _OriginalWallAccount extends StatefulWidget {
  const _OriginalWallAccount({
    required this.auth,
    required this.onSuccess,
    required this.onContinueGuest,
    required this.onBack,
    required this.initiallyRegister,
  });

  final PocketAuthController auth;
  final VoidCallback onSuccess;
  final VoidCallback onContinueGuest;
  final VoidCallback onBack;
  final bool initiallyRegister;

  @override
  State<_OriginalWallAccount> createState() => _OriginalWallAccountState();
}

class _OriginalWallAccountState extends State<_OriginalWallAccount> {
  late final String _viewType;
  late final web.HTMLIFrameElement _frame;
  JSFunction? _onLoad;
  Timer? _timeout;
  Timer? _successTimer;
  bool _ready = false;
  bool _unavailable = false;
  bool _register = false;
  bool _busy = false;
  bool _finished = false;

  web.Document? get _document {
    try {
      // contentDocument is null for cross-origin iframes. This app only
      // accepts the hardcoded same-origin /lamp-preview/ HTML document.
      return _frame.contentDocument;
    } catch (_) {
      return null;
    }
  }

  web.Element? _element(String id) => _document?.getElementById(id);

  @override
  void initState() {
    super.initState();
    _register = widget.initiallyRegister;
    _viewType = 'haiz-original-wall-auth-${identityHashCode(this)}';
    _frame = web.document.createElement('iframe') as web.HTMLIFrameElement;
    _frame
      ..src = '/lamp-preview/'
      ..title = 'HAIZ Pocket 壁灯登录';
    _frame.style
      ..width = '100%'
      ..height = '100%'
      ..border = '0'
      ..display = 'block';
    _onLoad = ((web.Event event) => _wireOriginalScene()).toJS;
    _frame.addEventListener('load', _onLoad);
    ui_web.platformViewRegistry.registerViewFactory(
      _viewType, (int viewId) => _frame,
    );
    _timeout = Timer(const Duration(seconds: 12), () {
      if (mounted && !_ready) setState(() => _unavailable = true);
    });
  }

  void _wireOriginalScene() {
    if (_ready || !mounted) return;
    final doc = _document;
    final form = doc?.getElementById('login-form');
    final usernameElement = doc?.getElementById('username');
    final passwordElement = doc?.getElementById('password');
    final panel = doc?.getElementById('panel');
    if (doc == null || form == null || usernameElement == null ||
        passwordElement == null || panel == null) {
      setState(() => _unavailable = true);
      return;
    }
    _ready = true;
    _timeout?.cancel();
    final username = usernameElement as web.HTMLInputElement;
    final password = passwordElement as web.HTMLInputElement;

    // Reuse every existing wall light phase, CSS transition, brick photo,
    // frosted glass card and original focus/input-driven lamp animation.
    username
      ..type = 'email'
      ..placeholder = '输入电子邮箱'
      ..autocomplete = 'email';
    doc.querySelector('label[for="username"]')?.textContent = '电子邮箱';
    doc.querySelector('.service-notice')?.remove();
    doc.querySelector('.remember')?.remove();
    final meta = doc.querySelector('.meta');
    if (meta != null) (meta as web.HTMLElement).style.justifyContent = 'flex-end';

    doc.querySelector('.bottom')?.remove();
    final modeLine = doc.createElement('p') as web.HTMLParagraphElement;
    modeLine
      ..className = 'bottom'
      ..textContent = '还没有账号？ ';
    final modeButton = doc.createElement('button') as web.HTMLButtonElement;
    modeButton
      ..type = 'button'
      ..className = 'reset';
    modeLine.appendChild(modeButton);
    panel.appendChild(modeLine);

    final guestLine = doc.createElement('p') as web.HTMLParagraphElement;
    guestLine
      ..className = 'bottom'
      ..textContent = '暂不登录？ ';
    final guestLink = doc.createElement('a') as web.HTMLAnchorElement;
    guestLink
      ..href = '#guest'
      ..textContent = '使用本机访客空间';
    guestLine.appendChild(guestLink);
    panel.appendChild(guestLine);

    final confirmLabel = doc.createElement('label') as web.HTMLLabelElement;
    confirmLabel
      ..htmlFor = 'pocket-confirm-password'
      ..textContent = '确认密码'
      ..className = 'field-label';
    final confirmField = doc.createElement('div') as web.HTMLDivElement;
    confirmField.className = 'field';
    final confirm = doc.createElement('input') as web.HTMLInputElement;
    confirm
      ..id = 'pocket-confirm-password'
      ..type = 'password'
      ..placeholder = '再次输入密码'
      ..autocomplete = 'new-password';
    confirmField.appendChild(confirm);
    final passRow = password.parentElement;
    final passParent = passRow?.parentNode;
    passParent?.insertBefore(confirmLabel, passRow?.nextSibling);
    passParent?.insertBefore(confirmField, confirmLabel.nextSibling);

    // The original HTML attaches its submit handler in bubble phase.
    // A capture-phase listener stops the obsolete /api/auth/login call.
    form.addEventListener('submit', ((web.Event event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      unawaited(_submit(username, password, confirm));
    }).toJS, true.toJS);
    modeButton.addEventListener('click', ((web.Event event) {
      event.preventDefault();
      if (_busy) return;
      _register = !_register;
      widget.auth.clearError();
      confirm.value = '';
      _setStatus('');
      _renderMode(modeButton, confirmLabel, confirmField);
    }).toJS);
    guestLink.addEventListener('click', ((web.Event event) {
      event.preventDefault();
      if (!_busy) _finishAsGuest();
    }).toJS);
    doc.getElementById('forgot')?.addEventListener(
      'click', ((web.Event event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!_busy) unawaited(_reset(username));
      }).toJS, true.toJS,
    );
    final back = doc.createElement('button') as web.HTMLButtonElement;
    back
      ..type = 'button'
      ..textContent = '← 返回'
      ..className = 'reset';
    back.style
      ..position = 'absolute'
      ..top = '16px'
      ..left = '18px'
      ..zIndex = '4';
    panel.appendChild(back);
    back.addEventListener('click', ((web.Event event) {
      event.preventDefault();
      if (!_busy) widget.onBack();
    }).toJS);
    _renderMode(modeButton, confirmLabel, confirmField);
  }

  void _renderMode(web.HTMLButtonElement modeButton,
      web.HTMLLabelElement label, web.HTMLDivElement field) {
    _element('login-title')?.textContent = _register ? '注册' : '登录';
    _element('submit-text')?.textContent = _register ? '创建账号' : '登 录';
    modeButton.textContent = _register ? '已有账号？返回登录' : '注册 HAIZ 账号';
    label.style.display = _register ? 'block' : 'none';
    field.style.display = _register ? 'flex' : 'none';
    final forgot = _element('forgot');
    if (forgot != null) {
      (forgot as web.HTMLElement).style.visibility =
          _register ? 'hidden' : 'visible';
    }
    _setPhase('idle');
  }

  void _setPhase(String value) {
    _element('scene')?.setAttribute('data-phase', value);
  }

  void _setStatus(String content, {bool error = false}) {
    final status = _element('status');
    if (status == null) return;
    status.textContent = content;
    status.className = content.isEmpty
        ? 'status'
        : (error ? 'status visible error' : 'status visible');
  }

  void _setBusy(bool busy) {
    _busy = busy;
    final button = _element('submit');
    if (button != null) (button as web.HTMLButtonElement).disabled = busy;
    if (busy) {
      _setPhase('checking');
      _element('submit-text')?.textContent = '正在验证…';
    } else {
      _element('submit-text')?.textContent = _register ? '创建账号' : '登 录';
    }
  }

  void _error(String content) {
    _setPhase('error');
    _setStatus(content, error: true);
    final panel = _element('panel');
    panel?.classList.remove('shake');
    panel?.classList.add('shake');
  }

  Future<void> _submit(web.HTMLInputElement username,
      web.HTMLInputElement password, web.HTMLInputElement confirm) async {
    if (_busy || _finished) return;
    final email = username.value.trim();
    final secret = password.value;
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      _error('请输入有效的电子邮箱。');
      username.focus();
      return;
    }
    if (secret.isEmpty || (_register && secret.length < 8)) {
      _error(_register ? '密码至少需要 8 位。' : '请输入密码。');
      password.focus();
      return;
    }
    if (_register && confirm.value != secret) {
      _error('两次输入的密码不一致。');
      confirm.focus();
      return;
    }
    if (!widget.auth.configured) {
      _error('账号服务暂时不可用，仍可进入本机空间。');
      return;
    }
    _setBusy(true);
    _setStatus(_register ? '正在提交注册…' : '正在安全验证身份…');
    try {
      if (_register) {
        final ok = await widget.auth.signUp(email, secret);
        if (!mounted) return;
        if (ok) {
          password.value = '';
          confirm.value = '';
          _setPhase('ready');
          _setStatus('请检查验证邮件，完成邮箱验证后再登录。');
        } else {
          _error(widget.auth.error ?? '注册暂未完成。');
        }
      } else {
        await widget.auth.signIn(email, secret);
        if (!mounted) return;
        if (widget.auth.authenticated) {
          _finished = true;
          _setPhase('success');
          _element('scene')?.classList.add('success');
          _setStatus('验证成功，正在进入 HAIZ Pocket。');
          _element('submit-text')?.textContent = '验证成功';
          final reduceMotion = web.window.matchMedia(
            '(prefers-reduced-motion: reduce)',
          ).matches;
          _successTimer = Timer(
            Duration(milliseconds: reduceMotion ? 100 : 760),
            () { if (mounted) widget.onSuccess(); },
          );
          return;
        }
        _error(widget.auth.error ?? '请确认邮箱、密码或网络。');
      }
    } catch (_) {
      if (mounted) _error('认证暂时不可用，请稍后重试。');
    } finally {
      if (!_finished && mounted) _setBusy(false);
    }
  }

  Future<void> _reset(web.HTMLInputElement username) async {
    final email = username.value.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      _error('请先输入有效的账号邮箱。');
      username.focus();
      return;
    }
    if (!widget.auth.configured) {
      _error('账号服务暂时不可用。');
      return;
    }
    _setBusy(true);
    _setStatus('正在发送密码重置邮件…');
    try {
      await widget.auth.sendReset(email);
      if (!mounted) return;
      if (widget.auth.error == null) {
        _setPhase('ready');
        _setStatus('如邮箱已注册，系统将发送密码重置说明。');
      } else {
        _error(widget.auth.error!);
      }
    } finally {
      if (mounted) _setBusy(false);
    }
  }

  void _finishAsGuest() {
    _finished = true;
    _setPhase('success');
    _element('scene')?.classList.add('success');
    _setStatus('正在进入本机空间…');
    _successTimer = Timer(
      const Duration(milliseconds: 450),
      () { if (mounted) widget.onContinueGuest(); },
    );
  }

  @override
  void dispose() {
    _successTimer?.cancel();
    _timeout?.cancel();
    if (_onLoad != null) _frame.removeEventListener('load', _onLoad);
    _frame.remove();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_unavailable) {
      return PocketAccountPage(
        auth: widget.auth,
        onSuccess: widget.onSuccess,
        onContinueGuest: widget.onContinueGuest,
        onBack: widget.onBack,
        initiallyRegister: widget.initiallyRegister,
      );
    }
    return Scaffold(
      key: const Key('pocket-original-wall-login'),
      backgroundColor: const Color(0xFF06152D),
      body: HtmlElementView(viewType: _viewType),
    );
  }
}
