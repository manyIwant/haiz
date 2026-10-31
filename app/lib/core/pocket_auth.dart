import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'pocket_store.dart';

/// Only a public/publishable key belongs in a mobile or web binary.
/// Never embed a service_role or secret key in dart-defines.
class PocketAuthConfig {
  static const url = String.fromEnvironment('HAIZ_SUPABASE_URL');
  static const publishableKey =
      String.fromEnvironment('HAIZ_SUPABASE_PUBLISHABLE_KEY');

  static bool get configured =>
      Uri.tryParse(url)?.scheme == 'https' &&
      Uri.tryParse(url)?.host.isNotEmpty == true &&
      publishableKey.isNotEmpty;
}

/// Keychain on iOS, Android Keystore-backed encrypted storage on Android.
/// Web deliberately has no persistent session in this iteration: an XSS
/// vulnerability in a browser origin must not gain a long-lived refresh token.
class _PrivateAuthStorage extends LocalStorage {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  @override
  Future<void> initialize() async {}

  @override
  Future<String?> accessToken() =>
      _storage.read(key: supabasePersistSessionKey);

  @override
  Future<bool> hasAccessToken() =>
      _storage.containsKey(key: supabasePersistSessionKey);

  @override
  Future<void> persistSession(String value) =>
      _storage.write(key: supabasePersistSessionKey, value: value);

  @override
  Future<void> removePersistedSession() =>
      _storage.delete(key: supabasePersistSessionKey);
}

/// Initializes the remote provider only when explicitly configured.
Future<SupabaseClient?> initializePocketAuth() async {
  if (!PocketAuthConfig.configured) return null;
  await Supabase.initialize(
    url: PocketAuthConfig.url,
    publishableKey: PocketAuthConfig.publishableKey,
    authOptions: FlutterAuthClientOptions(
      localStorage:
          kIsWeb ? const EmptyLocalStorage() : _PrivateAuthStorage(),
    ),
  );
  return Supabase.instance.client;
}

/// One authenticated user owns one cloud snapshot. The server enforces RLS;
/// a second device cannot silently overwrite a newer revision.
class PocketCloudSnapshot {
  PocketCloudSnapshot(this.client, this.userId);
  final SupabaseClient client;
  final String userId;
  int _version = 0;

  void _requireSession() {
    final session = client.auth.currentSession;
    if (session == null || session.user.id != userId ||
        session.isExpired) {
      throw StateError('身份会话无效，个人数据保持锁定');
    }
  }

  Future<String?> read() async {
    _requireSession();
    final row = await client
        .from('pocket_snapshots')
        .select('data, version')
        .eq('user_id', userId)
        .maybeSingle();
    _requireSession();
    if (row == null) {
      _version = 0;
      return null;
    }
    final version = row['version'];
    final data = row['data'];
    if (version is! int || version < 1 ||
        data is! Map<String, dynamic>) {
      throw const FormatException('云端个人记录格式无效');
    }
    _version = version;
    return jsonEncode(data);
  }

  Future<void> write(String json) async {
    _requireSession();
    final data = jsonDecode(json);
    if (data is! Map<String, dynamic>) {
      throw const FormatException('个人记录格式无效');
    }
    if (_version == 0) {
      // Simultaneous new devices: the DB primary key rejects the loser
      // rather than overwriting its first write.
      await client.from('pocket_snapshots').insert({
        'user_id': userId,
        'data': data,
        'version': 1,
      });
      _version = 1;
    } else {
      final result = await client.from('pocket_snapshots')
          .update({'data': data, 'version': _version + 1})
          .eq('user_id', userId)
          .eq('version', _version)
          .select('version')
          .maybeSingle();
      if (result == null || result['version'] != _version + 1) {
        throw StateError('另一台设备已更新记录，本次写入已停止，未覆盖云端数据');
      }
      _version += 1;
    }
    _requireSession();
  }
}

/// No account data is presented before a network-backed identity check.
/// All changes of principal synchronously lock the old namespace.
class PocketAuthController extends ChangeNotifier {
  PocketAuthController(this.store, this.client);

  final PocketStore store;
  final SupabaseClient? client;
  StreamSubscription<AuthState>? _subscription;
  int _epoch = 0;
  bool _disposed = false;
  bool loading = true;
  bool busy = false;
  String? userId;
  String? userEmail;
  String? error;

