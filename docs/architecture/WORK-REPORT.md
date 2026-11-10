# Mission 02 · v1.4 backend work report

2026-10-27 · feat/academic-backend-v1.4 · based on Academic preview 663b51d. ADR committed first as 40dd074. Main/Pages 55638e8 has no common ancestor. No forced merge, production DB, DNS, release or unrelated module edits.

## Implementation

One SQLite authority for official assignments. Stable IDs, draft/review/published/revised/retracted lifecycle, immutable actor/version snapshots and changed fields, version-specific viewed reports, CAS conflict and durable payload-bound idempotency. Assignment/revision/public event/audit/receipt commit atomically. StudentTask private data remains client-owned.

Persistent HMAC identity/scope cursors, fixed-watermark paginated snapshot, incremental public events, restart/offline resume, retraction tombstones, revoke/rejoin invalidation and safe expired-cursor resnapshot. Current permissions checked before replay. Classroom bearer projection exposes public id/version/content only, no member/private/source/publisher fields.

Additive checksummed migration preserves existing users/classes/assignment IDs/acknowledgements and backfills v1 revisions/events. Failure rolls back and startup stops. Rollback runbook covers consistent backups and forward repair after new writes.

Read all four 01 audit reports and PR20 code. Reused authorization-before-replay, content-bound idempotency, optimistic versions and public filtering with SQLite; did not import the separate JSON store or experimental history. See PR20-REUSE.md.

## Verification

- Original comprehensive Academic HTTP test passed before edits.
- TDD RED: 18 new lifecycle/identity/offline scenarios failed on old server with expected missing v1 routes.
- 51/51 backend tests pass: 18 lifecycle, 15 security, 9 storage/migration, 8 OpenAPI/real-response checks, 1 legacy comprehensive integration.
- Final coverage after cleanup: lines 97.78%, branches 86.87%, functions 98.95%.
- QQ adapter 2/2 synthetic tests pass; no real QQ service connection.
- npm audit 0 known vulnerabilities after Ajv dev dependency upgrade to 8.20.0. No third-party runtime dependency.
- Browser preview verified existing UI login, class creation/reload and actual v1 identity/snapshot reads. Unauthenticated /api/me 401 is expected. Inherited new-class status selection issue requires reload; recorded for 04.
- Independent inherited-model review found delayed-body session revocation, QQ mapping takeover, Unicode cursor validation and login-budget concentration. Fixed and independently reproduced; durable regressions added.
- Standard ECC planner/architect/build/security/code/JS agents could not start due configured provider authentication 403. Inherited-model review/test agents ran successfully; unavailable reviews are not reported passed.

Initial implementation failures: SQL quote parse and legacy undefined SQLite binding, fixed; corrupt-FK fixture setup corrected; internal database error code sanitized. Initial coverage omitted abruptly terminated child service work; graceful shutdown now records it. No known current failing test. No GitHub CI result claimed before a workflow runs.

## Changed files

Committed scope: services/academic and docs/architecture only. Backend: server.mjs, api.mjs, commands.mjs, model.mjs, migrate.mjs, sync.mjs, migrations/001-versioned-assignments.sql, package.json/lock, README.md, test.mjs and tests/{helpers,v1,security,storage,contract}.mjs. Architecture: ARCHITECTURE-DECISION, DATA-MODEL, SYNC-PROTOCOL, API-CONTRACT, openapi.json, MIGRATION-ROLLBACK, PR20-REUSE, COMPATIBILITY-V1.3 and WORK-REPORT. A local preview launch entry outside the repo used a synthetic temporary database; no credentials from it are committed.

## Handoff

| Group | Required integration |
|---|---|
| 03 Flutter | Cache by HTTPS origin/instanceId/userId; quarantine legacy keys; cancel prior login-generation responses; apply page+cursor atomically; preserve personal fields. Existing P0 remains until implemented/device-tested. |
| 04 Teacher Web | v1 draft/review/publish/edit/retract with key/version; explicit conflicts; official classroom reads same authority. Offline organizer remains offline. Fix inherited new-class selection status issue. |
| 05 QQ | Authorized official signed relay → pending intake → human confirmation. Source dedupe; no casual reassignment of existing group mapping, audited transfer needed. |
| 06 ClassIsland | Bearer public projection, id/version cache, freshness/offline, credential rotation purge; Windows host validation. No member/private data or physical-render proof. |
| 01/10 | Review Draft PR against Academic preview; independently exercise mission scenarios, migration/restore and real clients before release. |

## Technical debt and release limits

Tested backend foundation, not a completed school system. Flutter account isolation, connected v1 teacher UI, Windows ClassIsland/Android/iOS devices, authorized QQ/school identity and cross-product E2E were not executed here. Private-note preservation test is a client contract simulation, not Flutter verification.

No automatic event/receipt pruning, multi-node writer, SSE, independent admin approval workflow, private-cloud study sync, recovery/MFA, managed backup scheduler or admin QQ transfer UI. Rate counters are process-local; broad IP limits aggregate behind a proxy and require deployment sizing. Full monorepo migration remains separately reviewed. Legacy router is below 800 lines but its large handler is maintainability debt.

Production requires 03 P0 repair, 04/06 integration, 01 security + 10 QA, backup/restore drills, retention/privacy/incident process, HTTPS secure-cookie proxy configuration and school approval before real school data. This report authorizes no formal release or merge.
