-- The closed_surveys AI export lists closed surveys newest-first. It used to
-- join response_receipts for a response_count, but receipts are owner-only even
-- for adults, so that count was only ever the caller's own 0 or 1 and was
-- dropped. Without the join the query reads surveys alone, and this index lets
-- it seek to status = 'closed' and walk closed_at in order instead of scanning.
CREATE INDEX IF NOT EXISTS surveys_status_closed_at
  ON app_surveys__surveys (status, closed_at);
