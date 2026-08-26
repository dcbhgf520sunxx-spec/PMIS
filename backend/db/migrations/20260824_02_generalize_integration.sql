ALTER TABLE pms_integration_config
  ADD COLUMN IF NOT EXISTS adapter_code VARCHAR(60),
  ADD COLUMN IF NOT EXISTS request_method VARCHAR(10) NOT NULL DEFAULT 'POST',
  ADD COLUMN IF NOT EXISTS auto_enabled SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::JSONB;

UPDATE pms_integration_config
SET adapter_code = COALESCE(adapter_code, code),
    auto_enabled = enabled,
    config_json = jsonb_strip_nulls(jsonb_build_object(
      'product_id', product_id,
      'fallback_owner_id', fallback_owner_id
    ))
WHERE adapter_code IS NULL OR config_json = '{}'::JSONB;

ALTER TABLE pms_integration_config ALTER COLUMN adapter_code SET NOT NULL;
ALTER TABLE pms_integration_config DROP COLUMN IF EXISTS product_id;
ALTER TABLE pms_integration_config DROP COLUMN IF EXISTS fallback_owner_id;

ALTER TABLE pms_itops_sync_record DROP CONSTRAINT IF EXISTS pms_itops_sync_record_external_code_key;
ALTER TABLE pms_itops_sync_record RENAME TO pms_integration_sync_record;
ALTER TABLE pms_integration_sync_record RENAME COLUMN external_code TO source_key;
ALTER TABLE pms_integration_sync_record RENAME COLUMN source_category TO source_type;
ALTER TABLE pms_integration_sync_record RENAME COLUMN external_updated_at TO source_updated_at;

DROP INDEX IF EXISTS idx_itops_sync_record_status;
DROP INDEX IF EXISTS idx_itops_sync_record_target;
CREATE INDEX IF NOT EXISTS idx_integration_sync_record_status
  ON pms_integration_sync_record(integration_config_id, sync_status, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_sync_record_source
  ON pms_integration_sync_record(integration_config_id, source_key, synced_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_integration_sync_record_target
  ON pms_integration_sync_record(target_type, target_id);
