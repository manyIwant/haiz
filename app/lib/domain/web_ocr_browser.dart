import 'dart:js_interop';
import 'dart:typed_data';

/// The only FFI boundary. All scripts, WASM and models are same-origin.
/// No screenshot is sent to an external OCR endpoint.
@JS('HAIZ_OCR.recognize')
external JSPromise<JSString> _recognizeWebScreenshot(JSUint8Array bytes);

@JS('HAIZ_OCR.status')
external JSString _getWebOcrStatus();

@JS('HAIZ_OCR.cancel')
external void _cancelWebOcr();

Future<String> recognizeScreenshot(Uint8List bytes) async {
  final result = await _recognizeWebScreenshot(bytes.toJS).toDart;
  return result.toDart;
}

String webOcrStatus() => _getWebOcrStatus().toDart;

void cancelWebOcr() => _cancelWebOcr();
