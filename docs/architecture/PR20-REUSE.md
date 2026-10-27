# PR20 reuse

Reviewed manyIwant/haiz#20 head 70562734759c4f39157f4440bb99dd68d1b6fd8c against Academic 663b51d. Read assignment command/store, homework-core assignment rules, draft-merge helper/tests and PR file list. Prior CI is not v1.4 proof.

| Prior design | Port into Academic | Boundary |
|---|---|---|
| Role/scope/owner check before replay | Current class owner/admin permission on every command | No username-based scope list |
| Request key + content digest + original result | Durable user/route/key SQLite receipt with canonical digest | Transaction replaces temp-file rename; no receipt eviction |
| Expected version conflict | Strict integer expectedVersion with guarded write | No coercion/silent overwrite |
| Review/withdrawn public filtering | Explicit five-state lifecycle | Draft/review cannot leak |
| Immutable commands | Append-only revisions/events | No 500-item truncation |
| PublicRows excludes actor | Classroom field whitelist, stable id/version | No member/actor/source/private data |
| Three-way comparison / missing-base conservatism | 04 handoff, conflict response | UI stays outside 02, server never auto-merges |
| Session/digest display receipts | Deferred 06/10 | Not student viewed or physical-display proof |

Reuse tests: concurrent same-base edits, replay after revocation, same key/different payload, public revision/retraction and offline resume. Additional tests cover SQLite migration failure, restart, cursor paging/account switch/revoke→restore, exact-version acknowledgement and contention. No complete experimental branch or unrelated histories merged.
