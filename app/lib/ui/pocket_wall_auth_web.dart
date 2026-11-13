import 'dart:async';
import 'dart:html' as html;
import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';

import '../core/pocket_auth.dart';
import 'pocket_account_sheet.dart';

/// Reuses the original /lamp-preview/ wall-lamp login scene inside Flutter Web.
///
/// Only the visual/field document lives in the iframe. All credential checks,
/// email registration and resets are performed by the SAME PocketAuthController
/// as the native app, preserving verified Supabase sessions and RLS isolation.
/// No access/refresh tokens or passwords are placed in URLs or posted as messages.
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
  late final html.IFrameElement _frame;
  StreamSubscription<html.Event>? _loadSubscription;
  Timer? _timeout;
  Timer? _successTimer;
  bool _ready = false;
  bool _unavailable = false;
  bool _register = false;
  bool _busy = false;
  bool _finished = false;

  html.Document? get _document {
    try {
      final frameWindow = _frame.contentWindow;
      // The source is a fixed same-origin HAIZ document, not user-controlled.
      if (frameWindow == null ||
          frameWindow.location.origin != html.window.location.origin) {
        return null;
      }
      return frameWindow.document;
    } catch (_) {
      return null;
    }
  }

  html.Element? _element(String id) => _document?.getElementById(id);

  @override
  void initState() {
    super.initState();
    _register = widget.initiallyRegister;
    _viewType = 'haiz-original-wall-auth-${identityHashCode(this)}';
    _frame = html.IFrameElement()
      ..src = '/lamp-preview/'
      ..title = 'HAIZ Pocket 壁灯登录'
      ..style.width = '100%'
      ..style.height = '100%'
      ..style.border = '0'
      ..style.display = 'block';
    _loadSubscription = _frame.onLoad.listen((_) => _wireOriginalScene());
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
    final username = doc?.getElementById('username');
    final password = doc?.getElementById('password');
    final panel = doc?.getElementById('panel');
    if (doc == null || form == null || username is! html.InputElement ||
        password is! html.InputElement || panel == null) {
      setState(() => _unavailable = true);
      return;
    }
    _ready = true;
    _timeout?.cancel();

    // Keep all original CSS light phases, wall photography, glass panel and
    // focus-driven animations. Replace only the legacy /api/auth/login handler.
    username
      ..type = 'email'
      ..placeholder = '输入电子邮箱'
      ..autocomplete = 'email';
    doc.querySelector('label[for="username"]')?.text = '电子邮箱';
    doc.querySelector('.service-notice')?.remove();
    doc.querySelector('.remember')?.remove();
    final meta = doc.querySelector('.meta');
    if (meta is html.HtmlElement) meta.style.justifyContent = 'flex-end';

    final originalBottom = doc.querySelector('.bottom');
    originalBottom?.remove();
    final registerLine = html.ParagraphElement()..classes.add('bottom');
    registerLine.appendText('还没有账号？ ');
    final switchMode = html.ButtonElement()
      ..type = 'button'
      ..classes.add('reset');
    registerLine.append(switchMode);
    panel.append(registerLine);

    final guestLine = html.ParagraphElement()..classes.add('bottom');
    guestLine.appendText('暂不登录？ ');
    final guest = html.AnchorElement(href: '#guest')..text = '使用本机访客空间';
    guestLine.append(guest);
    panel.append(guestLine);

    final confirmationLabel = html.LabelElement()
      ..htmlFor = 'pocket-confirm-password'
      ..text = '确认密码'
      ..classes.add('field-label');
    final confirmationField = html.DivElement()..classes.add('field');
    final confirmation = html.InputElement(type: 'password')
      ..id = 'pocket-confirm-password'
      ..placeholder = '再次输入密码'
      ..autocomplete = 'new-password';
    confirmationField.append(confirmation);
    password.parent?.parent?.insertBefore(confirmationLabel, password.parent?.nextNode);
    confirmationLabel.parent?.insertBefore(confirmationField, confirmationLabel.nextNode);

    // HTML's old submit handler is attached in bubble phase; capture-phase
    // interception prevents accidental POST /api/auth/login and double submit.
    form.addEventListener('submit', (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      unawaited(_submit(username, password, confirmation));
    }, true);
    switchMode.onClick.listen((event) {
      event.preventDefault();
      if (_busy) return;
      _register = !_register;
      widget.auth.clearError();
      confirmation.value = '';
      _setStatus('');
      _renderMode(switchMode, confirmationLabel, confirmationField);
    });
    guest.onClick.listen((event) {
      event.preventDefault();
      if (_busy) return;
      _finishAsGuest();
    });
    doc.getElementById('forgot')?.addEventListener('click', (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!_busy) unawaited(_reset(username));
    }, true);

    final back = html.ButtonElement()
      ..type = 'button'
      ..text = '← 返回'
      ..classes.add('reset');
    back.style
      ..position = 'absolute'
      ..top = '16px'
      ..left = '18px'
      ..zIndex = '4';
    panel.append(back);
    back.onClick.listen((event) {
      event.preventDefault();
      if (!_busy) widget.onBack();
    });

    _renderMode(switchMode, confirmationLabel, confirmationField);
  }

  void _renderMode(html.ButtonElement switchMode,
      html.LabelElement label, html.DivElement field) {
    _element('login-title')?.text = _register ? '注册' : '登录';
    _element('submit-text')?.text = _register ? '创建账号' : '登 录';
    switchMode.text = _register ? '已有账号？返回登录' : '注册 HAIZ 账号';
    label.style.display = _register ? 'block' : 'none';
    field.style.display = _register ? 'flex' : 'none';
    final forgot = _element('forgot');
    if (forgot is html.HtmlElement) {
      forgot.style.visibility = _register ? 'hidden' : 'visible';
    }
    _setPhase('idle');
  }

  void _setPhase(String phase) {
    _element('scene')?.setAttribute('data-phase', phase);
  }

  void _setStatus(String message, {bool error = false}) {
    final status = _element('status');
    if (status == null) return;
    status.text = message;
    status.className = message.isEmpty
        ? 'status'
        : (error ? 'status visible error' : 'status visible');
  }

  void _setBusy(bool busy) {
    _busy = busy;
    final button = _element('submit');
    if (button is html.ButtonElement) button.disabled = busy;
    if (busy) {
      _setPhase('checking');
      _element('submit-text')?.text = '正在验证…';
    } else {
      _element('submit-text')?.text = _register ? '创建账号' : '登 录';
    }
  }

  void _error(String message) {
    _setPhase('error');
    _setStatus(message, error: true);
    final panel = _element('panel');
    panel?.classes.remove('shake');
    panel?.classes.add('shake');
  }

  Future<void> _submit(html.InputElement username,
      html.InputElement password, html.InputElement confirmation) async {
    if (_busy || _finished) return;
    final email = (username.value ?? '').trim();
    final secret = password.value ?? '';
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
    if (_register && confirmation.value != secret) {
      _error('两次输入的密码不一致。');
      confirmation.focus();
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
          confirmation.value = '';
          _setStatus('请检查验证邮件，完成邮箱验证后再登录。');
          _setPhase('ready');
        } else {
          _error(widget.auth.error ?? '注册暂未完成。');
        }
      } else {
        await widget.auth.signIn(email, secret);
        if (!mounted) return;
        if (widget.auth.authenticated) {
          _finished = true;
          _setPhase('success');
          _element('scene')?.classes.add('success');
          _setStatus('验证成功，正在进入 HAIZ Pocket。');
          _element('submit-text')?.text = '验证成功';
          final reduceMotion = html.window.matchMedia(
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

  Future<void> _reset(html.InputElement username) async {
    final email = (username.value ?? '').trim();
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
    _element('scene')?.classes.add('success');
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
    _loadSubscription?.cancel();
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
