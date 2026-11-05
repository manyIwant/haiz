import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

/// How glass surfaces are rendered.
enum GlassMode {
  /// Refraction through a thick slab, sampled from the page under it.
  optical,

  /// Gaussian backdrop blur with a tint (comparison / legacy look).
  blur,

  /// Opaque material. Used for "reduce transparency", high contrast, and
  /// automatically when sustained frame cost is too high.
  solid,
}

/// Material description of one glass surface. Lengths in logical pixels.
@immutable
class GlassSpec {
  const GlassSpec({
    this.radius = 999,
    this.bevel = 22,
    this.depth = 30,
    this.dispersion = 1.0,
    this.frost = 0.25,
    this.veil = 0.30,
    this.absorption = 0.08,
    this.magnify = 0.042,
    this.smoked = false,
    this.shadow = 1.0,
    this.opacity = 1.0,
    this.z = 0,
  });

  final double radius;
  final double bevel;
  final double depth;
  final double dispersion;
  final double frost;
  final double veil;
  final double absorption;
  final double magnify;

  /// Ink-tinted glass for the primary action.
  final bool smoked;

  /// 0 = no cast shadow, 1 = default.
  final double shadow;
  final double opacity;

  /// Paint order among surfaces (higher is on top).
  final int z;

  GlassSpec copyWith({double? radius, double? bevel, double? depth, double? dispersion, double? frost,
      double? veil, double? absorption, double? magnify, bool? smoked, double? shadow, double? opacity, int? z}) =>
      GlassSpec(
        radius: radius ?? this.radius,
        bevel: bevel ?? this.bevel,
        depth: depth ?? this.depth,
        dispersion: dispersion ?? this.dispersion,
        frost: frost ?? this.frost,
        veil: veil ?? this.veil,
        absorption: absorption ?? this.absorption,
        magnify: magnify ?? this.magnify,
        smoked: smoked ?? this.smoked,
        shadow: shadow ?? this.shadow,
        opacity: opacity ?? this.opacity,
        z: z ?? this.z,
      );

  @override
  bool operator ==(Object other) =>
      other is GlassSpec && other.radius == radius && other.bevel == bevel && other.depth == depth &&
      other.dispersion == dispersion && other.frost == frost && other.veil == veil &&
      other.absorption == absorption && other.magnify == magnify && other.smoked == smoked &&
      other.shadow == shadow && other.opacity == opacity && other.z == z;

  @override
  int get hashCode => Object.hash(radius, bevel, depth, dispersion, frost, veil, absorption, magnify, smoked, shadow, opacity, z);
}

/// Loads the glass program once. Failure (no shader support, missing asset)
/// is a normal outcome: surfaces then render as [GlassMode.solid].
class GlassProgram {
  GlassProgram._();
  static final ValueNotifier<ui.FragmentProgram?> program = ValueNotifier(null);
  static final ValueNotifier<bool> failed = ValueNotifier(false);
  static Future<void>? _loading;

  static Future<void> ensureLoaded() => _loading ??= () async {
        try {
          program.value = await ui.FragmentProgram.fromAsset('shaders/haiz_glass.frag');
        } catch (error) {
          debugPrint('Glass shader unavailable (${error.runtimeType}); using solid material');
          failed.value = true;
        }
      }();
}

/// Watches real frame cost while optical glass is on screen. If raster time
/// stays above budget the scope falls back to [GlassMode.solid] for the rest
/// of the session (and says so in the Glass Lab).
class GlassBudget {
  GlassBudget._();
  static final ValueNotifier<bool> degraded = ValueNotifier(false);
  static final List<double> _recent = [];
  static bool _listening = false;
  static int activeScopes = 0;

  /// QA captures in a CPU-rendered headless browser are not representative
  /// of real devices; `?budget=off` (web) disables the automatic downgrade.
  static bool enabled = true;

  /// Raster budget per frame in milliseconds (60 Hz frame minus headroom).
  static const double budgetMs = 13.0;

