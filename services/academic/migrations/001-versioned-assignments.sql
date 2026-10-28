ALTER TABLE assignments ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1);
ALTER TABLE assignments ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','review','published','revised','retracted'));
ALTER TABLE assignments ADD COLUMN due_precision TEXT NOT NULL DEFAULT 'none' CHECK(due_precision IN ('none','date','minute'));
ALTER TABLE assignments ADD COLUMN updated_at TEXT;
ALTER TABLE assignments ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'legacy';
UPDATE assignments SET due_precision=CASE WHEN due IS NULL OR due='' THEN 'none' ELSE 'date' END, updated_at=created_at;
CREATE TABLE academic_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE assignment_revisions (
 assignment_id TEXT NOT NULL REFERENCES assignments(id), version INTEGER NOT NULL,
 actor_id TEXT NOT NULL, operation TEXT NOT NULL, occurred_at TEXT NOT NULL,
 changed_fields TEXT NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY(assignment_id,version)
);
CREATE TABLE sync_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
 class_id TEXT NOT NULL REFERENCES classes(id), resource_id TEXT NOT NULL REFERENCES assignments(id),
 version INTEGER NOT NULL, occurred_at TEXT NOT NULL, snapshot TEXT NOT NULL, command_key TEXT,
 UNIQUE(resource_id,version)
);
CREATE INDEX sync_events_scope_sequence ON sync_events(class_id,sequence);
CREATE TABLE version_acknowledgements (
 assignment_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
 version INTEGER NOT NULL, viewed_at TEXT NOT NULL, PRIMARY KEY(assignment_id,user_id,version),
 FOREIGN KEY(assignment_id,version) REFERENCES assignment_revisions(assignment_id,version)
);
CREATE TABLE command_receipts (
 user_id TEXT NOT NULL REFERENCES users(id), route TEXT NOT NULL, key TEXT NOT NULL,
 request_hash TEXT NOT NULL, result TEXT NOT NULL, status INTEGER NOT NULL,
 PRIMARY KEY(user_id,route,key)
);
CREATE TABLE permission_epochs (user_id TEXT PRIMARY KEY REFERENCES users(id), epoch INTEGER NOT NULL DEFAULT 0);
INSERT INTO permission_epochs(user_id) SELECT id FROM users;
CREATE TRIGGER user_permission_epoch AFTER INSERT ON users BEGIN
 INSERT INTO permission_epochs(user_id) VALUES (NEW.id);
END;
CREATE TRIGGER membership_insert_epoch AFTER INSERT ON memberships BEGIN
 UPDATE permission_epochs SET epoch=epoch+1 WHERE user_id=NEW.user_id;
END;
CREATE TRIGGER membership_update_epoch AFTER UPDATE ON memberships BEGIN
 UPDATE permission_epochs SET epoch=epoch+1 WHERE user_id IN (OLD.user_id,NEW.user_id);
END;
CREATE TRIGGER membership_delete_epoch AFTER DELETE ON memberships BEGIN
 UPDATE permission_epochs SET epoch=epoch+1 WHERE user_id=OLD.user_id;
END;
CREATE INDEX revisions_assignment_version ON assignment_revisions(assignment_id,version);
CREATE TRIGGER immutable_revision_update BEFORE UPDATE ON assignment_revisions BEGIN SELECT RAISE(ABORT,'immutable revision'); END;
CREATE TRIGGER immutable_revision_delete BEFORE DELETE ON assignment_revisions BEGIN SELECT RAISE(ABORT,'immutable revision'); END;
CREATE TRIGGER immutable_event_update BEFORE UPDATE ON sync_events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
CREATE TRIGGER immutable_event_delete BEFORE DELETE ON sync_events BEGIN SELECT RAISE(ABORT,'immutable event'); END;
