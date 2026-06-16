SELECT
  s.id,
  s.title,
  s.description,
  s.created_by,
  s.created_at,
  COUNT(DISTINCT q.id) AS question_count
FROM app_surveys__surveys s
LEFT JOIN app_surveys__questions q
  ON q.survey_id = s.id
WHERE s.status = 'open'
GROUP BY s.id, s.title, s.description, s.created_by, s.created_at
ORDER BY s.created_at DESC
LIMIT 50