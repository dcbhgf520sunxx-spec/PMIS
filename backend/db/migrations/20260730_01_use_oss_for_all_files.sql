ALTER TABLE pms_project_plan_delivery_file
  ADD COLUMN IF NOT EXISTS oss_response JSONB;

COMMENT ON COLUMN pms_project_plan_delivery_file.oss_response
  IS 'OSS 上传接口完整响应；迁移前的历史本地文件为空';
