ALTER TABLE pms_bug DROP CONSTRAINT IF EXISTS pms_bug_check1;
ALTER TABLE pms_bug DROP CONSTRAINT IF EXISTS pms_bug_check2;
ALTER TABLE pms_bug DROP CONSTRAINT IF EXISTS chk_bug_resolution_id_status;
ALTER TABLE pms_bug DROP CONSTRAINT IF EXISTS chk_bug_resolved_date_status;

ALTER TABLE pms_bug ADD CONSTRAINT chk_bug_resolution_id_status CHECK (
  status IN (1,2,3) OR resolution_id IS NULL
);

ALTER TABLE pms_bug ADD CONSTRAINT chk_bug_resolved_date_status CHECK (
  status IN (1,2,3) OR resolved_date IS NULL
);
