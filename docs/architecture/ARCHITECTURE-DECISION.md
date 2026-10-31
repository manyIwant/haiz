# ADR-0001 · Academic is the authoritative assignment service

Date: 2026-10-27 · Status: accepted for v1.4 implementation; production release requires 01/10 review.

## Context and evidence

Academic v1.3 is `663b51d`; Space/main is `55638e8`. Local `git merge-base` returns no ancestor. The four 01-group audit reports on `audit/haiz-v1.3-20261027` were read before implementation. Academic already owns accounts, enrollment approval, SQLite assignments, QQ intake and screen credentials. PR [manyIwant/haiz#20](https://github.com/manyIwant/haiz/pull/20), head `7056273`, targets `feat/haiz-lucent-integration`, uses a separate JSON store and cannot be treated as an Academic migration.

## Alternatives

| Option | Complexity | Migration risk | Consistency | Maintenance | Pages | Open source/deployment |
|---|---|---|---|---|---|---|
| A. Independent Academic service and versioned API, preserve both histories in the existing repository | Low/medium; additive SQL and adapters | Low; no unrelated-history merge | One SQLite authority, transactional events | One backend, separate client adapters | No change to main or Pages | Node 24.22+, local SQLite, reverse proxy; independently deployable subtree |
| B. Selectively build a shared monorepo on main with imported Academic paths and new CI | High; explicit license/source/path migration | Medium/high; Pages and release packaging need regression | Equally strong if same API owns data | Easier discovery later, substantial initial coordination | Must restrict static artifact paths and CI triggers | Feasible after source/license mapping and QA |
| C. Keep both assignment databases and bridge their writes | High | High; identity mapping and divergent histories | Conflict with two authorities | Two permission and recovery systems | Little immediate impact | Reject: doubles operational and security burden |

## Decision

Choose A. Keep the repository as a coordination location with independent release histories for now; do not force-merge or claim a unified source tree. Academic, App and connected teacher Web should eventually share versioned contracts and may share a monorepo after a deliberate selective migration. Space does not need their runtime or database. This branch is based on Academic preview and its Draft PR targets that branch.

Academic SQLite owns Assignment identity, official versions, publication, retraction and authorization. Clients identify an assignment by `(server instanceId, assignment.id)`; classId is immutable. Local import IDs, titles and QQ message IDs are not assignment identities. Student Task owns personal planning, completion, notes, focus and reminders; its optional source link is `(instanceId, assignmentId, receivedVersion)`. No teacher command writes Student Task.

The server adjudicates versions, lifecycle, memberships, acknowledgements and event order. Acknowledgement proves only a student's report of viewing a particular public version. ClassIsland needs only a revocable read-only projection of active published/revised assignments: no members, publisher identity, notes, drafts or acknowledgements.

Use additive SQLite migrations, full immutable revision snapshots, synchronous short `BEGIN IMMEDIATE` transactions, optimistic version checks and durable idempotency receipts. State, revision, event and receipt commit together. Pull sync is sufficient; SSE/WebSocket is deferred. Signed cursors bind instance, user, authorization fingerprint and sequence. Current permissions are checked before replay and every read.

## Consequences and boundaries

- Existing accounts, classes, assignment IDs, acknowledgements and integration data remain; old assignments become published version 1.
- Existing v1.3 direct publish remains an explicit teacher-confirmed compatibility operation. New v1 clients use draft → review → publish.
- The offline teacher organizer remains an offline localStorage tool until group 04 implements the API; its classroom page is not an official feed.
- Flutter isolation is group 03's work. Contract delivery does not fix global SharedPreferences keys; real student use remains blocked until that change and device QA pass.
- Single-node SQLite is intentional. Backups, migrations, event retention and independent security review remain operational obligations. No production database, DNS, school SSO or real QQ credentials are touched.
- No private study-data upload endpoint is introduced. Account-scoped local storage is mandatory even while offline.

See DATA-MODEL.md, SYNC-PROTOCOL.md, API-CONTRACT.md, PR20-REUSE.md and MIGRATION-ROLLBACK.md. The task brief authorizes this decision and staged commits; no additional per-step confirmation is required.
