UPDATE pms_menu SET sort_order = 20, updated_at = NOW() WHERE code = 'base_settings';
UPDATE pms_menu SET sort_order = 21, updated_at = NOW() WHERE code = 'archive';
UPDATE pms_menu SET sort_order = 22, updated_at = NOW() WHERE code = 'access_log';
UPDATE pms_menu SET sort_order = 30, updated_at = NOW() WHERE code = 'user_auth';
UPDATE pms_menu SET sort_order = 31, updated_at = NOW() WHERE code = 'user';
UPDATE pms_menu SET sort_order = 32, updated_at = NOW() WHERE code = 'role';

INSERT INTO pms_menu (parent_id, name, code, type, path, icon, sort_order, creator_id, updater_id)
VALUES (0, '组件工作台', 'design_system', 1, NULL, 'ExperimentOutlined', 40, 1, 1)
ON CONFLICT (code) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_menu (parent_id, name, code, type, path, icon, sort_order, creator_id, updater_id)
VALUES
  ((SELECT id FROM pms_menu WHERE code = 'design_system'), '总览', 'design_system_overview', 2, '/system/design-system?category=overview', NULL, 41, 1, 1),
  ((SELECT id FROM pms_menu WHERE code = 'design_system'), '页面样板', 'design_system_samples', 2, '/samples/work-order', NULL, 42, 1, 1),
  ((SELECT id FROM pms_menu WHERE code = 'design_system'), '设计基础', 'design_system_foundation', 2, '/system/design-system?category=foundation', NULL, 43, 1, 1),
  ((SELECT id FROM pms_menu WHERE code = 'design_system'), '页面模式', 'design_system_layout', 2, '/system/design-system?category=layout', NULL, 44, 1, 1),
  ((SELECT id FROM pms_menu WHERE code = 'design_system'), '基础组件', 'design_system_base', 2, '/system/design-system?category=base', NULL, 45, 1, 1),
  ((SELECT id FROM pms_menu WHERE code = 'design_system'), '输入组件', 'design_system_input', 2, '/system/design-system?category=input', NULL, 46, 1, 1),
  ((SELECT id FROM pms_menu WHERE code = 'design_system'), '反馈组件', 'design_system_feedback', 2, '/system/design-system?category=feedback', NULL, 47, 1, 1),
  ((SELECT id FROM pms_menu WHERE code = 'design_system'), '数据展示', 'design_system_display', 2, '/system/design-system?category=display', NULL, 48, 1, 1)
ON CONFLICT (code) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM pms_role r
CROSS JOIN pms_menu m
WHERE r.code = 'admin'
  AND m.code IN (
    'design_system', 'design_system_overview', 'design_system_samples',
    'design_system_foundation', 'design_system_layout', 'design_system_base',
    'design_system_input', 'design_system_feedback', 'design_system_display'
  )
ON CONFLICT (role_id, menu_id) DO NOTHING;
