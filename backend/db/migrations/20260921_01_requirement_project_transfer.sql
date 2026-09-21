-- 数据迁移：现有关联项目的需求统一结束为已转项目；不改表结构，不伪造历史转项时间。
WITH targets AS MATERIALIZED (
  SELECT r.id,r.title,r.status,r.is_overdue,p.id project_id,p.name project_name,
         md5('requirement-project-transfer:' || r.id || ':' || clock_timestamp())::uuid operation_id
  FROM pms_requirement r JOIN pms_project p ON p.requirement_id=r.id AND p.is_deleted=0
  WHERE r.is_deleted=0 AND r.status<>36
), changed AS (
  UPDATE pms_requirement r SET status=36,is_overdue=NULL,updated_at=NOW()
  FROM targets t WHERE r.id=t.id RETURNING r.id
)
INSERT INTO pms_op_log(user_id,action,module,target_id,field_name,old_value,new_value,target_name,operation_id)
SELECT NULL,'历史转项目状态补齐','需求',t.id,v.field_name,v.old_value,v.new_value,t.title,t.operation_id
FROM targets t JOIN changed c ON c.id=t.id
CROSS JOIN LATERAL (VALUES
 ('status',t.status::text,'36'),
 ('关联项目',NULL,t.project_name || '（ID：' || t.project_id || '）'),
 ('is_overdue',t.is_overdue::text,NULL)
) v(field_name,old_value,new_value)
WHERE v.old_value IS DISTINCT FROM v.new_value;
