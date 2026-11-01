import 'package:flutter/material.dart';

import '../core/pocket_auth.dart';

/// Native credential entry. Passwords are sent only by Supabase Auth over
/// HTTPS, never through the marketing WebView or JavaScript channels.
class PocketAccountSheet extends StatefulWidget {
  const PocketAccountSheet({
    super.key,
    required this.auth,
    required this.onSuccess,
    this.initiallyRegister = false,
  });
  final PocketAuthController auth;
  final VoidCallback onSuccess;
  final bool initiallyRegister;

  @override
  State<PocketAccountSheet> createState() => _PocketAccountSheetState();
}

class _PocketAccountSheetState extends State<PocketAccountSheet> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();
  bool _showPassword = false;
  late bool _register;
  String? _status;

  @override
  void initState() {
    super.initState();
    _register = widget.initiallyRegister;
  }

  void _changeMode(bool register) {
    if (widget.auth.busy || _register == register) return;
    widget.auth.clearError();
    _password.clear();
    _confirmPassword.clear();
    setState(() {
      _register = register;
      _showPassword = false;
      _status = null;
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!widget.auth.configured || widget.auth.busy ||
        !(_form.currentState?.validate() ?? false)) return;
    setState(() => _status = null);
    if (_register) {
      final ok = await widget.auth.signUp(_email.text, _password.text);
      if (mounted && ok) {
        _password.clear();
        _confirmPassword.clear();
        setState(() {
          _status = '注册请求已提交。请查收验证邮件（包括垃圾邮件），'
              '验证邮箱后再使用密码登录。';
          _register = false;
          _showPassword = false;
        });
      }
    } else {
      await widget.auth.signIn(_email.text, _password.text);
      if (mounted && widget.auth.authenticated) {
        Navigator.of(context).pop();
        widget.onSuccess();
      }
    }
  }

  Future<void> _reset() async {
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
        .hasMatch(_email.text.trim())) {
      setState(() => _status = '请先输入有效的账号邮箱。');
      return;
    }
    widget.auth.clearError();
    await widget.auth.sendReset(_email.text);
    if (mounted && widget.auth.error == null) {
      setState(() => _status = '如果邮箱已注册，系统会发送密码重置说明。');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.auth,
      builder: (context, _) => SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            24, 22, 24,
            MediaQuery.of(context).viewInsets.bottom + 28,
          ),
          child: Form(
            key: _form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  _register ? '创建 HAIZ 账号' : '欢迎回来',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 10),
                Text(
                  _register
                      ? '用邮箱创建账号，完成邮箱验证后即可登录云端空间。'
                      : '登录后可同步个人课表、待办与专注记录。',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 18),
                SegmentedButton<bool>(
                  key: const Key('auth-mode-switch'),
                  segments: const [
                    ButtonSegment<bool>(value: false, label: Text('登录')),
                    ButtonSegment<bool>(value: true, label: Text('注册')),
                  ],
                  selected: {_register},
                  showSelectedIcon: false,
                  onSelectionChanged: widget.auth.busy
                      ? null : (values) => _changeMode(values.first),
                ),
                const SizedBox(height: 20),
                if (!widget.auth.configured) ...[
                  const Text(
                    '账号服务暂时不可用，你仍可免登录使用本机空间。',
                    key: Key('auth-not-configured'),
                  ),
                  const SizedBox(height: 14),
                ],
                TextFormField(
                  key: const Key('account-email'),
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  textInputAction: TextInputAction.next,
                  enabled: widget.auth.configured && !widget.auth.busy,
                  decoration: const InputDecoration(
                    labelText: '电子邮箱',
                    prefixIcon: Icon(Icons.mail_outline_rounded),
                  ),
                  validator: (value) => !RegExp(
                    r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                  ).hasMatch(value?.trim() ?? '') ? '请输入有效邮箱' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: const Key('account-password'),
                  controller: _password,
                  obscureText: !_showPassword,
                  keyboardType: TextInputType.visiblePassword,
                  autofillHints: [
                    _register ? AutofillHints.newPassword
                        : AutofillHints.password
                  ],
                  textInputAction: _register
                      ? TextInputAction.next : TextInputAction.done,
                  onFieldSubmitted: _register ? null : (_) => _submit(),
                  enabled: widget.auth.configured && !widget.auth.busy,
                  decoration: InputDecoration(
                    labelText: _register ? '设置密码（至少 8 位）' : '密码',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    suffixIcon: IconButton(
                      onPressed: () => setState(
                        () => _showPassword = !_showPassword,
                      ),
                      tooltip: _showPassword ? '隐藏密码' : '显示密码',
                      icon: Icon(
                        _showPassword ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                    ),
                  ),
                  validator: (value) => value == null || value.isEmpty
                      ? '请输入密码'
                      : _register && value.length < 8
                          ? '请设置至少 8 位密码'
                          : null,
                ),
                if (_register) ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    key: const Key('account-confirm-password'),
                    controller: _confirmPassword,
                    obscureText: !_showPassword,
                    autofillHints: const [AutofillHints.newPassword],
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _submit(),
                    enabled: widget.auth.configured && !widget.auth.busy,
                    decoration: const InputDecoration(
                      labelText: '确认密码',
                      prefixIcon: Icon(Icons.verified_user_outlined),
                    ),
                    validator: (value) => value != _password.text
                        ? '两次输入的密码不一致' : null,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '注册后需要验证邮箱。访客数据不会自动合并到账号中。',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                const SizedBox(height: 15),
                if (_status != null)
                  Text(_status!, key: const Key('account-status')),
                if (widget.auth.error != null)
                  Text(
                    widget.auth.error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                const SizedBox(height: 12),
                FilledButton(
                  key: const Key('account-submit'),
                  onPressed: widget.auth.configured && !widget.auth.busy
                      ? _submit : null,
                  child: Padding(
                    padding: const EdgeInsets.all(13),
                    child: widget.auth.busy
                        ? const SizedBox(
                            width: 19, height: 19,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(_register
                            ? '创建账号并发送验证邮件' : '登录 HAIZ'),
                  ),
                ),
                const SizedBox(height: 6),
                if (!_register && widget.auth.configured)
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      key: const Key('auth-forgot-password'),
                      onPressed: widget.auth.busy ? null : _reset,
                      child: const Text('忘记密码？'),
                    ),
                  ),
                const SizedBox(height: 10),
                OutlinedButton(
                  key: const Key('auth-continue-guest'),
                  onPressed: widget.auth.busy
                      ? null : () => Navigator.of(context).pop(),
                  child: const Text('暂不登录，使用本机空间'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

Future<void> showPocketAccountSheet(
  BuildContext context,
  PocketAuthController auth,
  VoidCallback onSuccess, {
  bool initiallyRegister = false,
}) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  constraints: const BoxConstraints(maxWidth: 540),
  builder: (ctx) => PocketAccountSheet(
    auth: auth,
    onSuccess: onSuccess,
    initiallyRegister: initiallyRegister,
  ),
);
