WITH context AS (
  SELECT
    ARRAY(SELECT id FROM pms_project WHERE is_deleted=0 ORDER BY id) AS project_ids,
    ARRAY(SELECT id FROM pms_requirement WHERE is_deleted=0 ORDER BY id) AS requirement_ids,
    ARRAY(SELECT id FROM pms_user WHERE is_deleted=0 AND status=1 ORDER BY id) AS user_ids,
    ARRAY(SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE t.code='bug_type' AND a.is_deleted=0 AND a.status=1 ORDER BY a.sort_order,a.id) AS bug_type_ids,
    ARRAY(SELECT a.id FROM pms_archive a JOIN pms_archive_type t ON t.id=a.archive_type_id WHERE t.code='bug_resolution' AND a.is_deleted=0 AND a.status=1 ORDER BY a.sort_order,a.id) AS resolution_ids
), mock_rows AS (
  SELECT
    n,
    CASE WHEN n % 2 = 1 THEN 1 ELSE 2 END::SMALLINT AS source_type,
    project_ids[((n - 1) % cardinality(project_ids)) + 1] AS project_id,
    requirement_ids[((n - 1) % cardinality(requirement_ids)) + 1] AS requirement_id,
    user_ids[((n - 1) % cardinality(user_ids)) + 1] AS user_id,
    bug_type_ids[((n - 1) % cardinality(bug_type_ids)) + 1] AS bug_type_id,
    resolution_ids[((n - 1) % cardinality(resolution_ids)) + 1] AS resolution_id,
    ((n - 1) % 4)::SMALLINT AS status,
    (((n - 1) % 4) + 1)::SMALLINT AS severity
  FROM generate_series(1, 60) AS n
  CROSS JOIN context
  WHERE cardinality(project_ids)>0 AND cardinality(requirement_ids)>0 AND cardinality(user_ids)>0
    AND cardinality(bug_type_ids)>0 AND cardinality(resolution_ids)>0
)
INSERT INTO pms_bug (
  source_type,project_id,requirement_id,title,description,bug_type_id,severity,status,
  assignee_id,resolution_id,resolved_date,closed_date,creator_id,updater_id,created_at,updated_at
)
SELECT
  source_type,
  CASE WHEN source_type=1 THEN project_id END,
  CASE WHEN source_type=2 THEN requirement_id END,
  '模拟BUG-20260713-' || lpad(n::TEXT,3,'0'),
  '<p>这是用于 BUG 管理列表、筛选、排序、分页和状态流转验收的第 ' || n || ' 条模拟数据。</p>',
  bug_type_id,severity,status,user_id,
  CASE WHEN status IN (1,2) THEN resolution_id END,
  CASE WHEN status IN (1,2) THEN CURRENT_DATE - ((61-n)%20) END,
  CASE WHEN status=2 THEN CURRENT_DATE - ((61-n)%10) END,
  user_id,user_id,NOW() - ((61-n) || ' days')::INTERVAL,NOW() - ((61-n) || ' days')::INTERVAL
FROM mock_rows
ON CONFLICT (title) WHERE is_deleted=0 DO NOTHING;

INSERT INTO pms_op_log(user_id,action,module,target_id,target_name,operation_id,ip,created_at)
SELECT b.creator_id,'新增','BUG',b.id,b.title,md5('bug-create-' || b.id::TEXT)::UUID,'127.0.0.1',b.created_at
FROM pms_bug b
WHERE b.is_deleted=0 AND b.title LIKE '模拟BUG-20260713-%'
  AND NOT EXISTS (SELECT 1 FROM pms_op_log l WHERE l.module='BUG' AND l.target_id=b.id AND l.action='新增');

INSERT INTO pms_op_log(user_id,action,module,target_id,target_name,operation_id,field_name,old_value,new_value,ip,created_at)
SELECT b.updater_id,'状态变更','BUG',b.id,b.title,md5('bug-status-' || b.id::TEXT)::UUID,'status',
  CASE WHEN b.status=3 THEN '1' WHEN b.status=2 THEN '1' ELSE '0' END,b.status::TEXT,'127.0.0.1',b.updated_at + INTERVAL '1 minute'
FROM pms_bug b
WHERE b.is_deleted=0 AND b.title LIKE '模拟BUG-20260713-%' AND b.status<>0
  AND NOT EXISTS (SELECT 1 FROM pms_op_log l WHERE l.module='BUG' AND l.target_id=b.id AND l.action='状态变更' AND l.field_name='status');

INSERT INTO pms_op_log(user_id,action,module,target_id,target_name,operation_id,field_name,old_value,new_value,ip,created_at)
SELECT b.updater_id,'状态变更','BUG',b.id,b.title,md5('bug-status-' || b.id::TEXT)::UUID,'resolution_id',NULL,b.resolution_id::TEXT,'127.0.0.1',b.updated_at + INTERVAL '1 minute'
FROM pms_bug b
WHERE b.is_deleted=0 AND b.title LIKE '模拟BUG-20260713-%' AND b.resolution_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pms_op_log l WHERE l.module='BUG' AND l.target_id=b.id AND l.action='状态变更' AND l.field_name='resolution_id');
