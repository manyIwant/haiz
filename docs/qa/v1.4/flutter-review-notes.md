# Group 10 independent Flutter storage fault review

Date: 2026-10-27. Product inputs: PR 21 `b308312a8f5d8387c66e319c642223b399440a3f`, PR 22 `b65c783ddd216193b39e44daec3a5841a6bb3813`; isolated QA integration HEAD `a03da32` at start of review. Tests use only fictional records and in-memory SharedPreferences on macOS / Flutter 3.47.8 / Dart 3.13.7. This is not Android filesystem evidence.

## Actual result

`flutter test --no-pub --reporter expanded test/qa_storage_fault_test.dart`: **3 PASS, 2 FAIL**, exit 1. Full output: `evidence/flutter-faults.log`. No product source changed. Both failing desired invariants remain enabled; no swallowed framework exceptions, sleeps, skipped tests or weakened old assertions.

## Confirmed blocker: migration interleaves with same-account edits and silently loses new work

Suggested ID: QA-STORAGE-01. **P0 under mission rubric (irrecoverable private-task loss).** Owner: group 03.

Code: `app/lib/core/pocket_store.dart:142` captures a full snapshot before joining `_pending`; `:191` computes `merged`, `:192` awaits archive ownership I/O; `:201-204` applies the earlier `merged` after asynchronous writes. New ordinary mutations remain writable during that await. Their queued snapshots are based on the pre-migration in-memory data. The queue serializes writes but does not serialize mutation/snapshot construction and the migration's final `_apply` together.

Deterministic reproduction (`qa_storage_fault_test.dart`, test QA-STORAGE-01):

1. Seed a fictional legacy task and open student A; add and flush a separate personal task.
2. Start confirmed import. A `Completer` in the preference fake blocks the first `setString(LegacyArchive.ownerKey, ...)`, precisely after `_mergeLegacy` has run.
3. While that ownership write is blocked, call `store.addTask` for a new private task. This queues an ordinary snapshot containing the old personal task and the new task, but no legacy task.
4. Release the gate; await import and `flush()`.
5. Actual in-memory titles: `[迁移前私人任务, 旧任务]`. The new private task is already missing from memory. Actual persisted titles: `[归属写入等待期间新增的私人任务, 迁移前私人任务]`. The legacy task and migration flag are missing from disk.
6. Call the ordinary `store.setAppearance('ocean')`; await `flush()`.
7. Persisted titles become `[迁移前私人任务, 旧任务]`: the newly created private task is removed from disk as well. `storageError` stays null. No original legacy key or archive contains that new private task, so those migration backups cannot recover it.

Expected: both memory and persistent document contain all three tasks; migration's `legacyImported` flag and private notes remain consistent. Actual: completed import loses concurrent private work silently after a subsequent routine save; restart loads the loss. Broader analogous mutations (notes, courses, focus logs) share the same snapshot mechanism, but those variants have not independently been reproduced here.

The log prints the before/after memory/disk titles before retaining a failing assertion. The gate uses `Completer`, not timing or sleeps. A likely repair must serialize all mutation/state application with migration, or block/queue ordinary edits while committing migration; merely checking account generation again does not resolve a same-account race. This is a suggestion, not an applied business patch.

## Confirmed validation defect: nonexistent date is accepted into migrated task

Suggested ID: QA-STORAGE-02. **P2**, group 03. `app/lib/core/personal_snapshot.dart:50-57` checks the format and `DateTime.tryParse`, which normalizes overflowing dates. `2026-02-31` therefore passes and is stored literally in `TaskItem.dueIso`.

Reproduction: seed `pocket.tasks.v1` with a valid-shaped task whose `dueIso` is `2026-02-31`; open A; explicitly import. Expected rejection before archive ownership/destination write and preservation of the raw bytes. Actual import succeeds, so the desired rejection assertion fails. This is not proof of account leakage or erased source bytes; originals remain preserved. Suggested validation is a parsed year/month/day equality check (or strict calendar parser), consistent with the backend's strict validation.

## Passing probes and rejected hypotheses

- QA-STORAGE-03: first queued personal write is held and throws; a second snapshot accepted before that failure still executes. `storageError` reports failure, but the final payload contains **all** accepted tasks. This is a recovery-state/UI inconsistency worth understanding; it is not evidence of lost data by itself and is not filed as a blocker here.
- QA-STORAGE-05: destination write throws after the archive has been claimed. Original bytes and owner remain, and A can retry successfully. No data loss reproduced.
- QA-STORAGE-04: switch to B while the already-started archive claim is held. B's visibility closes synchronously and B waits for the pending commit, then opens empty. Archive belongs to A and never appears in B. Unlike the pre-commit account-switch tests already in PR 22, this gate is **inside** the commit after the permission check; do not describe it as an unclaimed-archive test.
- An initially suspected missing global storage error UI is **not a defect**: `app/lib/main.dart:143-158` renders `store.storageError` across pages. `academic_page.dart:182` additionally surfaces it there. This was checked in actual source; no browser/device rendering claim.

## Scope boundaries

Read the actual PocketStore, AcademicSession, LegacyArchive, PersonalSnapshot, domain task model, main global error overlay, and existing migration/isolation tests. Did not duplicate the parent's Study Relay controller-lifetime finding. Did not edit backend, Flutter business implementation, helpers or original tests. No real disk-full, power-loss, Android device reboot, durable SharedPreferences flush guarantee or encrypted-storage assurance follows from these synthetic probes.
