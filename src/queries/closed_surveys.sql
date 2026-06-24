SELECT
  s.id,
  s.title,
  s.closed_at,
  COUNT(DISTINCT rr.member_id) AS response_count
FROM app_surveys__surveys s
LEFT JOIN app_surveys__response_receipts rr
  ON rr.survey_id = s.id
WHERE s.status = 'closed'
GROUP BY s.id, s.title, s.closed_at
ORDER BY s.closed_at DESC
LIMIT 50