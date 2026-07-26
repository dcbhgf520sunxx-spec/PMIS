DROP INDEX IF EXISTS idx_task_plan_item_active;
ALTER TABLE pms_task DROP COLUMN IF EXISTS plan_item_id;
