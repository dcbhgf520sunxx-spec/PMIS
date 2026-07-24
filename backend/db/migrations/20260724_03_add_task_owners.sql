CREATE TABLE IF NOT EXISTS pms_task_owner (
  task_id BIGINT NOT NULL REFERENCES pms_task(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, user_id)
);

INSERT INTO pms_task_owner(task_id, user_id, sort_order)
SELECT id, owner_id, 0
FROM pms_task
ON CONFLICT (task_id, user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_task_owner_user ON pms_task_owner(user_id, task_id);

DROP INDEX IF EXISTS idx_task_owner_status;
ALTER TABLE pms_task DROP COLUMN owner_id;
