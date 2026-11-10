import 'dart:typed_data';

Future<String> recognizeScreenshot(Uint8List bytes) =>
    Future.error(UnsupportedError('网页 OCR 仅在 Web 环境可用'));

String webOcrStatus() => '';

void cancelWebOcr() {}
