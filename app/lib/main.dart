import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/haiz_app.dart';
import 'core/pocket_auth.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  pdfrxFlutterInitialize();
  SupabaseClient? cloud;
  try {
    cloud = await initializePocketAuth();
  } catch (error) {
    // A configuration/network failure must not destroy offline guest mode.
    debugPrint('Pocket identity initialization unavailable: ${error.runtimeType}');
  }
  runApp(HaizApp(cloudClient: cloud));
}