  static void listen() {
    if (_listening) return;
    _listening = true;
    SchedulerBinding.instance.addTimingsCallback(_onTimings);
  }

  static void _onTimings(List<ui.FrameTiming> timings) =>
      debugReport([for (final t in timings) t.rasterDuration.inMicroseconds / 1000.0]);

  /// Feeds raster times in milliseconds (also used by tests).
  @visibleForTesting
  static void debugReport(List<double> rasterMs) {
    if (!enabled || activeScopes == 0 || degraded.value) return;
    _recent.addAll(rasterMs);
    while (_recent.length > 90) {
      _recent.removeAt(0);
    }
    if (_recent.length < 60) return;
    final slow = _recent.where((ms) => ms > budgetMs).length;
    if (slow > _recent.length * 0.5) {
      degraded.value = true;
      debugPrint('Glass: sustained raster cost over ${budgetMs}ms; switching to solid material');
    }
  }

  @visibleForTesting
  static void reset() {
    degraded.value = false;
    _recent.clear();
  }
}

/// Composition root for glass. [content] is the page; [overlay] holds the
/// floating controls, which may contain [GlassSurface]s. Each surface is
/// drawn by the scope between the two, from a snapshot of [content] under it.
class GlassScope extends StatelessWidget {
  const GlassScope({
    super.key,
    required this.content,
    required this.overlay,
    required this.mode,
    required this.dark,
    this.light = const Offset(-0.55, -0.85),
    this.paper = const Color(0xFFF6F4EF),
    this.ink = const Color(0xFF17181A),
    this.ground,
  });

  /// The opaque page colour painted under [content] inside the sampled layer.
  /// Without it, areas the page leaves transparent would refract as black.
  final Color? ground;

  final Widget content;
  final Widget overlay;
  final GlassMode mode;
  final bool dark;
  final Offset light;

  /// Veil colours (light: paper, dark: graphite) and the smoked tint.
  final Color paper;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ui.FragmentProgram?>(
      valueListenable: GlassProgram.program,
      builder: (context, program, _) => ValueListenableBuilder<bool>(
        valueListenable: GlassBudget.degraded,
        builder: (context, degraded, _) => _GlassScopeRender(
          program: program,
          mode: mode == GlassMode.optical && (program == null || degraded) ? GlassMode.solid : mode,
          dark: dark,
          light: light,
          paper: paper,
          ink: ink,
          dpr: MediaQuery.devicePixelRatioOf(context),
          children: [_GlassContent(child: ColoredBox(color: ground ?? paper, child: content)), overlay],
        ),
      ),
    );
  }
}

class _GlassScopeRender extends MultiChildRenderObjectWidget {
  const _GlassScopeRender({
    required this.program,
    required this.mode,
    required this.dark,
    required this.light,
    required this.paper,
    required this.ink,
    required this.dpr,
    required super.children,
  });

  final ui.FragmentProgram? program;
  final GlassMode mode;
  final bool dark;
  final Offset light;
  final Color paper;
  final Color ink;
  final double dpr;

  @override
  RenderGlassScope createRenderObject(BuildContext context) => RenderGlassScope()
    ..program = program
    ..mode = mode
    ..dark = dark
    ..light = light
    ..paper = paper
    ..ink = ink
    ..dpr = dpr;

  @override
  void updateRenderObject(BuildContext context, RenderGlassScope renderObject) {
    renderObject
      ..program = program
      ..mode = mode
      ..dark = dark
      ..light = light
      ..paper = paper
      ..ink = ink
      ..dpr = dpr;
  }
}

class _GlassContent extends SingleChildRenderObjectWidget {
  const _GlassContent({required super.child});
  @override
  RenderGlassContent createRenderObject(BuildContext context) => RenderGlassContent();
}

