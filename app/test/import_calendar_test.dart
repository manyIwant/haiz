import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/domain/calendar_export.dart';
import 'package:haiz_pocket_flutter/domain/notice_import_service.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';

void main() {
  test('DOCX extracts paragraphs in reading order', () {
    const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:body><w:p><w:r><w:t>数学周五提交练习册</w:t></w:r></w:p>'
        '<w:p><w:r><w:t>物理明天交实验报告</w:t></w:r></w:p></w:body></w:document>';
    final archive = Archive()..addFile(ArchiveFile.string('word/document.xml', xml));
    final data = Uint8List.fromList(ZipEncoder().encode(archive));
    expect(NoticeImportService.extractDocx(data),
      '数学周五提交练习册\n物理明天交实验报告');
  });

  test('calendar export includes pending dates, never invents exact hours', () {
    const tasks = [
      TaskItem(id: 'a', title: '完成数学作业', subject: '数学',
        dueIso: '2026-10-29', source: '教师整理（未验证）'),
      TaskItem(id: 'b', title: '交物理报告', subject: '物理',
        dueIso: '2026-10-30', completed: true),
      TaskItem(id: 'c', title: '日常阅读', subject: '语文'),
    ];
    final text = CalendarExport.generate(tasks,
      generatedAt: DateTime.utc(2026, 10, 27, 14, 0));
    expect(text, contains('BEGIN:VCALENDAR'));
    expect(text, contains('DTSTART;VALUE=DATE:20261029'));
    expect(text, contains('DTEND;VALUE=DATE:20261030'));
    expect(text, contains('SUMMARY:数学 · 完成数学作业'));
    expect(text, isNot(contains('交物理报告')));
    expect(text, isNot(contains('DTSTART:20261029T')));
  });

  test('source original notice remains after local JSON serialization', () {
    const task = TaskItem(id:'x',title:'交数学作业',subject:'数学',
      source:'图片OCR', originalNotice:'数学明天上交作业');
    final restore = TaskItem.fromJson(task.toJson());
    expect(restore.originalNotice, '数学明天上交作业');
    expect(restore.source, '图片OCR');
  });
}
