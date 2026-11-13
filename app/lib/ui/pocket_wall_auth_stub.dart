import 'package:flutter/material.dart';
import '../core/pocket_auth.dart';
import 'pocket_account_sheet.dart';

/// Native/offline fallback uses the existing secure Flutter account form.
Widget buildPocketWallAuth({
  required PocketAuthController auth,
  required VoidCallback onSuccess,
  required VoidCallback onContinueGuest,
  required VoidCallback onBack,
  bool initiallyRegister = false,
}) => PocketAccountPage(
  auth: auth,
  onSuccess: onSuccess,
  onContinueGuest: onContinueGuest,
  onBack: onBack,
  initiallyRegister: initiallyRegister,
);
