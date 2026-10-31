# Academic API · v1.4

Machine-readable source: openapi.json. Base /api/v1. Existing HttpOnly hsid cookie; same-origin Web/approved reverse proxy, HTTPS outside loopback. Native clients isolate their own sessions. No personal QQ login or assumed school identity.

Envelope `{state,data,error,meta}`: success error=null; failure data=null and error={code,message,...}. 401/403 Revoked, 409 Conflict or Revoked, 410 cursor expired, 429 throttled, 503 SQLite contention. No ambiguous success:true. Collections expose pagination metadata. Mutations require JSON and Idempotency-Key (8–100 ASCII letters/digits/_/-); existing resources require integer expectedVersion.

| Method/path | Contract |
|---|---|
| GET /identity | instanceId, userId, role, authorizedClassIds, cache scope |
| POST /classes/{classId}/assignments | Owner/admin creates Draft |
| GET /classes/{classId}/assignments | Teacher all states; student public only; limit/after |
| GET /assignments/{id} | Current authorized projection |
| PATCH /assignments/{id} | Draft edit/public revision; Review edit → Draft; retracted terminal |
| POST /assignments/{id}/review | Draft → Review |
| POST /assignments/{id}/publish | Review → Published; owner/admin confirms |
| POST /assignments/{id}/retract | Published/Revised → Retracted |
| GET /assignments/{id}/history | Teacher all; student public revisions only; paginated |
| POST /assignments/{id}/acknowledge | Student reports exact public version viewed |
| GET /assignments/{id}/acknowledgements | Owner/admin version-specific reports; paginated |
| GET /sync | Snapshot then delta; SYNC-PROTOCOL.md |
| POST /classes/{classId}/members/{userId}/revoke | Owner/admin revokes current member |
| GET /classroom | Authorization: Bearer screenKey; public id/version summary only |

Create/edit fields: subject/title/details/due/duePrecision. No client id/classId/creator/version/status/source/event. Due null+none, YYYY-MM-DD+date, ISO minute with offset+minute. PATCH preserves omitted fields. Lifecycle lowercase; sync state title case. Review is teacher checkpoint, not independent admin approval. Student membership grants no editing powers.

Permission precedes receipt replay. Receipts bind user+route+key+canonical payload, including expectedVersion. Conflict includes currentVersion. 04 can adapt PR20 three-way comparison but must re-preview and send a new guarded command; server never auto-merges.

03: account-scoped stores, login-generation cancellation, transactional cache/cursor, version upsert and retraction notice preserving notes. 04: server-confirmed publish only; localStorage organizer remains offline tool. 05: signed /api/integrations/qq/event creates intake only; teacher confirms legacy inbox publish, source dedupe prevents duplicate publication. 06: bearer classroom feed, public-only cache with freshness; legacy /api/screens/{key} stays compatible, rotate keys/redact logs. No physical-device receipt claimed.

Legacy POST /api/classes/{id}/assignments stays explicit direct teacher publication, now creates revision/event atomically. Optional key provides replay; without key duplicate requests are not guaranteed idempotent. New clients must use v1. Legacy lists/screens exclude draft/review/retracted. Legacy acknowledge without version records current public version with original response shape. See compatibility report for limits.
