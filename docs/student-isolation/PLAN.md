# MISSION 03 / Phase 1 — Student isolation

## PRD

Fix audit I-002 on `preview/haiz-academic-v1.3` (663b51d). A device guest and each verified student on each server installation own distinct local tasks, notes, courses, focus history and active task. No full v1.4 sync or UI redesign. No changes to services/academic, teacher Web or ClassIsland.

Success: A → logout → B shows none of A's personal records. Reverified A recovers A's records. Upgrade preserves every legacy value without silently assigning it to a login.

## Architecture / system design

- Application owns one PocketStore and one AcademicSession. Session identity survives page navigation but credentials are memory-only; cold start always opens installation guest.
- Account namespace: `haiz/v1/{encoded normalized HTTPS origin}/{encoded instanceId}/{encoded userId}`. Guest: `haiz/guest/v1/{installationId}`. Validate the backend's `cacheScope` against `haiz/v1/{instanceId}/{userId}`; do not use it alone as a namespace.
- `/api/auth/login` is followed by `/api/v1/identity`. Never open an account using a user-entered name, guessed user id, or fallback legacy endpoint. Fail closed if identity is unsupported or malformed.
- Increment storage/session generations at transitions, clear private and official memory immediately, cancel focus timers and close obsolete HTTP clients. Persist already accepted writes to their captured original namespace in order. Ignore delayed HTTP/file/dialog results from an earlier generation.
- Personal state is a single versioned JSON document per namespace. Official assignments stay separately in session memory. Manual confirmed import creates a personal copy with source identity, never updates teacher data and never writes personal notes back to the server.
- Scope revocation clears official content. Full session revocation closes the account view. Local owner notes remain on disk; no destructive account purge.

## Technical document: migration

- Read exact original strings for `pocket.tasks.v1`, `pocket.courses.v1`, `pocket.focus.v1`, `pocket.taskNotes.v1`, `pocket.activeTask.v1`, `pocket.appearance.v1`.
- Copy into `haiz/legacy/v1/archive`, read back and compare, then write completion marker. Preserve all original keys and archive forever in Phase 1, including malformed bytes. Never fall back to sample data after a decode error.
- No automatic visibility of historical personal data in guest or any account. A verified owner must explicitly confirm an import. Validate the whole archive before any destination write, merge nonconflicting IDs, verify destination, then record claimed destination. Retry interrupted import idempotently. A different account cannot claim an already claimed archive.
- Corrupt or unavailable storage produces a visible recoverable error and blocks writes; it must not replace records with empty/demo content. SharedPreferences provides application isolation, not encryption or guaranteed disk durability. Original keys plus verified archive mitigate migration failures; physical backups/encryption remain separate release work.

## Task list and tests

Research completed directly from GitHub: all four reports on audit/haiz-v1.3-20261027; PR21 API-CONTRACT, SYNC-PROTOCOL and exact api/sync implementations at b308312. Reviewed Flutter shared_preferences primary package docs and GitHub implementation examples.

1. Write RED storage and session regression tests.
2. Implement scoped persistence, verified archive and explicit import.
3. Implement app-level identity/session lifecycle, request cancellation and UI generation guards.
4. Run unit/widget/integration flow tests, analyzer and coverage. Review security and Flutter correctness independently; fix and rerun relevant tests.
5. Record changed files, actual test evidence, pending Android physical-device verification and risks. Create independent Draft PR against preview baseline.

## Dependencies and risks

PR21 identity contract is draft. Phase 1 intentionally requires that endpoint and fails safely on the old v1.3 server. No backend branch is merged. Browser Academic login remains unsupported as before; native cookie behavior is tested through HTTP fakes until real Android validation. No real device or cross-process durability claim follows from simulated tests.
