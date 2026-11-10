import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_auth.dart';

void main() {
  test('HAIZ default cloud connection uses only the public project endpoint', () {
    expect(PocketAuthConfig.url,
        'https://zifcxtjwzbjabcjpqhgp.supabase.co');
    expect(PocketAuthConfig.publishableKey, startsWith('sb_publishable_'));
    expect(PocketAuthConfig.configured, isTrue);
  });
}
