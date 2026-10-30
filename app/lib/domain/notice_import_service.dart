import 'dart:convert';

import 'package:archive/archive.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:xml/xml.dart';

/// Local extraction. No extracted text or picture is sent to a remote model.
/// Caller must put output through the editable human-confirmation workflow.
class NoticeImportService {
  static const maxBytes = 12 * 1024 * 1024;
  static const maxCharacters = 28000;

  static Future<(String, String)?> pickAndExtract() async {
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: const [
        'txt',
        'md',
        'csv',
        'docx',
        'pdf',
        'png',
        'jpg',
        'jpeg',
      ],
    );
    if (file == null) return null;

    final extension = file.name.split('.').last.toLowerCase();
    final size = file.lengthSync() ?? await file.length();
    if (size != null && size > maxBytes) {
      throw StateError('文件超过 12 MB，请选一页截图或更小的文档。');
    }

    if (['png', 'jpg', 'jpeg'].contains(extension)) {
      if (kIsWeb) {
        throw UnsupportedError('截图离线 OCR 暂时只在 Android / iOS App 支持。');
      }
      final path = file.path;
      if (path == null || path.isEmpty) {
        throw StateError('无法读取截图的本地路径。');
      }
      final recognizer = TextRecognizer(script: TextRecognitionScript.chinese);
      try {
        final result = await recognizer.processImage(
          InputImage.fromFilePath(path),
        );
        if (result.text.trim().isEmpty) {
          throw StateError('图片中未识别到文字，可以手动输入或换一张清晰截图。');
        }
        return ('截图 · ${file.name}', _limit(result.text));
      } finally {
        await recognizer.close();
      }
    }

    final bytes = await file.readAsBytes();
    if (bytes.length > maxBytes) {
      throw StateError('文件超过 12 MB，请先缩小文件。');
    }

    switch (extension) {
      case 'txt':
      case 'md':
      case 'csv':
        return (
          '文档 · ${file.name}',
          _limit(utf8.decode(bytes, allowMalformed: true)),
        );
      case 'docx':
        return ('Word · ${file.name}', _limit(extractDocx(bytes)));
      case 'pdf':
        return ('PDF · ${file.name}', _limit(await extractPdf(bytes)));
      default:
        throw UnsupportedError('暂不支持此文件格式。');
    }
  }

  static String _limit(String value) =>
      value.length > maxCharacters ? value.substring(0, maxCharacters) : value;

  static String extractDocx(Uint8List bytes) {
    final archive = ZipDecoder().decodeBytes(bytes);
    final file = archive.findFile('word/document.xml');
    if (file == null) throw const FormatException('这不是有效的 .docx 文档。');
    final content = file.content;
    final xmlText = utf8.decode(content, allowMalformed: true);
    final xml = XmlDocument.parse(xmlText);
    final paragraphs = xml.descendants
        .whereType<XmlElement>()
        .where((e) => e.name.local == 'p')
        .map(
          (p) => p.descendants
              .whereType<XmlElement>()
              .where((e) => e.name.local == 't')
              .map((e) => e.innerText)
              .join(''),
        )
        .where((s) => s.trim().isNotEmpty);
    return paragraphs.join('\n');
  }

  static Future<String> extractPdf(Uint8List bytes) async {
    // PDFium extracts selectable text. Scanned-only PDF needs image OCR.
    final doc = await PdfDocument.openData(bytes);
    try {
      final chunks = <String>[];
      for (final page in doc.pages.take(24)) {
        final text = await page.loadText();
        if (text != null && text.fullText.trim().isNotEmpty) {
          chunks.add(text.fullText);
        }
      }
      if (chunks.isEmpty) {
        throw StateError('这是扫描版或没有可选择文字的 PDF。请导入清晰截图识别。');
      }
      return chunks.join('\n');
    } finally {
      await doc.dispose();
    }
  }
}
