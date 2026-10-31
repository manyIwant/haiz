# Migration / rollback

Development uses synthetic databases only. Production execution requires operator approval and a maintenance window.

1. Stop writers; record code/schema/SQLite versions. Use SQLite online backup or stop service and copy db+WAL/SHM consistently. Never copy only a live WAL database. Verify backup integrity_check/foreign_key_check and checksum, store outside public paths mode 0600.
2. Start against copy. Migration 001 uses BEGIN IMMEDIATE, additive schema and revision/event/ack backfill, checksummed migration ledger. Validation precedes COMMIT. Failure/crash rolls back and startup fails closed. No old user rows dropped/truncated.
3. Check counts and stable IDs, run synthetic smoke/restart tests, deploy code/schema together. WAL/busy_timeout handle brief contention; 503 requires same-key retry.
4. Before new v1.4 writes: stop, restore verified pre-upgrade backup and matching v1.3 code. Preserve failed files for diagnosis. Never run v1.3 positional INSERTs on v1.4 schema.
5. After new writes: no destructive down SQL; forward repair or roll back to a schema-compatible v1.4 build. Disaster restore must archive current files, reconcile post-backup writes, rotate instanceId/cursor secret and require resnapshot, never silently revive withdrawn work.

No automatic event/revision/receipt pruning. Storage monitoring, backup rotation and restore drill remain operator responsibilities. Tests inject migration failure and verify row/schema preservation. No production database or real-person fixture committed.
