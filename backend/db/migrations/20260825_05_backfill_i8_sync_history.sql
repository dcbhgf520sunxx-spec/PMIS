-- 为已经成功同步到 PMIS 的 i8 单据补充来源历史。
-- 历史同步只能确认“由 i8 同步创建”，不能可靠还原每次字段变化，因此不伪造字段级明细。
WITH first_success AS (
  SELECT DISTINCT ON (target_type, target_id)
    target_type,
    target_id,
    synced_at
  FROM pms_integration_sync_record
  WHERE sync_status = 'success'
    AND target_type IN ('requirement', 'work_order')
    AND target_id IS NOT NULL
  ORDER BY target_type, target_id, synced_at ASC, id ASC
), synced_targets AS (
  SELECT
    '需求'::VARCHAR(50) AS module,
    s.target_id,
    r.creator_id AS user_id,
    LEFT(r.title, 200) AS target_name,
    s.synced_at
  FROM first_success s
  JOIN pms_requirement r ON r.id = s.target_id AND r.is_deleted = 0
  WHERE s.target_type = 'requirement'

  UNION ALL

  SELECT
    '运维工单'::VARCHAR(50) AS module,
    s.target_id,
    w.creator_id AS user_id,
    LEFT(BTRIM(REGEXP_REPLACE(COALESCE(w.problem_desc, ''), '<[^>]*>', ' ', 'g')), 200) AS target_name,
    s.synced_at
  FROM first_success s
  JOIN pms_work_order w ON w.id = s.target_id AND w.is_deleted = 0
  WHERE s.target_type = 'work_order'
)
INSERT INTO pms_op_log (user_id, action, module, target_id, target_name, created_at)
SELECT
  t.user_id,
  'i8同步新增',
  t.module,
  t.target_id,
  NULLIF(t.target_name, ''),
  t.synced_at
FROM synced_targets t
WHERE NOT EXISTS (
  SELECT 1
  FROM pms_op_log l
  WHERE l.module = t.module
    AND l.target_id = t.target_id
    AND l.action = 'i8同步新增'
);
