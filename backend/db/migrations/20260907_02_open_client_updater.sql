ALTER TABLE pms_open_client ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES pms_user(id) ON DELETE SET NULL;

-- 管理事务使用同一 NOW()：仅回填与当前更新时间精确匹配、且操作人唯一的编辑日志。
-- 无日志、后续命令行更新、身份已丢失或多义的记录保持 NULL，不用创建人代替。
UPDATE pms_open_client c
SET updated_by = evidence.user_id
FROM (
  SELECT c2.id, MIN(l.user_id) AS user_id
  FROM pms_open_client c2
  JOIN pms_op_log l ON l.module='接入系统' AND l.target_id=c2.id AND l.created_at=c2.updated_at
  WHERE l.action IN ('编辑','启用','停用','重置凭证')
  GROUP BY c2.id
  HAVING COUNT(DISTINCT l.user_id)=1 AND COUNT(*)=COUNT(l.user_id)
) evidence
WHERE c.id=evidence.id AND c.updated_by IS NULL;
