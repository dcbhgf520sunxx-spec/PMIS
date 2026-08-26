CREATE TABLE pms_follow_up_record (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES pms_project(id) ON DELETE CASCADE,
  requirement_id BIGINT REFERENCES pms_requirement(id) ON DELETE CASCADE,
  task_id BIGINT REFERENCES pms_task(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (btrim(content) <> '' AND char_length(content) <= 200),
  creator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  updater_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(project_id, requirement_id, task_id) = 1)
);

CREATE INDEX idx_follow_up_project
  ON pms_follow_up_record(project_id, created_at DESC, id DESC)
  WHERE is_deleted = 0;
CREATE INDEX idx_follow_up_requirement
  ON pms_follow_up_record(requirement_id, created_at DESC, id DESC)
  WHERE is_deleted = 0;
CREATE INDEX idx_follow_up_task
  ON pms_follow_up_record(task_id, created_at DESC, id DESC)
  WHERE is_deleted = 0;
