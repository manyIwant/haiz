# v1.4 data model

Assignment: stable UUID id, immutable classId, subject/title/details, due, duePrecision (none/date/minute), createdBy/createdAt/updatedAt, integer version, status (draft/review/published/revised/retracted), source kind and optional intake ID. Minute due requires ISO timestamp with explicit offset; date is a calendar date. Identity across servers is (instanceId,id).

AssignmentRevision: append-only (assignment_id,version), actor, operation, timestamp, full snapshot and changedFields. Consecutive snapshots reveal old due and changes. Every edit/transition increments version. Draft → Review → Published → Revised → Retracted; review edits return to draft; retracted is terminal. Students see public revisions only while authorized.

StudentTask: client-owned UUID, owner namespace, source {instanceId,assignmentId,receivedVersion}, planning/completion/notes/focus/reminders. No private-cloud table or upload endpoint is introduced. Teacher commands never overwrite these fields. Source retraction marks unavailable and hides official listings, preserves private work.

Acknowledgement: (assignment_id,user_id,version), viewedAt. Exact public revision, viewed only, never completion/submission. Preserve old rows and backfill v1 reports. Current student may see their own viewed versions; class owner/admin may query class reports.

SyncEvent: SQLite AUTOINCREMENT sequence, type, class scope, resourceId/version, occurredAt, immutable public snapshot, command key. Draft/review never enter public stream. Assignment/revision/event/receipt commit together. No external sync-event injection endpoint.

IdempotencyReceipt: (user_id,route,key), canonical payload digest, original status/result. Same payload replays; changed payload conflicts. Recheck current permission before replay. No automatic receipt eviction.

Metadata: persistent instance UUID, cursor secret and event retention floor. Persisted user permission epochs increment on membership mutations, including revoke→restore. Cursor fingerprint also includes role/teacher ownership. Disaster restore to an earlier timeline requires instance/secret rotation.

Migration 001 adds columns/tables without changing IDs or deleting existing rows. Existing assignments become published v1 with revision/event; legacy acknowledgements become v1 reports. schema_migrations records checksum/time. SQL/backfill/checks are one transaction. Failure rolls back and startup stops. See MIGRATION-ROLLBACK.md.
