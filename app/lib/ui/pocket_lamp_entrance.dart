import 'package:flutter/material.dart';

import '../core/pocket_auth.dart';
import 'lamp_entry.dart';

/// Entrance shown before the workspace on every platform.
///
/// Earlier builds loaded haiz.space/lamp-preview/ in a WebView on Android
/// and iOS, so the APK and the web build showed different sign-in screens
/// and the WebView's password form could not sign in. The brick-wall lamp
/// now runs natively in [LampEntry] everywhere, offline included.
class PocketLampEntrance extends StatelessWidget {
  const PocketLampEntrance({
    super.key,
    required this.onEnter,
    this.auth,
    this.onRegister,
    this.onHold,
  });

  final VoidCallback onEnter;
  final PocketAuthController? auth;
  final VoidCallback? onRegister;
  final ValueChanged<bool>? onHold;

  @override
  Widget build(BuildContext context) => LampEntry(
    onEnter: onEnter,
    auth: auth,
    onRegister: onRegister,
    onHold: onHold,
  );
}
