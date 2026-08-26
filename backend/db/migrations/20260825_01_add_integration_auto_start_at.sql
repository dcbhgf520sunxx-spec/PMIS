ALTER TABLE pms_integration_config
  ADD COLUMN IF NOT EXISTS auto_start_at TIMESTAMPTZ;
