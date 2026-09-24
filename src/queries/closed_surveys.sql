SELECT
  s.id,
  s.title,
  s.closed_at
FROM app_surveys__surveys s
WHERE s.status = 'closed'
ORDER BY s.closed_at DESC
LIMIT 50