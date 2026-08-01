-- Retention index (see manifest.row_policies.surveys.retain_days).
--
-- Nothing in this app ever removed a survey, and a survey is not one row: it
-- owns its questions, every member's responses, and a receipt per respondent.
-- A household running a survey a month accumulates all of it permanently.
--
-- Ageing out the SURVEY and cascading is the only correct unit here, and it is
-- the same shape polls uses. Retention keyed on the responses or receipts
-- directly would be wrong twice over: the hub refuses it outright on tables an
-- anonymous protocol writes, because those rows carry a constant timestamp so
-- submission order cannot deanonymize them — a sweep would purge every one of
-- them on its first run.
--
-- The hub requires an index leading on the retention timestamp; this app
-- shipped none on `surveys` at all.
CREATE INDEX IF NOT EXISTS surveys_retention
  ON app_surveys__surveys (created_at, id);
