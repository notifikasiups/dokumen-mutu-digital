ALTER TABLE v2_documents
 ADD COLUMN last_reviewed_at DATETIME(3) NULL,
 ADD COLUMN last_reviewed_by INT UNSIGNED NULL,
 ADD COLUMN last_reviewed_version INT NULL,
 ADD KEY idx_v2_documents_review (status,last_reviewed_at,last_reviewed_version),
 ADD CONSTRAINT fk_v2_documents_review_user FOREIGN KEY (last_reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
