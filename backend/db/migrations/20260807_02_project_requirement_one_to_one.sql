ALTER TABLE pms_project
  ADD COLUMN IF NOT EXISTS requirement_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pms_project_requirement') THEN
    ALTER TABLE pms_project
      ADD CONSTRAINT fk_pms_project_requirement
      FOREIGN KEY (requirement_id) REFERENCES pms_requirement(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_project_requirement_active
  ON pms_project(requirement_id)
  WHERE is_deleted = 0 AND requirement_id IS NOT NULL;

DROP INDEX IF EXISTS idx_requirement_project;
ALTER TABLE pms_requirement DROP CONSTRAINT IF EXISTS pms_requirement_project_id_fkey;
ALTER TABLE pms_requirement DROP COLUMN IF EXISTS project_id;
