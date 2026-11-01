# Pull synchronization and isolation · v1

GET /api/v1/sync?limit=100 starts an authorized snapshot. Response: instanceId/userId/authorizedClassIds, assignments or events, cursor, hasMore and state. Apply each page plus cursor in one local transaction. Follow until hasMore=false. No StudentTask private fields are sent.

Snapshot fixes a high-water sequence; pages use latest public event per resource at/before that point. Later edits arrive through delta. Delta returns ordered public events after cursor under current permission. Upsert by (instanceId,id) if version is newer. Repeated events are harmless. Retraction retains identity/version/status; hide active source, preserve private notes. Empty delta advances through unrelated events. Limit 1–200, default 100.

Opaque HMAC cursor binds persistent instance, user, permission fingerprint, sequence and snapshot boundary; survives restart. It is not an access credential. Every pull requires a current session. Another user or changed permission epoch invalidates it with 409 Revoked and no resource content, including revoke→restore. Response gives current authorizedClassIds for purge. Discard delayed responses from a prior local login generation.

Malformed/forged cursor: 400 Failed. Identity/scope change: 409 Revoked, resyncRequired. Position below retained floor: 410 Failed/CURSOR_EXPIRED, resyncRequired. Stage fresh snapshot; atomically replace only current official cache once complete. Remove inaccessible official content immediately; preserve private notes locked to owner, source unavailable. No automatic event pruning in v1.4.

| State | Meaning |
|---|---|
| Synced | Last authorized page applied, no queued command |
| Pending | More pages or queued commands; publication not assumed |
| Offline | Client network unavailable; show last sync time |
| Conflict | Stale version/key mismatch; retain draft and resolve explicitly |
| Revoked | Expired session/logout/changed permission; stop and hide official cache |
| Failed | Validation/server/cursor error; preserve personal work and show code |

Offline is client-observed. Mutation has expectedVersion and Idempotency-Key; stale command returns currentVersion, never silently merges. New resolved command requires new key and explicit preview.

## Group 03 mandatory cache contract

Namespace `haiz/v1/{normalizedHTTPSOrigin}/{instanceId}/{userId}`. Guest has separate installation identity. Resolve /identity before opening store. Logout closes store, cancels requests, clears in-memory data/cursor/queued commands/session and increments login generation. New account never sees prior namespace. Server replacement/origin change creates a new namespace.

Quarantine old global pocket.*.v1 data into a guest/local archive with backup and migration marker. Do not silently assign to first login. Explicit owner-confirmed copy/import, verify before archive cleanup. Failure keeps original bytes with recoverable error. Permission purge must not delete private notes. Device encryption and actual isolation implementation/testing belong to 03; this document does not fix v1.3's P0.