  bool get configured => client != null;
  bool get authenticated => userId != null && store.isCloudAccount &&
      store.namespace == 'haiz/cloud/v1/$userId' &&
      store.storageError == null;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> start() async {
    final ticket = ++_epoch;
    try {
      await store.openGuest();
      if (client == null || ticket != _epoch) return;
      _subscription = client!.auth.onAuthStateChange.listen((event) {
        if (event.event == AuthChangeEvent.signedOut) {
          _lockToGuest('会话已结束，请重新登录。');
        } else if (event.event == AuthChangeEvent.tokenRefreshed &&
            userId != null &&
            event.session?.user.id != userId) {
          _lockToGuest('账号会话已变化，请重新登录。');
        }
      }, onError: (Object _) {
        // Refresh/network failures are never treated as a verified session.
        _lockToGuest('会话续期失败，已锁定账号数据。');
      });
      if (client!.auth.currentSession != null) {
        await _verifyAndOpen(ticket);
      }
    } catch (_) {
      if (ticket == _epoch) {
        error = '登录状态恢复失败，个人数据已锁定。';
        store.lock();
        await store.openGuest();
      }
    } finally {
      if (ticket == _epoch) {
        loading = false;
        _notify();
      }
    }
  }

  Future<void> _verifyAndOpen(int ticket) async {
    final auth = client!.auth;
    final response = await auth.getUser(); // Server-authoritative check.
    final current = auth.currentSession;
    final user = response.user;
    if (ticket != _epoch || user == null || current == null ||
        current.user.id != user.id || current.isExpired) {
      throw StateError('身份验证未通过');
    }
    final cloud = PocketCloudSnapshot(client!, user.id);
    await store.openCloudAccount(
      userId: user.id,
      read: cloud.read,
      write: cloud.write,
    );
    if (ticket != _epoch) return;
    if (!store.isCloudAccount || store.storageError != null) {
      throw StateError('个人数据未能安全加载');
    }
    userId = user.id;
    userEmail = user.email;
    error = null;
    _notify();
  }

  Future<void> signIn(String email, String password) async {
    if (client == null || busy) return;
    final ticket = ++_epoch;
    busy = true;
    error = null;
    userId = null;
    userEmail = null;
    store.lock(); // Prevents old-account frames during network awaits.
    _notify();
    try {
      await client!.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );
      if (ticket == _epoch) await _verifyAndOpen(ticket);
    } catch (_) {
      if (ticket == _epoch) {
        error = '登录失败。请确认邮箱、密码及网络，或联系管理员。';
        // A successful password exchange followed by a failed data read
        // must not leave a partially authenticated session.
        try { await client!.auth.signOut(); } catch (_) {}
        if (ticket == _epoch) await store.openGuest();
      }
    } finally {
      if (ticket == _epoch) {
        busy = false;
        loading = false;
        _notify();
      }
    }
  }

  Future<bool> signUp(String email, String password) async {
    if (client == null || busy) return false;
    busy = true;
    error = null;
    _notify();
    try {
      final result = await client!.auth.signUp(
        email: email.trim(),
        password: password,
      );
      // Email confirmation is required in the deployed Auth provider.
      if (result.session != null) {
        await client!.auth.signOut();
      }
      return true;
    } catch (_) {
      error = '注册未完成，请检查邮箱、密码或稍后重试。';
      return false;
    } finally {
      busy = false;
      _notify();
    }
  }

  Future<void> sendReset(String email) async {
    if (client == null || busy) return;
    busy = true;
    error = null;
    _notify();
    try {
      await client!.auth.resetPasswordForEmail(email.trim());
    } catch (_) {
      error = '暂时无法提交重置邮件，请稍后再试。';
    } finally {
      busy = false;
      _notify();
    }
  }

  void _lockToGuest(String message) {
    if (_disposed) return;
    _epoch++;
    userId = null;
    userEmail = null;
    error = message;
    busy = false;
    store.lock();
    _notify();
    unawaited(store.openGuest());
  }

  Future<void> signOut() async {
    if (busy) return;
    ++_epoch;
    userId = null;
    userEmail = null;
    store.lock();
    _notify();
    try {
      await client?.auth.signOut();
    } catch (_) {
      error = '本机个人数据已锁定；服务器注销未确认，请检查网络。';
    } finally {
      await store.openGuest();
      _notify();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    _subscription?.cancel();
    super.dispose();
  }
}
