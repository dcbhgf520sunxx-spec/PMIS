-- 兼容从旧表名迁移的档案类型唯一约束。
CREATE UNIQUE INDEX IF NOT EXISTS ux_pms_archive_type_code_active
  ON pms_archive_type(code) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS ux_pms_archive_type_prefix_active
  ON pms_archive_type(code_prefix) WHERE is_deleted = 0;

ALTER TABLE pms_archive_type
  DROP CONSTRAINT IF EXISTS archive_type_code_key,
  DROP CONSTRAINT IF EXISTS archive_type_code_prefix_key,
  DROP CONSTRAINT IF EXISTS pms_archive_type_code_key,
  DROP CONSTRAINT IF EXISTS pms_archive_type_code_prefix_key;
