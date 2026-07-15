ALTER TABLE pms_work_order
  ADD COLUMN IF NOT EXISTS product_id BIGINT;

UPDATE pms_work_order w
SET product_id = p.id
FROM pms_archive a
JOIN pms_product p ON p.name = a.name AND p.is_deleted = 0
WHERE w.system_id = a.id
  AND w.product_id IS NULL;

UPDATE pms_work_order w
SET product_id = (
  SELECT p.id
  FROM pms_product p
  WHERE p.is_deleted = 0
  ORDER BY random()
  LIMIT 1
)
WHERE w.product_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pms_work_order WHERE product_id IS NULL) THEN
    RAISE EXCEPTION '没有可用于匹配运维工单的产品数据';
  END IF;
END $$;

ALTER TABLE pms_work_order
  ALTER COLUMN product_id SET NOT NULL;

ALTER TABLE pms_work_order
  DROP CONSTRAINT IF EXISTS fk_work_order_product;

ALTER TABLE pms_work_order
  ADD CONSTRAINT fk_work_order_product
  FOREIGN KEY (product_id) REFERENCES pms_product(id) ON DELETE RESTRICT;

ALTER TABLE pms_work_order
  DROP COLUMN system_id;

CREATE INDEX IF NOT EXISTS idx_work_order_product
  ON pms_work_order(product_id);
