import 'glass.dart';

/// The few glass materials HAIZ uses. Fewer, consistent materials read as
/// one physical system; per-widget tweaking reads as decoration.
abstract final class GlassSpecs {
  /// Floating navigation capsule — the 1.4 optical dock's lens: a wide
  /// refracting edge (bevel 22, depth 30, n 1.46), a light diagonal glaze,
  /// and a ~2 px soft kernel so dense text behind the labels does not turn
  /// to noise. Dispersion is kept faint (0.4 of the 1.4 lens's split).
  static const bar = GlassSpec(radius: 31, bevel: 18, depth: 28, dispersion: 0.3, frost: 0.45, veil: 0.18,
      magnify: 0.042);

  /// The selected-tab lens inside the bar: clearer and more curved, with
  /// its own rim (the 1.4 dock's selected-tab treatment).
  static const indicator = GlassSpec(radius: 24, bevel: 16, depth: 22, dispersion: 0.5, frost: 0.12, veil: 0.12,
      magnify: 0.07, shadow: 0.35, z: 1);

  /// The running-focus capsule above the bar.
  static const focus = GlassSpec(radius: 22, bevel: 18, depth: 26, dispersion: 0.4, frost: 0.45, veil: 0.20,
      magnify: 0.042);

  /// Primary action: smoked (ink) glass, so it keeps the contrast of a
  /// filled button while still refracting at the rim.
  static const action = GlassSpec(radius: 18, bevel: 16, depth: 24, dispersion: 0.4, frost: 0.2, smoked: true,
      magnify: 0.05);

  /// Glass Lab lens: a generous, thick disc that makes refraction obvious.
  static const lens = GlassSpec(radius: 75, bevel: 44, depth: 42, dispersion: 0.55, frost: 0.0, veil: 0.04,
      magnify: 0.12);
}
