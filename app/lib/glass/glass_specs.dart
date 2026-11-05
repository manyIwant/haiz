import 'glass.dart';

/// The few glass materials HAIZ uses. Fewer, consistent materials read as
/// one physical system; per-widget tweaking reads as decoration.
abstract final class GlassSpecs {
  /// Floating navigation capsule: thick rim, clear centre, enough veil that
  /// labels stay legible over any page.
  static const bar = GlassSpec(radius: 31, bevel: 11, depth: 16, dispersion: 0.55, frost: 0.45, veil: 0.46, magnify: 1.5);

  /// The selected-tab droplet inside the bar: clearer, more refractive.
  static const indicator = GlassSpec(radius: 24, bevel: 12, depth: 16, dispersion: 0.7, frost: 0.15, veil: 0.22,
      magnify: 3.5, shadow: 0.35, z: 1);

  /// The running-focus capsule above the bar.
  static const focus = GlassSpec(radius: 22, bevel: 10, depth: 14, dispersion: 0.45, frost: 0.45, veil: 0.50, magnify: 1.0);

  /// Primary action: smoked (ink) glass, so it keeps the contrast of a
  /// filled button while still showing an optical rim.
  static const action = GlassSpec(radius: 18, bevel: 12, depth: 18, dispersion: 0.4, frost: 0.2, smoked: true, magnify: 2.0);

  /// Glass Lab lens: a generous, thick disc that makes refraction obvious.
  static const lens = GlassSpec(radius: 75, bevel: 34, depth: 38, dispersion: 0.8, frost: 0.0, veil: 0.06, magnify: 6.0);
}
