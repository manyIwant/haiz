import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Native optical surface, ported from website's optical-glass.js.
///
/// The original WebGL material samples live campus pixels and computes the
/// rounded bevel normal, n=1.46 refraction, RGB dispersion and Fresnel rim.
/// Flutter's ImageFilter.shader samples the compositor's LIVE backdrop;
/// the Flutter-only fallback is selected on devices without Impeller.
class OpticalBackdrop extends StatelessWidget {
  const OpticalBackdrop({super.key, required this.child});

  final Widget child;

  static final Future<ui.FragmentProgram?> _program =
      ui.FragmentProgram.fromAsset('shaders/haiz_optical.frag')
          .then<ui.FragmentProgram?>((value) => value)
          .catchError((Object _) => null);

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ui.FragmentProgram?>(
      future: _program,
      builder: (context, snapshot) {
        final shaderSupported = ui.ImageFilter.isShaderFilterSupported;
        final program = snapshot.data;
        final ui.ImageFilter filter;
        if (shaderSupported && program != null) {
          final shader = program.fragmentShader();
          filter = ui.ImageFilter.shader(shader);
        } else {
          filter = ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12);
        }
        return BackdropFilter(filter: filter, child: child);
      },
    );
  }
}
