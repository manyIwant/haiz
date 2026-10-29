# HAIZ Pocket · functional workflow hardening (2026-10-29)

Follow-up to #27 based on hands-on user feedback that the optical preview looked polished but was not yet functionally mature.

## Implemented

- Create/edit real local tasks with title, subject and optional due date.
- Preserve task identity, completion, original imported notice and private notes during edits.
- Four task views: pending, date reminders (overdue and upcoming), completed, all; sort by due date.
- Human-friendly overdue/today/tomorrow labels without inventing school data.
- Undo destructive task deletion for five seconds; safely restrict undo to the same store generation. Restore private note and active-focus link.
- Preserve the existing focus handoff from every task.
- Move PocketSkin above the MaterialApp Navigator to make palette available in sheets and dialogs. The previous nested skin caused runtime null exceptions when opening task sheets.
- Keep browser data local and maintain the nonofficial school disclaimer.

## Automated verification

- Flutter analyzer: no issues.
- 17 targeted unit and widget tests pass, including a mobile-size complete journey: create → edit → complete → delete → undo.
- Flutter Web release builds and is exercised with browser screenshot/console checks.
- Other legacy QA blockers from the v1.4 branch remain independent and are NOT claimed as resolved.

## Still not production complete

- Long-running focus sessions are not restored reliably across process/browser termination.
- Schedule entry editing (beyond add/remove), cloud sync, and real official school integrations require their own validation.
- Android shader fidelity/performance must be verified on a physical device.
- Preview data is browser-local, not shared with the APK.
