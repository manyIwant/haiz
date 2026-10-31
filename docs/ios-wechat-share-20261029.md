# HAIZ Pocket — iPhone share-to-inbox (2026-10-29)

## What this actually implements

This is a **user-invoked iOS Share Extension** for text/URLs offered by a host app's system share sheet. It **cannot listen to WeChat automatically**, read another app's notifications, access WeChat history, or work while WeChat notifications are turned off without the user sharing. Apple's app isolation forbids arbitrary third-party message surveillance. There is no background WeChat reader.

The existing Android version keeps its optional, locally filtered **notification** receiver. If WeChat notifications are turned off on Android, new notifications are not available to HAIZ; the previously implemented user-initiated Android Share Sheet import remains available.

## User experience on iOS

1. In an app which exposes iOS system Share, select a text item or a URL, then select **存入 HAIZ 收件**.
2. The Share Extension stores up to 4000 characters per item in a device-local shared App Group queue (up to 60 pending items; 7-day dedupe record).
3. Open HAIZ Pocket → 收件 → 提取并审核 → manually correct task title, subject and date → 确认并加入我的任务.
4. If a WeChat view doesn't expose iOS system Share for that item, copy the text and paste into HAIZ 收件 instead. Some WeChat share workflows may not invoke the system Share Sheet at all.

**Privacy:** No silent access to WeChat; no extraction of history. The label is **iOS 分享 · 用户主动**, not a verified platform/source identity. Any application can share content to this extension; treat it as an unverified candidate. No upload of user-shared text.

## Signing/build requirements

- Runner and HaizShareExtension have App Group entitlement `group.space.haiz.pocket` so they share local UserDefaults data.
- Enable exactly that App Group in the Apple Developer portal for both App IDs. Supply a valid Apple team and provisioning profiles for the two targets; adjust group ID if your team requires another unique identifier (update Swift and both entitlements consistently).
- The extension bundle ID is `space.haiz.haizPocketFlutter.HaizShareExtension`. A clean Xcode archive must embed `HaizShareExtension.appex` into the host app's PlugIns folder.
- This Mac currently only has Xcode Command Line Tools, so an iOS IPA and real-device UI have **not** been built or verified.
- Validate the share target in full Xcode, test a system-share source, app background/closed state, App Group queue persistence, deletion, signing, and an iPhone reboot.

## Engineering notes

- `app/ios/HaizShareExtension/ShareViewController.swift`: native Share Extension handling user-shared text and URL items, local bounded queue, dedupe and errors.
- `app/ios/Runner/HaizShareIntakePlugin.swift`: Flutter MethodChannel, reading and acknowledging user-shared candidates.
- `app/lib/domain/message_intake_bridge.dart`: iOS support for shared inbox; notification monitoring remains Android-only.
- `app/lib/ui/inbox_page.dart`: iPhone source guidance and review UI, Android-only monitoring panel.
- `app/test/message_intake_workflow_test.dart`: platform channel workflow using fake records, not a physical-device integration test.

A truly automatic, notifications-off, cross-device integration would require a **separately authorized source** (for example, a supported institutional event webhook). Personal WeChat group history has no general official third-party listener interface.
