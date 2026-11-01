# v1.3 compatibility and integration boundaries

Base: Academic 663b51d. No changes to Flutter, web/teacher, ClassIsland, QQ adapter, Space/main or production configuration.

| Surface | Preserved | Change / required client work |
|---|---|---|
| HAIZ accounts/session/classes/enrollment | IDs, hashes, cookie and endpoints | Failed-login limiter account-based; broad API/invite limiter still process-local and IP-based |
| SQLite assignments | IDs/content/dates/source/creator | Additive version/status/precision; v1 revision/event backfill, checksum check |
| Legacy teacher POST | Explicit direct confirmation | Atomic revision/event/receipt; without key no general retry dedupe; 04 move to v1 |
| Legacy student GET | Original fields and viewed boolean | Adds version/status/source; active states only; viewed resets per version |
| Legacy acknowledge | Original viewed/verifiedSubmission response | Records current version; cannot accurately report cached older version; use v1 |
| QQ intake / confirmation | Signed mentions stay review-only | Source dedupe; conflicting mapping rejected, transfer requires separately audited operation |
| Legacy ClassIsland screen | Same URL and basic fields | Adds id/version; no drafts/review/retracted; max12 unchanged; bearer v1 paginated |
| Offline teacher organizer | Files untouched | localStorage is not official publication; 04 integration needed |
| Student tasks/notes | Files/data untouched | Global-key P0 remains until 03 implements namespace/migration; teacher updates never write private work |

Existing Academic public/app.js remains a v1.3 direct-publish UI, not a v1.4 lifecycle editor. Browser verification found inherited new-class selection retains an object without status until reload; reload restores controls. Reported for 04, no cross-group UI rewrite. No browser UI for new revision/retract/sync states claimed.

Legacy lists omit retractions; v1 sync supplies tombstones. Unmodified v1.3 clients do not gain reliable automatic sync. Legacy screens keep path credentials; redact proxy access logs and migrate 06 to bearer. Native plugin may ignore additive id/version fields until updated.

Code and schema deploy together. v1.3 positional inserts cannot write v1.4 schema. Rollback: pre-upgrade verified backup before new writes; afterwards forward repair/schema-compatible build. No unrelated-history merge, CNAME/DNS/Pages or release artifact touched. Draft PR targets preview/haiz-academic-v1.3.

Production blockers: Flutter isolation/device QA; teacher lifecycle UI; ClassIsland Windows host; authorized QQ/school identity; backup/restore, privacy/retention/MFA and 01/10 review. Branch separation remains deliberate until selective monorepo migration is approved.
