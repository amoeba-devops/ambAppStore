-- Adds JSONB payload for re-rendering notifications in the user's current UI
-- locale (Option A in notification i18n plan).
--
-- New rows insert `ntf_event + ntf_template_payload` and let the inbox UI
-- pull the localized template from messages/{vi,ko,en}.json at render time.
-- `ntf_title` / `ntf_body` are kept as a fallback for legacy rows that have
-- no payload — those still show in whichever locale was active when the
-- notification was first created.

ALTER TABLE "car_notifications"
  ADD COLUMN "ntf_template_payload" jsonb;