/// The page subtree. A repaint boundary of its own (so scrolling repaints
/// only the page), which tells its scope whenever it repaints so glass is
/// refreshed in the same frame.
class RenderGlassContent extends RenderProxyBox {
  RenderGlassScope? _scope;

  /// A fingerprint of what the page currently shows: the identity of every
  /// recorded picture plus the offsets, transforms, clips and effects that
  /// place it. A nested repaint boundary (a list row, a paragraph relaid
  /// out when a font arrives) re-records its pictures without repainting
  /// this boundary, so a repaint counter here would miss it; the layer
  /// tree does not. Walking it costs microseconds; a stale snapshot under
  /// the glass is visible.
  int get signature {
    var h = 17;
    void visit(Layer l) {
      h = Object.hash(h, l.runtimeType);
      if (l is PictureLayer) h = Object.hash(h, identityHashCode(l.picture));
      if (l is OffsetLayer) h = Object.hash(h, l.offset);
      if (l is TransformLayer) h = Object.hash(h, l.transform);
      if (l is OpacityLayer) h = Object.hash(h, l.alpha);
      if (l is ClipRectLayer) h = Object.hash(h, l.clipRect);
      if (l is ClipRRectLayer) h = Object.hash(h, l.clipRRect);
      if (l is ClipRSuperellipseLayer) h = Object.hash(h, l.clipRSuperellipse);
      if (l is ClipPathLayer) h = Object.hash(h, identityHashCode(l.clipPath));
      if (l is ColorFilterLayer) h = Object.hash(h, l.colorFilter);
      if (l is ImageFilterLayer) h = Object.hash(h, l.imageFilter);
      if (l is ContainerLayer) {
        for (var c = l.firstChild; c != null; c = c.nextSibling) {
          visit(c);
        }
      }
    }
    final root = layer;
    if (root != null) visit(root);
    return h;
  }

  @override
  bool get isRepaintBoundary => true;

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    _scope = parent is RenderGlassScope ? parent as RenderGlassScope : null;
  }

  @override
  void markNeedsPaint() {
    super.markNeedsPaint();
    // Build/layout phase only: safe to dirty the (shallower) scope, which
    // paints after this boundary in the same frame.
    _scope?.markNeedsPaint();
  }


  ui.Image? snapshot(Rect bounds, double pixelRatio) {
    final l = layer;
    if (l is! OffsetLayer) return null;
    try {
      return l.toImageSync(bounds, pixelRatio: pixelRatio);
    } catch (error) {
      debugPrint('Glass snapshot failed (${error.runtimeType})');
      return null;
    }
  }
}

class _ScopeParentData extends ContainerBoxParentData<RenderBox> {}

