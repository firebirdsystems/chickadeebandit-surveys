SELECT
  s.id,
  s.title,
  s.closed_at,
  COUNT(DISTINCT r.member_id) AS response_count
FROM surveys s
LEFT JOIN responses r
  ON r.survey_id = s.id
  AND r.household_id = s.household_id
WHERE s.household_id = current_setting('app.household_id', true)::uuid
  AND s.status = 'closed'
GROUP BY s.id, s.title, s.closed_at
ORDER BY s.closed_at DESC
LIMIT 50