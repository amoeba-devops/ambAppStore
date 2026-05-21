-- Add arf_raw_bytes (BYTEA) so downloads work without S3 — the upload pipeline
-- stores the original bytes here at ingest time. S3 remains the preferred
-- backend when configured; this is the always-on fallback.
ALTER TABLE "sal_archive_files" ADD COLUMN IF NOT EXISTS "arf_raw_bytes" bytea;
