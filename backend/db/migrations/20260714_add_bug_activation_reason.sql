ALTER TABLE pms_bug ADD COLUMN IF NOT EXISTS activation_reason TEXT;

UPDATE pms_bug
SET activation_reason = CASE
  WHEN title LIKE '模拟BUG-20260713-%' THEN '问题再次复现，重新激活处理'
  ELSE '历史数据迁移补充激活原因'
END
WHERE status = 3 AND (activation_reason IS NULL OR btrim(activation_reason) = '');

UPDATE pms_bug SET activation_reason = NULL WHERE status <> 3 AND activation_reason IS NOT NULL;

ALTER TABLE pms_bug DROP CONSTRAINT IF EXISTS chk_bug_activation_reason;
ALTER TABLE pms_bug ADD CONSTRAINT chk_bug_activation_reason CHECK (
  (status = 3 AND activation_reason IS NOT NULL AND btrim(activation_reason) <> '' AND char_length(activation_reason) <= 500)
  OR (status <> 3 AND activation_reason IS NULL)
);
