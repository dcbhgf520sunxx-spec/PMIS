-- SIDM 开放接口：独立凭证、来源映射、逐次请求记录。默认不启用任何客户端。
CREATE TABLE IF NOT EXISTS pms_open_client (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  enabled SMALLINT NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  expires_at TIMESTAMPTZ,
  scopes JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(scopes)='array'),
  operator_ids JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(operator_ids)='array'),
  created_by BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pms_open_record (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES pms_open_client(id) ON DELETE RESTRICT,
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('requirement','work_order')),
  source_record_id VARCHAR(100) NOT NULL,
  target_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id,resource_type,source_record_id),
  UNIQUE (client_id,resource_type,target_id)
);
CREATE TABLE IF NOT EXISTS pms_open_request (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  client_id BIGINT NOT NULL REFERENCES pms_open_client(id) ON DELETE RESTRICT,
  operator_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('requirement','work_order','system')),
  source_record_id VARCHAR(100),
  operation VARCHAR(40) NOT NULL,
  idempotency_key VARCHAR(100),
  request_hash CHAR(64),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success','failed','replayed')),
  http_status SMALLINT NOT NULL CHECK (http_status BETWEEN 100 AND 599),
  result_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_open_request_success ON pms_open_request(client_id,idempotency_key)
  WHERE outcome='success' AND idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_open_request_client_time ON pms_open_request(client_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_open_request_source ON pms_open_request(client_id,resource_type,source_record_id,created_at DESC);
