import 'package:flutter/material.dart';

import '../core/pocket_auth.dart';

/// Native credential entry. Passwords are sent only by Supabase Auth over
/// HTTPS, never through the marketing WebView or JavaScript channels.
class PocketAccountSheet extends StatefulWidget {
  const PocketAccountSheet({
    super.key,
    required this.auth,
    required this.onSuccess,
  });
  final PocketAuthController auth;
  final VoidCallback onSuccess;

  @override
  State<PocketAccountSheet> createState() => _PocketAccountSheetState();
}

class _PocketAccountSheetState extends State<PocketAccountSheet> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _showPassword = false;
  bool _register = false;
  String? _status;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (widget.auth.busy || !_form.currentState!.validate()) return;
    setState(() => _status = null);
    if (_register) {
      final ok = await widget.auth.signUp(_email.text, _password.text);
      if (mounted && ok) {
        setState(() {
          _status = '注册请求已提交。请前往邮箱完成验证，再返回登录。';
          _register = false;
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
    if (_email.text.trim().isEmpty) {
      setState(() => _status = '先输入账号邮箱，再发送重置邮件。');
      return;
    }
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
                  _register ? '创建 HAIZ 账号' : '登录 HAIZ 账号',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 10),
                Text(
                  '你的个人课表、待办与专注记录由账号独立保存。'
                  '访客记录不会未经确认就合并。',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 20),
                if (!widget.auth.configured) ...[
                  const Text(
                    '账号服务尚未配置。当前仍可使用本机访客空间，'
                    '管理员部署身份服务后即可开放登录。',
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
                    labelText: '邮箱',
                    prefixIcon: Icon(Icons.mail_outline_rounded),
                  ),
                  validator: (value) => value == null ||
                          !value.contains('@') ||
                          value.trim().length < 5
                      ? '请输入有效邮箱' : null,
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
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _submit(),
                  enabled: widget.auth.configured && !widget.auth.busy,
                  decoration: InputDecoration(
                    labelText: '密码',
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
                const SizedBox(height: 15),
                if (_status != null) Text(_status!),
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
                        : Text(_register ? '注册并验证邮箱' : '安全登录'),
                  ),
                ),
                const SizedBox(height: 6),
                if (widget.auth.configured)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton(
                        onPressed: widget.auth.busy ? null : () {
                          setState(() {
                            _register = !_register;
                            _status = null;
                          });
                        },
                        child: Text(_register ? '已有账号，返回登录' : '创建账号'),
                      ),
                      TextButton(
                        onPressed: widget.auth.busy ? null : _reset,
                        child: const Text('忘记密码'),
                      ),
                    ],
                  ),
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('返回本机空间'),
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
  VoidCallback onSuccess,
) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (ctx) => PocketAccountSheet(
    auth: auth,
    onSuccess: onSuccess,
  ),
);
