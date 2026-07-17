DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pms_role
    WHERE is_deleted = 0
    GROUP BY code HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '存在未删除角色编码重复，无法建立唯一索引';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pms_archive_type
    WHERE is_deleted = 0
    GROUP BY code HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '存在未删除档案类型编码重复，无法建立唯一索引';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pms_archive_type
    WHERE is_deleted = 0
    GROUP BY code_prefix HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '存在未删除档案类型前缀重复，无法建立唯一索引';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pms_work_order w
    LEFT JOIN pms_product p ON p.id = w.product_id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION '存在所属产品无效的工单，请先清理数据';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pms_work_order w
    LEFT JOIN pms_archive a ON a.id = w.problem_type
    LEFT JOIN pms_archive_type t ON t.id = a.archive_type_id
    WHERE a.id IS NULL OR t.code_prefix <> 'PT'
  ) THEN
    RAISE EXCEPTION '存在问题类型档案无效的工单，请先清理数据';
  END IF;
END $$;

ALTER TABLE pms_role DROP CONSTRAINT IF EXISTS pms_role_code_key;
ALTER TABLE pms_archive_type DROP CONSTRAINT IF EXISTS pms_archive_type_code_key;
ALTER TABLE pms_archive_type DROP CONSTRAINT IF EXISTS pms_archive_type_code_prefix_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pms_role_code_active
  ON pms_role(code) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS ux_pms_archive_type_code_active
  ON pms_archive_type(code) WHERE is_deleted = 0;
CREATE UNIQUE INDEX IF NOT EXISTS ux_pms_archive_type_prefix_active
  ON pms_archive_type(code_prefix) WHERE is_deleted = 0;

ALTER TABLE pms_work_order DROP CONSTRAINT IF EXISTS fk_work_order_product;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_pms_work_order_product'
      AND conrelid = 'pms_work_order'::regclass
  ) THEN
    ALTER TABLE pms_work_order
      ADD CONSTRAINT fk_pms_work_order_product
      FOREIGN KEY (product_id) REFERENCES pms_product(id) ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_pms_work_order_problem_type'
      AND conrelid = 'pms_work_order'::regclass
  ) THEN
    ALTER TABLE pms_work_order
      ADD CONSTRAINT fk_pms_work_order_problem_type
      FOREIGN KEY (problem_type) REFERENCES pms_archive(id) NOT VALID;
  END IF;
END $$;
ALTER TABLE pms_work_order VALIDATE CONSTRAINT fk_pms_work_order_product;
ALTER TABLE pms_work_order VALIDATE CONSTRAINT fk_pms_work_order_problem_type;

UPDATE pms_user
SET first_login = 1, updated_at = NOW()
WHERE employee_no = 'admin'
  AND is_deleted = 0
  AND password = '$2b$10$sJ8gCvuCgJQbcihvZEIWheUQEq1oIyVVh3EZa8fSlpOy80ihQ5UPi';

UPDATE pms_op_log
SET new_value = '***'
WHERE field_name = 'password' AND new_value = 'vv123456';
