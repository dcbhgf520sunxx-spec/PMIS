-- 新关闭状态与暂停采用相同的可恢复操作规则；不改写历史状态。
ALTER TABLE pms_requirement ADD COLUMN IF NOT EXISTS close_date DATE;
ALTER TABLE pms_requirement ADD COLUMN IF NOT EXISTS close_reason VARCHAR(200);
ALTER TABLE pms_project ADD COLUMN IF NOT EXISTS close_date DATE;
ALTER TABLE pms_project ADD COLUMN IF NOT EXISTS close_reason VARCHAR(200);
ALTER TABLE pms_task ADD COLUMN IF NOT EXISTS close_date DATE;
ALTER TABLE pms_task ADD COLUMN IF NOT EXISTS close_reason VARCHAR(200);
ALTER TABLE pms_work_order ADD COLUMN IF NOT EXISTS close_reason VARCHAR(200);
ALTER TABLE pms_project DROP CONSTRAINT IF EXISTS pms_project_status_check;
ALTER TABLE pms_project ADD CONSTRAINT pms_project_status_check CHECK (status IN (0,1,2,3,4));
ALTER TABLE pms_task DROP CONSTRAINT IF EXISTS pms_task_status_check;
ALTER TABLE pms_task ADD CONSTRAINT pms_task_status_check CHECK (status IN (0,1,2,3,4));
