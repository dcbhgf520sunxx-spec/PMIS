ALTER TABLE pms_project_contract_attachment
  ADD COLUMN IF NOT EXISTS oss_response JSONB;
