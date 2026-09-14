ALTER TABLE pms_project
  ADD COLUMN IF NOT EXISTS suspend_reason VARCHAR(200);

ALTER TABLE pms_requirement
  ADD COLUMN IF NOT EXISTS pause_reason VARCHAR(200);

ALTER TABLE pms_task
  ADD COLUMN IF NOT EXISTS suspend_reason VARCHAR(200);

ALTER TABLE pms_work_order
  ADD COLUMN IF NOT EXISTS suspend_reason VARCHAR(200);
