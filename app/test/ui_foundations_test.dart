import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';

void main() {
  test('functional spacing follows the shared 8pt scale', () {
    expect(PocketSpace.xxs, 4);
    expect(PocketSpace.xs, 8);
    expect(PocketSpace.sm, 16);
    expect(PocketSpace.md, 24);
    expect(PocketSpace.lg, 32);
    expect(PocketSpace.xl, 48);
    expect(PocketSpace.dockClearance % 8, 0);
    expect(GlassDock.icons, GlassDock.selectedIcons);
  });

  testWidgets('functional headings and captions have explicit type roles', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: PocketSkin(
          colors: PocketPalette.forName('porcelain'),
          child: const Scaffold(
            body: Column(
              children: [
                PageTitle(title: '今天', subtitle: '校园学习日程'),
                Eyebrow('UP NEXT'),
                SectionLabel('待办'),
              ],
            ),
          ),
        ),
      ),
    );

    final title = tester.widget<Text>(find.text('今天'));
    final eyebrow = tester.widget<Text>(find.text('UP NEXT'));
    final section = tester.widget<Text>(find.text('待办'));
    expect(title.style?.fontSize, PocketType.pageTitle);
    expect(eyebrow.style?.fontSize, PocketType.micro);
    expect(section.style?.fontSize, PocketType.section);
    expect(tester.takeException(), isNull);
  });
}
