## HAIZ v1.4 independent QA — FAIL

PR21/22 integrated at `a03da324386b17d305e6a3698adc21f2b4bcf905` preserve both original parent histories. This Draft PR adds QA-only tests, repeatable synthetic fixtures, CI and five reports. It does not approve merging the product PRs or creating a Release.

A deterministic same-account legacy-import race loses a newly created private task after a routine subsequent save, without reporting a storage error (**QA-STORAGE-01, P0**). Original legacy bytes cannot recover that new task. Desired regression tests remain failing; no business implementation or original tests were changed.

### Independent results

- Backend: **63/63**, line97.78% / branch88.30% / functions98.95%.
- Original Flutter baseline: **67 passed, 4 live skipped**.
- Flutter with QA: **78 passed, 4 failed, 5 live skipped**; line coverage **76.54%**, below80%.
- Actual Flutter HTTP client: **5/5** separately against disposable SQLite/loopback service; analyze0issues.
- QQ: existing2 + synthetic integration3 pass; no Tencent production connection.
- Android: Release compilation/signature checked; **no device/usable AVD**, no runtime certification. APK still1.3.0-preview.1+4.
- ClassIsland: .NET/cipx build checks pass; **no Windows host installation/rendering**. .NET security audit inconclusive due TLS failure.
- App still does not consume `/api/v1/sync` or persist cursors; manual-refresh official changes pass, personal copies retain old values and lack retraction notice.

### Reports

- [QA-REPORT](docs/qa/v1.4/QA-REPORT.md)
- [TEST-MATRIX](docs/qa/v1.4/TEST-MATRIX.md)
- [BUG-REGISTER](docs/qa/v1.4/BUG-REGISTER.md)
- [INTEGRATION-REPORT](docs/qa/v1.4/INTEGRATION-REPORT.md)
- [RELEASE-READINESS](docs/qa/v1.4/RELEASE-READINESS.md)

### Validation / remaining gates

- [x] Reproduce existing baseline, independently reproduce storage P0 and retain red tests.
- [x] Run real Flutter HTTP fixture and verify fixture shutdown/cleanup.
- [x] Audit synthetic staged text and exclude DB/APK/private signing files.
- [x] Preserve PR21/22 ancestry; target Academic preview, never unrelated main.
- [ ] Owning team repairs P0/date/controller defects and reruns all tests/coverage.
- [ ] Hosted CI actually completes; known regressions and 80% gate intentionally block green status.
- [ ] Android runtime, Windows/ClassIsland, real QQ/school authorization and actual filesystem recovery verified.
- [ ] Command room explicitly approves any later merge/release.

The original integration branch acquired an additional teacher workspace merge from another actor. It remains preserved; this scoped delivery branch starts at the already-tested two-PR integration tree. Teacher112/112 unit results are archived only as an additional scope note, not product/browser certification.

Raw stdout/stderr logs are retained with their original whitespace and failure traces. Code/document whitespace checks exclude raw evidence logs. Specialized review providers failed authentication; fallback independent read-only QA review completed, with automation cleanup issues repaired.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
