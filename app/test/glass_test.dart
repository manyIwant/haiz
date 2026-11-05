import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/glass/glass.dart';
import 'package:haiz_pocket_flutter/glass/glass_prefs.dart';
import 'package:haiz_pocket_flutter/glass/glass_specs.dart';

/// A page with a lens over it; [scroll] moves the page under the lens.
class _Harness extends StatefulWidget {
  const _Harness({super.key, required this.mode, this.offstageSurface = false});
  final GlassMode mode;
  final bool offstageSurface;
  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  double shift = 0;
  bool wide = false;

  void update(VoidCallback fn) => setState(fn);
  @override
  Widget build(BuildContext context) => MaterialApp(
    home: Scaffold(
      body: GlassScope(
        mode: widget.mode,
        dark: false,
        content: Transform.translate(
          offset: Offset(0, shift),
          child: Column(children: [
            for (var i = 0; i < 18; i++) Container(height: 30, color: i.isEven ? Colors.black : Colors.white),
          ]),
        ),
        overlay: Stack(children: [
          Positioned(
            left: 20,
            top: 300,
            width: wide ? 300 : 200,
            height: 60,
            child: const GlassSurface(spec: GlassSpecs.bar, child: SizedBox.expand()),
          ),
          if (widget.offstageSurface)
            const Positioned(
              left: 20,
              top: 100,
              width: 100,
              height: 60,
              child: Offstage(child: GlassSurface(spec: GlassSpecs.bar, child: SizedBox.expand())),
            ),
        ]),
      ),
    ),
  );
}

RenderGlassScope _scope(WidgetTester tester) =>
    tester.renderObject<RenderGlassScope>(find.byWidgetPredicate((w) => w.runtimeType.toString() == '_GlassScopeRender'));

void main() {
  setUp(GlassBudget.reset);

  testWidgets('without a loaded shader optical glass falls back to solid and still draws', (tester) async {
    await tester.pumpWidget(const _Harness(mode: GlassMode.optical));
    await tester.pump();
    final scope = _scope(tester);
    if (GlassProgram.program.value == null) expect(scope.mode, GlassMode.solid);
    expect(scope.debugSurfacesDrawn, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('offstage surfaces get no glass', (tester) async {
    await tester.pumpWidget(const _Harness(mode: GlassMode.solid, offstageSurface: true));
    await tester.pump();
    expect(_scope(tester).debugSurfacesDrawn, 1, reason: 'only the painted surface');
  });

  testWidgets('blur and solid modes render without errors', (tester) async {
    for (final mode in [GlassMode.blur, GlassMode.solid]) {
      await tester.pumpWidget(_Harness(key: ValueKey(mode), mode: mode));
      await tester.pump();
      expect(_scope(tester).debugSurfacesDrawn, 1);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('optical glass snapshots the page once per page change, not per overlay change', (tester) async {
    await tester.runAsync(GlassProgram.ensureLoaded);
    if (GlassProgram.program.value == null) {
      markTestSkipped('fragment programs are unavailable in this test renderer');
      return;
    }
    await tester.pumpWidget(const _Harness(mode: GlassMode.optical));
    await tester.pump();
    final scope = _scope(tester);
    expect(scope.mode, GlassMode.optical);
    final first = scope.debugSnapshots;
    expect(first, greaterThan(0));

    // Overlay-only change (the surface resizes): page is unchanged, so the
    // cached snapshot is reused only if the sampled rect is unchanged; a
    // wider surface needs a wider sample.
    final state = tester.state<_HarnessState>(find.byType(_Harness));
    state.update(() => state.wide = true);
    await tester.pump();
    final afterResize = scope.debugSnapshots;
    expect(afterResize, first + 1);
    // Repaint the overlay with identical geometry: no new snapshot.
    scope.markNeedsPaint();
    await tester.pump();
    expect(scope.debugSnapshots, afterResize);

    // The page moves under the glass: a fresh snapshot in the same frame.
    state.update(() => state.shift = 12);
    await tester.pump();
    expect(scope.debugSnapshots, afterResize + 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a repaint inside a nested boundary reaches the glass, and an idle scope stops', (tester) async {
    await tester.runAsync(GlassProgram.ensureLoaded);
    if (GlassProgram.program.value == null) {
      markTestSkipped('fragment programs are unavailable in this test renderer');
      return;
    }
    final tick = ValueNotifier(0);
    addTearDown(tick.dispose);
    await tester.pumpWidget(MaterialApp(
      home: GlassScope(
        mode: GlassMode.optical,
        dark: false,
        // A list row: its own repaint boundary, repainting on its own.
        content: RepaintBoundary(child: CustomPaint(painter: _Ticker(tick), size: const Size(400, 800))),
        overlay: const Stack(children: [
          Positioned(left: 20, top: 300, width: 200, height: 60,
              child: GlassSurface(spec: GlassSpecs.bar, child: SizedBox.expand())),
        ]),
      ),
    ));
    await tester.pump();
    await tester.pump();
    final scope = _scope(tester);
    final before = scope.debugSnapshots;
    tick.value++;
    await tester.pump(); // the row repaints alone
    await tester.pump(); // the glass re-samples
    expect(scope.debugSnapshots, greaterThan(before), reason: 'glass must not keep showing the old row');
    final settled = scope.debugSnapshots;
    await tester.pump();
    expect(tester.binding.hasScheduledFrame, isFalse, reason: 'no frame loop when nothing changes');
    expect(scope.debugSnapshots, settled);

    // The row changes in the same frame the scope repaints for another
    // reason (labels relaid out when a font arrives): no stale reuse.
    tick.value++;
    scope.markNeedsPaint();
    await tester.pump();
    expect(scope.debugSnapshots, settled + 1);
    // Overlay-only repaint: the page is unchanged, the snapshot is reused.
    scope.markNeedsPaint();
    await tester.pump();
    expect(scope.debugSnapshots, settled + 1);
  });

  testWidgets('sustained raster cost downgrades glass to solid; fast frames do not', (tester) async {
    await tester.pumpWidget(const _Harness(mode: GlassMode.solid));
    GlassBudget.debugReport(List.filled(80, 6.0));
    expect(GlassBudget.degraded.value, isFalse);
    GlassBudget.debugReport(List.filled(80, 22.0));
    expect(GlassBudget.degraded.value, isTrue);
    GlassBudget.reset();
  });

  testWidgets('reduce transparency: the in-app setting and high contrast force solid', (tester) async {
    late BuildContext ctx;
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(highContrast: true),
      child: Builder(builder: (c) { ctx = c; return const SizedBox(); }),
    ));
    expect(GlassPreference.resolve(ctx, 'auto'), GlassMode.solid);
    await tester.pumpWidget(Builder(builder: (c) { ctx = c; return const SizedBox(); }));
    expect(GlassPreference.resolve(ctx, 'auto'), GlassMode.optical);
    expect(GlassPreference.resolve(ctx, 'solid'), GlassMode.solid);
  });
}

class _Ticker extends CustomPainter {
  _Ticker(this.tick) : super(repaint: tick);
  final ValueNotifier<int> tick;
  @override
  void paint(Canvas canvas, Size size) =>
      canvas.drawRect(Offset.zero & size, Paint()..color = tick.value.isEven ? Colors.black : Colors.white);
  @override
  bool shouldRepaint(_Ticker old) => false;
}
