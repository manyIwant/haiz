/// Account scope is accepted only from an authenticated identity response.
String normalizeAcademicOrigin(String value) {
  final uri = Uri.tryParse(value.trim());
  if (uri == null ||
      !uri.hasAuthority ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      (uri.path.isNotEmpty && uri.path != '/')) {
    throw const FormatException('请输入纯服务器地址，不要附带路径或账号信息。');
  }
  final host = uri.host.toLowerCase();
  final loopback = const [
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ].contains(host);
  if (uri.scheme != 'https' && !(uri.scheme == 'http' && loopback)) {
    throw const FormatException('远程教务服务必须使用 HTTPS。本机开发可使用 localhost。');
  }
  return uri.origin.toLowerCase();
}

String _identityPart(dynamic value) {
  if (value is! String ||
      value.isEmpty ||
      value.length > 200 ||
      value.trim() != value ||
      RegExp(r'[\x00-\x20/\\]').hasMatch(value)) {
    throw const FormatException('服务器身份字段无效，未打开个人数据。');
  }
  return value;
}

Map<String, dynamic> validateAcademicIdentity(Map<String, dynamic> data) {
  final instance = _identityPart(data['instanceId']);
  final user = _identityPart(data['userId']);
  final classes = data['authorizedClassIds'];
  if (data['role'] != 'student' ||
      data['cacheScope'] != 'haiz/v1/$instance/$user' ||
      classes is! List ||
      classes.any((item) => item is! String)) {
    throw const FormatException('服务器身份契约无效，或当前账号不是学生账号。');
  }
  final checked = classes.map(_identityPart).toList(growable: false);
  if (checked.toSet().length != checked.length) {
    throw const FormatException('服务器返回了重复的班级身份。');
  }
  return Map<String, dynamic>.unmodifiable({
    'instanceId': instance,
    'userId': user,
    'role': 'student',
    'authorizedClassIds': List<String>.unmodifiable(checked),
    'cacheScope': data['cacheScope'],
  });
}

String accountNamespace(String origin, Map<String, dynamic> identity) {
  final data = validateAcademicIdentity(identity);
  final parts = [
    normalizeAcademicOrigin(origin),
    data['instanceId'] as String,
    data['userId'] as String,
  ].map(Uri.encodeComponent);
  return 'haiz/v1/${parts.join('/')}';
}
