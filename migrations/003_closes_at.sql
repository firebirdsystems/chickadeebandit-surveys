-- An optional response deadline for a survey.
--
-- Until now a survey was open until somebody remembered to close it, and
-- "results revealed when the survey closes" meant results could sit unrevealed
-- indefinitely. `closes_at` is wired to the hub's anonymous_responses
-- `session_deadline_column`, which enforces both halves: POST api/submit-response
-- refuses a response once the deadline passes (409), and api/response-results
-- releases the results at that same instant without anyone closing the survey.
--
-- NULL means "no deadline" — the original behaviour, and the default for every
-- existing row. The column is `_at`-suffixed so it is already plaintext at rest
-- (app-db-codec skip list), which the agenda's `substr(closes_at, 1, 10) =
-- :today` comparison depends on.
--
-- The index leads with closes_at for the agenda's day lookup; `status` follows
-- because a closed survey's deadline is no longer interesting.
ALTER TABLE app_surveys__surveys ADD COLUMN closes_at TEXT;

CREATE INDEX IF NOT EXISTS surveys_closes_at
  ON app_surveys__surveys (closes_at, status);
