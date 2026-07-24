ALTER TABLE pms_work_order
  ADD COLUMN IF NOT EXISTS activation_reason TEXT;

ALTER TABLE pms_work_order
  DROP CONSTRAINT IF EXISTS chk_work_order_activation_reason;

ALTER TABLE pms_work_order
  ADD CONSTRAINT chk_work_order_activation_reason CHECK (
    (status <> 5 OR activation_reason IS NOT NULL)
    AND (
      activation_reason IS NULL
      OR (btrim(activation_reason) <> '' AND char_length(activation_reason) <= 100)
    )
  );
