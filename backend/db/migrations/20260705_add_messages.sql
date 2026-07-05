CREATE TABLE IF NOT EXISTS pms_message (
  id BIGSERIAL PRIMARY KEY,
  recipient_user_id BIGINT NOT NULL REFERENCES pms_user(id),
  type VARCHAR(30) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  link_path VARCHAR(200),
  read_at TIMESTAMPTZ,
  creator_id BIGINT,
  is_deleted SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_recipient_read ON pms_message(recipient_user_id, read_at, is_deleted);
CREATE INDEX IF NOT EXISTS idx_message_created_at ON pms_message(created_at);

INSERT INTO pms_message (recipient_user_id, type, title, description, link_path, creator_id, created_at)
SELECT 1, 'notification', '工单明细导出完成', '导出文件已生成，可前往相关页面查看结果。', '/work-orders', 1, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM pms_message WHERE recipient_user_id = 1 AND title = '工单明细导出完成' AND is_deleted = 0
);

INSERT INTO pms_message (recipient_user_id, type, title, description, link_path, creator_id, created_at)
SELECT 1, 'notification', '基础档案同步完成', '本次同步成功更新 12 条档案记录。', '/archive', 1, NOW() - INTERVAL '12 minutes'
WHERE NOT EXISTS (
  SELECT 1 FROM pms_message WHERE recipient_user_id = 1 AND title = '基础档案同步完成' AND is_deleted = 0
);

INSERT INTO pms_message (recipient_user_id, type, title, description, creator_id, read_at, created_at)
SELECT 1, 'system', '权限配置已更新', '管理员调整了部分菜单权限，刷新后可查看最新权限范围。', 1, NOW(), NOW() - INTERVAL '2 hours'
WHERE NOT EXISTS (
  SELECT 1 FROM pms_message WHERE recipient_user_id = 1 AND title = '权限配置已更新' AND is_deleted = 0
);
