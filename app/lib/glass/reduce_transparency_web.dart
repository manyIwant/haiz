import 'dart:js_interop';

@JS('matchMedia')
external _MediaQueryList _matchMedia(String query);

extension type _MediaQueryList(JSObject _) implements JSObject {
  external bool get matches;
}

/// The browser's `prefers-reduced-transparency` media feature (Chromium 118+;
/// browsers without it simply report false).
bool prefersReducedTransparency() {
  try {
    return _matchMedia('(prefers-reduced-transparency: reduce)').matches;
  } catch (_) {
    return false;
  }
}
