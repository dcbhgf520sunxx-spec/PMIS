DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pms_archive_type WHERE name = '供应商' AND is_deleted = 0
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pms_archive_type
      WHERE is_deleted = 0 AND (code = 'supplier' OR code_prefix = 'SUP')
    ) THEN
      RAISE EXCEPTION '供应商档案类型编码或前缀已被占用，请先处理冲突';
    END IF;

    INSERT INTO pms_archive_type (code, code_prefix, name, status, creator_id, updater_id)
    VALUES ('supplier', 'SUP', '供应商', 1, 1, 1);
  END IF;
END $$;

ALTER TABLE pms_project_contract
  ADD COLUMN IF NOT EXISTS supplier_id BIGINT;

WITH supplier_type AS (
  SELECT id, code_prefix
  FROM pms_archive_type
  WHERE name = '供应商' AND is_deleted = 0
  ORDER BY id
  LIMIT 1
),
supplier_names AS (
  SELECT DISTINCT BTRIM(supplier_name) name
  FROM pms_project_contract
  WHERE supplier_id IS NULL
    AND supplier_name IS NOT NULL
    AND BTRIM(supplier_name) <> ''
),
missing_names AS (
  SELECT names.name, ROW_NUMBER() OVER (ORDER BY names.name) sequence_offset
  FROM supplier_names names
  CROSS JOIN supplier_type type
  WHERE NOT EXISTS (
    SELECT 1 FROM pms_archive archive
    WHERE archive.archive_type_id = type.id
      AND archive.is_deleted = 0
      AND archive.name = names.name
  )
),
sequence_base AS (
  SELECT COALESCE(MAX(
    CASE
      WHEN archive.code ~ ('^' || type.code_prefix || '[0-9]+$')
      THEN SUBSTRING(archive.code FROM LENGTH(type.code_prefix) + 1)::INTEGER
    END
  ), 0) max_sequence
  FROM pms_archive archive
  CROSS JOIN supplier_type type
)
INSERT INTO pms_archive (code, name, archive_type_id, sort_order, status, creator_id, updater_id)
SELECT type.code_prefix || LPAD((base.max_sequence + missing.sequence_offset)::TEXT, 3, '0'),
  missing.name,
  type.id,
  base.max_sequence + missing.sequence_offset,
  1,
  1,
  1
FROM missing_names missing
CROSS JOIN supplier_type type
CROSS JOIN sequence_base base;

UPDATE pms_project_contract contract
SET supplier_id = supplier.id
FROM (
  SELECT MIN(archive.id) id, archive.name
  FROM pms_archive archive
  JOIN pms_archive_type type ON type.id = archive.archive_type_id
  WHERE type.name = '供应商'
    AND type.is_deleted = 0
    AND archive.is_deleted = 0
  GROUP BY archive.name
) supplier
WHERE contract.supplier_id IS NULL
  AND supplier.name = BTRIM(contract.supplier_name);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pms_project_contract WHERE supplier_id IS NULL) THEN
    RAISE EXCEPTION '存在无法匹配供应商档案的项目合同，迁移已中止';
  END IF;
END $$;

ALTER TABLE pms_project_contract
  ALTER COLUMN supplier_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_project_contract_supplier'
      AND conrelid = 'pms_project_contract'::regclass
  ) THEN
    ALTER TABLE pms_project_contract
      ADD CONSTRAINT fk_project_contract_supplier
      FOREIGN KEY (supplier_id) REFERENCES pms_archive(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_contract_supplier_active
  ON pms_project_contract(supplier_id)
  WHERE is_deleted = 0;

ALTER TABLE pms_project_contract
  DROP COLUMN supplier_name;
