class TickerPhysics {
  final double acceleration;
  final double initialSpeed;

  /// 50 Hz ticker; one mark per 0.02 second.
  static const frequency = 50.0;
  static const tickStep = 1 / frequency;

  /// Count every five raw intervals, i.e. 0.10 second.
  static const countEvery = 5;
  static const countStep = tickStep * countEvery;
  static const duration = 1.2;

  const TickerPhysics({this.acceleration = 0.72, this.initialSpeed = 0.22});

  double positionAt(double t) => initialSpeed * t + 0.5 * acceleration * t * t;
  double velocityAt(double t) => initialSpeed + acceleration * t;

  int get rawCount => (duration / tickStep).round() + 1;
  int get countCount => (duration / countStep).round() + 1;

  double rawTime(int i) => i * tickStep;
  double countTime(int i) => i * countStep;
  double markAt(int i) => positionAt(countTime(i));

  /// Central-difference speed inferred from the paper tape, not display model.
  /// Valid for internal count points [1..countCount-2].
  double measuredSpeed(int i) =>
      (markAt(i + 1) - markAt(i - 1)) / (2 * countStep);

  List<(double, double)> get speedSamples => [
    for (int i = 1; i < countCount - 1; i++) (countTime(i), measuredSpeed(i)),
  ];

  /// Least-squares slope of measured v(t), equals acceleration in this ideal model.
  double get fittedAcceleration {
    final data = speedSamples;
    final n = data.length;
    final x = data.fold(0.0, (a, b) => a + b.$1) / n;
    final y = data.fold(0.0, (a, b) => a + b.$2) / n;
    double num = 0, den = 0;
    for (final point in data) {
      num += (point.$1 - x) * (point.$2 - y);
      den += (point.$1 - x) * (point.$1 - x);
    }
    return den == 0 ? 0 : num / den;
  }
}
