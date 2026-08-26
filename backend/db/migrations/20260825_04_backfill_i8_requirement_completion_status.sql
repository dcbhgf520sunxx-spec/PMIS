WITH latest_success AS (
  SELECT DISTINCT ON (target_id)
    target_id,
    NULLIF(BTRIM(payload_summary ->> '解决方案'), '') AS solution
  FROM pms_integration_sync_record
  WHERE target_type = 'requirement'
    AND target_id IS NOT NULL
    AND sync_status = 'success'
  ORDER BY target_id, synced_at DESC, id DESC
)
UPDATE pms_requirement AS requirement
SET completion_status = COALESCE(latest_success.solution, '已完成（i8同步）'),
    updated_at = NOW()
FROM latest_success
WHERE requirement.id = latest_success.target_id
  AND requirement.is_deleted = 0
  AND requirement.status IN (33, 34)
  AND NULLIF(BTRIM(requirement.completion_status), '') IS NULL;
