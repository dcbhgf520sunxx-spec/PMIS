ALTER TABLE pms_op_log
  ADD COLUMN IF NOT EXISTS operation_id UUID;

CREATE INDEX IF NOT EXISTS idx_op_log_operation
  ON pms_op_log(operation_id);
