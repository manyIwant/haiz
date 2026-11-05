import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'glass.dart';
import 'reduce_transparency_stub.dart'
    if (dart.library.js_interop) 'reduce_transparency_web.dart' as system;

/// Device preference for glass: "auto" (optical where supported) or "solid"
/// (opaque surfaces). Device-level, not personal data: it describes this
/// screen and its owner's accessibility needs, not any account.
abstract final class GlassPreference {
  static const key = 'haiz/glass/v1';
  static final ValueNotifier<String> value = ValueNotifier('auto');

  static Future<void> load() async {
    try {
      final saved = await SharedPreferencesAsync().getString(key);
      if (saved == 'auto' || saved == 'solid') value.value = saved!;
    } catch (_) {
      // Unreadable preference: keep the default.
    }
  }

  static Future<void> set(String v) async {
    if (v != 'auto' && v != 'solid') return;
    value.value = v;
    try {
      await SharedPreferencesAsync().setString(key, v);
    } catch (_) {}
  }

  /// Opaque whenever the person asked for it: in HAIZ, the system's high
  /// contrast setting, or (web) `prefers-reduced-transparency`.
  static GlassMode resolve(BuildContext context, String pref) {
    if (pref == 'solid') return GlassMode.solid;
    if (MediaQuery.highContrastOf(context)) return GlassMode.solid;
    if (kIsWeb && system.prefersReducedTransparency()) return GlassMode.solid;
    return GlassMode.optical;
  }
}
