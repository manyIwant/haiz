# HAIZ Pocket · message-to-task intake (2026-10-29)

This branch implements the previously discussed QQ/DingTalk/Xuexitong-to-task workflow in the independent HAIZ Pocket Flutter Android app.

## Supported, working interfaces

1. Android share sheet: select text from another app, tap **分享 → HAIZ Preview**. A native `ACTION_SEND text/plain` receiver places the shared text into HAIZ's device-local inbox. Cold launches and warm share intents bring the user to the Inbox screen.
2. Explicit opt-in Android notification monitoring: in HAIZ Inbox enter one or more school-group name keywords (minimum 2 characters), choose **保存并开启监测**, then grant Android **Notification Access** to HAIZ. The native `NotificationListenerService` recognizes only listed source package names (QQ, TIM, WeChat, DingTalk, Xuexitong), requires the notification title to contain a specified school-group keyword, and requires an action-related term. All unrelated notifications are discarded immediately. The system permission is broad, even though the implementation filters locally.
3. Shared texts / notifications join a durable on-device queue with 60-item bounded retention and a 7-day / 160-item duplicate detector. The app does not upload messages or log in to third-party services.
4. From **收件** select a message, run the existing local notice parser, inspect/edit subject, title and due date, and explicitly confirm task creation. The source notice and provenance are retained with the task. After successful local save the native entry is acknowledged. Dismiss is also available. Date-relative phrasing is anchored to original receipt date.
5. Manual paste, TXT, DOCX, PDF and Android image OCR remain supported; the browser version only supports those formats its platform can actually process.

## Security / authorization

- Notification monitoring is **off by default**. The user must configure source group names *and* grant the system permission separately; Android settings can revoke it at any time.
- No arbitrary personal chats are ingested by design; an exact group name match is required. A group/title formatting change or hidden notification preview may prevent capture.
- No fake teacher authentication. Extracted messages are unverified candidates and must be manually approved. Do not submit student names or private group messages unless you are permitted to process them.
- WeChat group-notification intake is supported through Android Notification Access only. It neither logs in to WeChat nor reads its database or chat history; notification presentation varies by client/version. Metadata matching cannot conclusively distinguish groups from private chats, so users should select distinctive allowlist keywords.
- No QQ Bot, WeChat account, DingTalk API, Xuexitong API or ClassIsland integration is claimed. Official account/SDK integrations still require the provider's authorization and school governance.
- Device-local notification queue belongs to the app installation, not to any verified school account; other people sharing that device/app could see its pending items. Only enable it on a device you control.
- The native queue lives in Android app-private SharedPreferences, not encrypted backup. System/device backups may still apply. Disable and revoke notification access if you no longer want monitoring.
- No historical messages are read, only new system notifications, and the native code never reads app-private databases.

## Verification

- `flutter analyze` clean.
- Prior personal-store and UI smoke tests remain green.
- New `message_intake_workflow_test.dart` exercises MethodChannel transport and user-confirmed local persistence / source acknowledgement in a simulated Android environment.
- Android release and Flutter Web build should be separately verified in CI and on a real phone; native notification access behavior requires a physical-device test and explicit permission.

## Open issues before a stable release

- Mobile OS permissions, app-specific notification formatting and OEM battery policies vary.
- No real-device notification event was generated in these automated tests.
- Full v1.4 QA has unrelated outstanding failures; not represented as stable.

## WeChat-specific notes (2026-10-29)

- Package allowlist includes `com.tencent.mm` after explicit on-device opt-in.
- A candidate requires an action word and one configured group keyword matching the Android notification title, conversation title or subtext. The message **body is never used to identify a group**. Android's system permission is broader than HAIZ's local filter.
- Aggregated/group-summary notifications are discarded to reduce exposure to unrelated chats. Hidden notification previews, disabled WeChat notifications or OEM background restrictions can prevent collection; no promise of complete capture.
- WeChat's Windows encrypted local database reader from the reference project was not ported. This implementation does not scan memory, scrape account data or automate logins.
- Native unit tests cover selected WeChat group, non-selected chat, body-only mention, irrelevant content, wrong app and empty allowlist. Physical-device notification behavior is **not yet verified**.
