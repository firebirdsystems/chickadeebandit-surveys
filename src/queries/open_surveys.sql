SELECT
  s.id,
  s.title,
  s.description,
  s.created_by,
  s.created_at,
  COUNT(DISTINCT q.id) AS question_count
FROM surveys s
LEFT JOIN questions q
  ON q.survey_id = s.id
  AND q.household_id = s.household_id
WHERE s.household_id = current_setting('app.household_id', true)::uuid
  AND s.status = 'open'
GROUP BY s.id, s.title, s.description, s.created_by, s.created_at
ORDER BY s.created_at DESC
LIMIT 50