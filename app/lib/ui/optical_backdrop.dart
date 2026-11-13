import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Backdrop for the floating dock. Live optical transmission is available
/// only on Flutter's Impeller backend; elsewhere a bounded Gaussian blur.
class OpticalBackdrop extends StatelessWidget {
  const OpticalBackdrop({super.key, required this.child, required this.dark});

  final Widget child;
  final bool dark;

  static final Future<ui.FragmentProgram?> _program =
      ui.FragmentProgram.fromAsset('shaders/haiz_optical.frag')
          .then<ui.FragmentProgram?>((program) => program)
          .catchError((Object _) => null);

  // On some Android OpenGL/Impeller drivers ImageFilter.shader can render
  // stale or inverted backdrop tiles outside the floating navigation bar.
  // Prefer Flutter's stable Gaussian blur for Android (and web).
  static ui.ImageFilter _blur() =>
      ui.ImageFilter.blur(sigmaX: 13, sigmaY: 13, tileMode: TileMode.clamp);

  @override
  Widget build(BuildContext context) {
    if (kIsWeb || defaultTargetPlatform == TargetPlatform.android) {
      return ClipRect(
        child: BackdropFilter(filter: _blur(), child: child),
      );
    }

    return FutureBuilder<ui.FragmentProgram?>(
      future: _program,
      builder: (context, snapshot) {
        // The first vec2 and sampler are bound by Flutter's compositor,
        // not by Dart. Only the third float (dark theme) is ours.
        ui.ImageFilter filter = _blur();
        if (ui.ImageFilter.isShaderFilterSupported && snapshot.hasData) {
          try {
            final shader = snapshot.data!.fragmentShader();
            shader.setFloat(2, dark ? 1.0 : 0.0);
            filter = ui.ImageFilter.shader(shader);
          } catch (_) {
            // Do not crash on drivers without a usable custom shader.
          }
        }
        return ClipRect(
          child: BackdropFilter(filter: filter, child: child),
        );
      },
    );
  }
}
