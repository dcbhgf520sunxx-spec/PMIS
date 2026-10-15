-- 日常任务复用既有任务表，不变更历史记录；只扩展关联类型和对应约束。
DO $$
DECLARE item RECORD;
BEGIN
  FOR item IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='pms_task'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%source_type%'
  LOOP
    EXECUTE format('ALTER TABLE pms_task DROP CONSTRAINT %I', item.conname);
  END LOOP;
END $$;

ALTER TABLE pms_task ADD CONSTRAINT pms_task_source_type_check CHECK (source_type IN (1,2,3));
ALTER TABLE pms_task ADD CONSTRAINT pms_task_source_target_check CHECK (
  (source_type=1 AND project_id IS NOT NULL AND requirement_id IS NULL)
  OR (source_type=2 AND requirement_id IS NOT NULL AND project_id IS NULL)
  OR (source_type=3 AND project_id IS NULL AND requirement_id IS NULL)
);
