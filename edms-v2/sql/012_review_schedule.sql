ALTER TABLE v2_documents ADD COLUMN IF NOT EXISTS review_due_override_utc DATETIME(3) NULL AFTER last_reviewed_version;
