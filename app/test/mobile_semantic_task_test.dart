import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/domain/notice_parser.dart';

void main() {
  test('same class task yields the same proposal key across app restarts', () {
    const task = NoticeCandidate(
      title: '完成实验报告',
      subject: '物理',
      due: null,
      source: '通知',
      original: '物理作业今晚完成实验报告',
      ambiguous: true,
    );
    const sameTaskOtherSource = NoticeCandidate(
      title: '完成实验报告',
      subject: '物理',
      due: null,
      source: 'AI 语义解析',
      original: '另一个群转发物理作业',
      ambiguous: true,
    );
    expect(noticeProposalKey(task), noticeProposalKey(sameTaskOtherSource));
    expect(noticeProposalKey(task), matches(RegExp(r'^mobile_[0-9a-f]{8}_[0-9a-f]{8}$')));
    expect(noticeProposalKey(task),
        isNot(noticeProposalKey(const NoticeCandidate(
          title: '完成实验报告第2部分',
          subject: '物理',
          due: null,
          source: '',
          original: '',
          ambiguous: true,
        ))));
  });

  test('semantic results still require evidence and reviewed due dates', () {
    final local = NoticeParser.parse('数学明天交练习册第12页。',
      today: DateTime(2026, 10, 29));
    expect(local, hasLength(1));
    expect(local.first.due, DateTime(2026, 10, 30));
    expect(local.first.ambiguous, isFalse);
  });
}