/// Paints: page → glass (shadows, lenses) → overlay. Glass is recorded after
/// the overlay has painted, so only surfaces actually painted this frame
/// (not offstage tabs) get glass, at their exact transformed position; it is
/// inserted into a layer slot that sits beneath the overlay.
class RenderGlassScope extends RenderBox
    with ContainerRenderObjectMixin<RenderBox, _ScopeParentData>,
        RenderBoxContainerDefaultsMixin<RenderBox, _ScopeParentData> {
  ui.FragmentProgram? _program;
  GlassMode _mode = GlassMode.optical;
  bool _dark = false;
  Offset _light = const Offset(-0.55, -0.85);
  Color paper = const Color(0xFFF6F4EF);
  Color ink = const Color(0xFF17181A);
  double _dpr = 1;

  final List<RenderGlassSurface> _painted = [];

  /// Test hooks: page snapshots taken, and surfaces drawn in the last frame.
  @visibleForTesting
  int debugSnapshots = 0;
  @visibleForTesting
  int debugSurfacesDrawn = 0;
  final Map<RenderGlassSurface, ui.FragmentShader> _shaders = {};
  final Map<RenderGlassSurface, _Snap> _snaps = {};
  final List<ui.Image> _retired = [];
  final LayerHandle<ContainerLayer> _glassSlot = LayerHandle();

  set program(ui.FragmentProgram? v) { if (v != _program) { _program = v; _clearShaders(); markNeedsPaint(); } }
  set mode(GlassMode v) { if (v != _mode) { _mode = v; markNeedsPaint(); } }
  GlassMode get mode => _mode;
  set dark(bool v) { if (v != _dark) { _dark = v; markNeedsPaint(); } }
  set light(Offset v) { if (v != _light) { _light = v; markNeedsPaint(); } }
  set dpr(double v) { final c = v.clamp(1.0, 2.0); if (c != _dpr) { _dpr = c; _snaps.clear(); markNeedsPaint(); } }

  void _clearShaders() {
    for (final s in _shaders.values) {
      s.dispose();
    }
    _shaders.clear();
  }

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _ScopeParentData) child.parentData = _ScopeParentData();
  }

  @override
  bool get isRepaintBoundary => true;

  @override
  bool get alwaysNeedsCompositing => true;

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    GlassBudget.activeScopes++;
    GlassBudget.listen();
  }

  @override
  void detach() {
    GlassBudget.activeScopes--;
    super.detach();
  }

  @override
  void dispose() {
    _clearShaders();
    for (final s in _snaps.values) {
      s.image.dispose();
    }
    _snaps.clear();
    for (final i in _retired) {
      i.dispose();
    }
    _retired.clear();
    _glassSlot.layer = null;
    super.dispose();
  }

  @override
  void performLayout() {
    size = constraints.biggest;
    var child = firstChild;
    while (child != null) {
      child.layout(BoxConstraints.tight(size));
      child = childAfter(child);
    }
  }

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) =>
      defaultHitTestChildren(result, position: position);

  void notePainted(RenderGlassSurface s) => _painted.add(s);

  // Nested repaint boundaries inside the page (every list row, a paragraph
  // relaid out when a fallback font arrives) repaint without dirtying the
  // content boundary or this scope, so the glass would keep showing the old
  // page. After any frame in which this scope did not paint, it compares
  // the page's layer fingerprint with the one last sampled and repaints if
  // it changed. If that request is not honoured (the scope is offstage
  // under another route) it stops until the scope paints again, so an idle
  // or hidden scope never keeps frames running.
  int? _sampledSignature;
  bool _paintedThisFrame = false;
  bool _requested = false;
  bool _watching = false;

  void _watch() {
    if (_watching || !attached) return;
    _watching = true;
    SchedulerBinding.instance.addPostFrameCallback(_afterFrame);
  }

  void _afterFrame(Duration _) {
    _watching = false;
    if (!attached || _mode != GlassMode.optical) return;
    if (_paintedThisFrame) {
      _paintedThisFrame = false;
      _requested = false;
      _watch();
      return;
    }
    if (_requested) {
      _requested = false;
      return;
    }
    final content = firstChild;
    if (content is! RenderGlassContent || _snaps.isEmpty || content.signature == _sampledSignature) {
      _watch();
      return;
    }
    _requested = true;
    markNeedsPaint();
    _watch();
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    _paintedThisFrame = true;
    _watch();
    for (final i in _retired) {
      i.dispose();
    }
    _retired.clear();
    final content = firstChild as RenderGlassContent?;
    final overlay = lastChild;
    if (content == null || overlay == null) return;
    context.paintChild(content, offset);
    // The page as it is now (its own and its nested boundaries' layers are
    // already recorded for this frame).
    _sampledSignature = content.signature;

    // Reserve the slot beneath the overlay; fill it after the overlay paints.
    final slot = _glassSlot.layer ??= ContainerLayer();
    _painted.clear();
    context.pushLayer(slot, (_, _) {}, offset);
    context.paintChild(overlay, offset);

    slot.removeAllChildren();
    debugSurfacesDrawn = 0;
    if (_painted.isEmpty) return;
    final surfaces = [..._painted]..sort((a, b) => a.spec.z.compareTo(b.spec.z));
    for (final s in surfaces) {
      if (!s.attached || !s.hasSize || s.spec.opacity <= 0.01) continue;
      final rect = MatrixUtils.transformRect(s.getTransformTo(this), Offset.zero & s.size).shift(offset);
      if (rect.isEmpty || !rect.overlaps(Offset.zero & size)) continue;
      debugSurfacesDrawn++;
      switch (_mode) {
        case GlassMode.optical:
          _paintOptical(slot, content, s, rect, offset);
        case GlassMode.blur:
          _paintBlur(slot, s, rect);
        case GlassMode.solid:
          _paintSolid(slot, s, rect);
      }
    }
  }

  RRect _rrect(GlassSpec spec, Rect rect) =>
      RRect.fromRectAndRadius(rect, Radius.circular(spec.radius.clamp(0, rect.shortestSide / 2)));

  void _paintShadow(Canvas canvas, GlassSpec spec, RRect rr) {
    if (spec.shadow <= 0) return;
    final a = spec.opacity * spec.shadow;
    // The 1.4 dock's float: a deep, pulled-in shadow well below the slab
    // (blur 26, spread -5, offset 16 there), plus a tight contact shadow.
    canvas.drawRRect(
      rr.deflate(5).shift(const Offset(0, 12)),
      Paint()
        ..color = const Color(0xFF000000).withValues(alpha: (_dark ? 0.34 : 0.17) * a)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14),
    );
    canvas.drawRRect(
      rr.shift(const Offset(0, 1)),
      Paint()
        ..color = const Color(0xFF000000).withValues(alpha: (_dark ? 0.26 : 0.06) * a)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5),
    );
  }

  /// Surface reflections painted over the transmitted image — the 1.4
  /// dock's lens sheen: a grazing reflection across the upper-left, a rim
  /// that is bright towards the light and dark on the turn, a thinner inner
  /// edge that implies thickness, and a caustic streak along the top. Also
  /// painted over the blur fallback, so every glass mode keeps a rim.
  void _paintSheen(Canvas canvas, GlassSpec spec, RRect rr) {
    final bounds = rr.outerRect;
    if (bounds.width < 4 || bounds.height < 4) return;
    final selected = spec.z > 0;
    final dark = _dark || spec.smoked;
    final o = spec.opacity;
    // Smoked glass keeps its ink: a quieter wash, the same rim.
    final wash = spec.smoked ? 0.45 : 1.0;
    final white = const Color(0xFFFFFFFF);
    canvas.save();
    canvas.clipRRect(rr);
    canvas.drawRect(bounds, Paint()
      ..shader = RadialGradient(
        center: selected ? const Alignment(-0.4, -1.2) : const Alignment(-0.63, -1.25),
        radius: selected ? 1.1 : 1.36,
        colors: [
          // On paper the 1.4 wash (0.43 / 0.13) whited out what the glass
          // transmits; it is halved there. Dark keeps the 1.4 values.
          white.withValues(alpha: (dark ? 0.27 : 0.22) * o * wash),
          white.withValues(alpha: (dark ? 0.085 : 0.06) * o * wash),
          white.withValues(alpha: 0),
        ],
        stops: const [0.0, 0.46, 1.0],
      ).createShader(bounds));
    canvas.drawRect(bounds, Paint()
      ..shader = LinearGradient(
        begin: Alignment.bottomLeft,
        end: Alignment.topRight,
        colors: [
          white.withValues(alpha: (dark ? 0.10 : 0.10) * o),
          white.withValues(alpha: 0),
          const Color(0xFF000000).withValues(alpha: (dark ? 0.08 : 0.04) * o),
        ],
        stops: const [0, 0.55, 1],
      ).createShader(bounds));
    canvas.restore();

    canvas.drawRRect(rr.deflate(0.9), Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          white.withValues(alpha: (dark ? 0.68 : 0.98) * o),
          white.withValues(alpha: (dark ? 0.24 : 0.60) * o),
          const Color(0xFF000000).withValues(alpha: (dark ? 0.20 : 0.12) * o),
          white.withValues(alpha: (dark ? 0.33 : 0.82) * o),
        ],
        stops: const [0.0, 0.28, 0.75, 1.0],
      ).createShader(bounds)
      ..style = PaintingStyle.stroke
      ..strokeWidth = selected ? 1.25 : 1.7);
    canvas.drawRRect(rr.deflate(3.0), Paint()
      ..color = white.withValues(alpha: (selected ? (dark ? 0.21 : 0.37) : (dark ? 0.15 : 0.21)) * o)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.65);

    final r = rr.tlRadiusX;
    final streak = Path()
      ..moveTo(bounds.left + r * 1.1, bounds.top + 3.0)
      ..quadraticBezierTo(bounds.left + bounds.width * 0.34, bounds.top + 1.8,
          bounds.left + bounds.width * (selected ? 0.66 : 0.56), bounds.top + 3.4);
    canvas.drawPath(streak, Paint()
      ..shader = LinearGradient(
        colors: [white.withValues(alpha: o), white.withValues(alpha: 0.74 * o), white.withValues(alpha: 0)],
        stops: const [0.0, 0.34, 1.0],
      ).createShader(bounds)
      ..style = PaintingStyle.stroke
      ..strokeWidth = selected ? 1.5 : 1.7
      ..strokeCap = StrokeCap.round);
  }

  void _paintOptical(ContainerLayer slot, RenderGlassContent content, RenderGlassSurface s, Rect rect, Offset offset) {
    final program = _program;
    final spec = s.spec;
    if (program == null) return _paintSolid(slot, s, rect);
    // Snapshot the page under the surface plus a margin for refraction.
    final margin = spec.depth + spec.bevel + 6;
    final want = rect.inflate(margin).intersect(offset & size);
    final cached = _snaps[s];
    ui.Image? image;
    Rect texRect;
    final signature = _sampledSignature ?? content.signature;
    if (cached != null && cached.signature == signature && cached.rect == want) {
      image = cached.image;
      texRect = cached.rect;
    } else {
      image = content.snapshot(want.shift(-offset), _dpr);
      debugSnapshots++;
      texRect = want;
      if (image == null) return _paintSolid(slot, s, rect);
      if (cached != null) _retired.add(cached.image);
      _snaps[s] = _Snap(image, want, signature);
    }
    final shader = _shaders[s] ??= program.fragmentShader();
    final veil = spec.smoked ? ink : paper;
    var i = 0;
    void f(double v) => shader.setFloat(i++, v);
    f(rect.width); f(rect.height);
    f(rect.left); f(rect.top);
    f(texRect.left); f(texRect.top);
    f(texRect.width); f(texRect.height);
    f(spec.radius); f(spec.bevel); f(spec.depth);
    f(spec.dispersion); f(spec.frost);
    // Dark theme: a denser graphite film, as the 1.4 dock (0.16 / 0.48
    // there against 0.10 / 0.29 on paper); paper stays clear.
    f(spec.smoked ? 0.84 : (spec.veil * (_dark ? 2.4 : 1.0)).clamp(0.0, 1.0));
    f(veil.r); f(veil.g); f(veil.b); f(spec.absorption);
    f(_light.dx); f(_light.dy);
    f(_dark || spec.smoked ? 1 : 0);
    f(spec.opacity);
    f(spec.magnify);
    shader.setImageSampler(0, image, filterQuality: FilterQuality.medium);

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final rr = _rrect(spec, rect);
    _paintShadow(canvas, spec, rr);
    canvas.drawRect(rect.inflate(1), Paint()..shader = shader);
    _paintSheen(canvas, spec, rr);
    slot.append(PictureLayer(rect.inflate(40))..picture = recorder.endRecording());
  }

  void _paintBlur(ContainerLayer slot, RenderGlassSurface s, Rect rect) {
    final spec = s.spec;
    final rr = _rrect(spec, rect);
    final shadow = ui.PictureRecorder();
    _paintShadow(Canvas(shadow), spec, rr);
    slot.append(PictureLayer(rect.inflate(40))..picture = shadow.endRecording());
    final tint = ui.PictureRecorder();
    final c = Canvas(tint);
    final base = spec.smoked ? ink : paper;
    // The 1.4 dock's fallback: blur, a diagonal glaze, then the same sheen
    // as the optical path, so the rim and reflections survive without
    // refraction.
    final o = spec.opacity;
    c.drawRRect(rr, Paint()
      ..shader = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: spec.smoked
          ? [base.withValues(alpha: 0.86 * o), base.withValues(alpha: 0.78 * o)]
          : [base.withValues(alpha: (_dark ? 0.48 : 0.36) * o), base.withValues(alpha: (_dark ? 0.30 : 0.22) * o)])
          .createShader(rr.outerRect));
    _paintSheen(c, spec, rr);
    final clip = ClipRRectLayer(clipRRect: rr.inflate(2), clipBehavior: Clip.antiAlias);
    final backdrop = BackdropFilterLayer(filter: ui.ImageFilter.blur(sigmaX: 13, sigmaY: 13, tileMode: TileMode.clamp));
    backdrop.append(PictureLayer(rect)..picture = tint.endRecording());
    clip.append(backdrop);
    slot.append(clip);
  }

  void _paintSolid(ContainerLayer slot, RenderGlassSurface s, Rect rect) {
    final spec = s.spec;
    final rr = _rrect(spec, rect);
    final recorder = ui.PictureRecorder();
    final c = Canvas(recorder);
    _paintShadow(c, spec, rr);
    final base = spec.smoked ? ink : (_dark ? const Color(0xFF222326) : const Color(0xFFFBFAF6));
    c.drawRRect(rr, Paint()..color = base.withValues(alpha: spec.opacity));
    // Keep the object reading as a raised piece of material: a lit top edge
    // and a hairline, without any transparency.
    c.drawRRect(rr.deflate(0.5), Paint()
      ..shader = ui.Gradient.linear(rect.topCenter, rect.bottomCenter, [
        const Color(0xFFFFFFFF).withValues(alpha: (_dark || spec.smoked ? 0.16 : 0.9) * spec.opacity),
        const Color(0xFF000000).withValues(alpha: (_dark ? 0.25 : 0.08) * spec.opacity),
      ])
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1);
    slot.append(PictureLayer(rect.inflate(40))..picture = recorder.endRecording());
  }
}

class _Snap {
  _Snap(this.image, this.rect, this.signature);
  final ui.Image image;
  final Rect rect;
  final int signature;
}

/// A region of the overlay rendered as glass. Its child (icons, labels) is
/// painted on top of the glass.
class GlassSurface extends SingleChildRenderObjectWidget {
  const GlassSurface({super.key, required this.spec, super.child});
  final GlassSpec spec;

  @override
  RenderGlassSurface createRenderObject(BuildContext context) => RenderGlassSurface(spec);

  @override
  void updateRenderObject(BuildContext context, RenderGlassSurface renderObject) => renderObject.spec = spec;
}

class RenderGlassSurface extends RenderProxyBox {
  RenderGlassSurface(this._spec);
  GlassSpec _spec;
  RenderGlassScope? _scope;

  GlassSpec get spec => _spec;
  set spec(GlassSpec v) {
    if (v == _spec) return;
    _spec = v;
    markNeedsPaint();
  }

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    RenderObject? p = parent;
    while (p != null && p is! RenderGlassScope) {
      p = p.parent;
    }
    _scope = p as RenderGlassScope?;
  }

  @override
  void detach() {
    _scope = null;
    super.detach();
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    _scope?.notePainted(this);
    super.paint(context, offset);
  }
}
