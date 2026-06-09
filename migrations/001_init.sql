CREATE TABLE IF NOT EXISTS surveys (
  household_id UUID NOT NULL DEFAULT current_setting('app.household_id', true)::uuid,
  id           TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'open',
  anonymous    INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  closed_at    TEXT,
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS questions (
  household_id UUID NOT NULL DEFAULT current_setting('app.household_id', true)::uuid,
  id           TEXT NOT NULL,
  survey_id    TEXT NOT NULL,
  text         TEXT NOT NULL,
  type         TEXT NOT NULL,
  options      TEXT NOT NULL DEFAULT '[]',
  position     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS responses (
  household_id UUID NOT NULL DEFAULT current_setting('app.household_id', true)::uuid,
  id           TEXT NOT NULL,
  survey_id    TEXT NOT NULL,
  question_id  TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  answer       TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (household_id, id),
  UNIQUE (survey_id, question_id, member_id)
);

CREATE INDEX IF NOT EXISTS questions_survey ON questions(survey_id);
CREATE INDEX IF NOT EXISTS responses_survey ON responses(survey_id);
CREATE INDEX IF NOT EXISTS responses_survey_member ON responses(survey_id, member_id);
