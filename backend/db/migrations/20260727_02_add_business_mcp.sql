CREATE TABLE IF NOT EXISTS pms_mcp_client (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  token_prefix VARCHAR(20) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  endpoint_type VARCHAR(10) NOT NULL CHECK (endpoint_type IN ('query', 'action')),
  status SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (0, 1)),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  is_deleted SMALLINT NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_mcp_audit_log (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL,
  client_id BIGINT REFERENCES pms_mcp_client(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES pms_user(id) ON DELETE SET NULL,
  employee_no VARCHAR(50),
  endpoint_type VARCHAR(10) NOT NULL CHECK (endpoint_type IN ('query', 'action')),
  protocol_method VARCHAR(50) NOT NULL,
  tool_name VARCHAR(100),
  risk_level VARCHAR(10),
  module VARCHAR(50),
  target_id BIGINT,
  target_name VARCHAR(200),
  input_summary JSONB,
  result_status VARCHAR(20) NOT NULL,
  result_count INTEGER,
  error_code VARCHAR(50),
  error_message VARCHAR(200),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  ip VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pms_mcp_action_ticket (
  id UUID PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES pms_mcp_client(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES pms_user(id) ON DELETE CASCADE,
  employee_no VARCHAR(50) NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  arguments_hash CHAR(64) NOT NULL,
  preview JSONB NOT NULL,
  idempotency_key VARCHAR(100),
  risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'expired', 'failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_client_active
  ON pms_mcp_client(endpoint_type, status, is_deleted, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mcp_audit_request
  ON pms_mcp_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_client_created
  ON pms_mcp_audit_log(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_user_created
  ON pms_mcp_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_tool_created
  ON pms_mcp_audit_log(tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_ticket_status_expires
  ON pms_mcp_action_ticket(status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mcp_ticket_idempotency
  ON pms_mcp_action_ticket(client_id, user_id, tool_name, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
