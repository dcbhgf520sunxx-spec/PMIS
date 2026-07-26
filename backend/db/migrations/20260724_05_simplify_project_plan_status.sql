ALTER TABLE pms_project_plan_item
  ADD COLUMN IF NOT EXISTS pause_reason VARCHAR(200);

UPDATE pms_project_plan_item
SET
  is_deleted = 1,
  status = CASE WHEN previous_status IN (0, 1) THEN previous_status ELSE 0 END,
  previous_status = NULL,
  pause_reason = NULL,
  updated_at = NOW()
WHERE status = 4;

UPDATE pms_project_plan_item
SET pause_reason = '历史暂停（未记录原因）'
WHERE status = 3
  AND NULLIF(BTRIM(pause_reason), '') IS NULL;

ALTER TABLE pms_project_plan_item
  DROP CONSTRAINT IF EXISTS pms_project_plan_item_status_check,
  DROP CONSTRAINT IF EXISTS pms_project_plan_item_previous_status_check,
  DROP CONSTRAINT IF EXISTS ck_project_plan_item_status,
  DROP CONSTRAINT IF EXISTS ck_project_plan_item_previous_status,
  DROP CONSTRAINT IF EXISTS ck_project_plan_item_pause_reason;

ALTER TABLE pms_project_plan_item
  ADD CONSTRAINT ck_project_plan_item_status CHECK (status IN (0, 1, 2, 3)),
  ADD CONSTRAINT ck_project_plan_item_previous_status CHECK (previous_status IS NULL OR previous_status IN (0, 1)),
  ADD CONSTRAINT ck_project_plan_item_pause_reason CHECK (status <> 3 OR NULLIF(BTRIM(pause_reason), '') IS NOT NULL);
