ALTER TABLE pms_task ADD COLUMN IF NOT EXISTS parent_task_id BIGINT;

DO $$
BEGIN
  ALTER TABLE pms_task
    ADD CONSTRAINT fk_task_parent
    FOREIGN KEY (parent_task_id) REFERENCES pms_task(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_task_parent ON pms_task(parent_task_id, is_deleted);
