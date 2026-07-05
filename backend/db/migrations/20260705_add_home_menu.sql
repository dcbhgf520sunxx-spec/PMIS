ALTER TABLE pms_user_preference
ALTER COLUMN default_route SET DEFAULT '/home';

INSERT INTO pms_menu (parent_id, name, code, type, path, icon, sort_order, creator_id, updater_id)
VALUES (0, '首页', 'home', 2, '/home', 'HomeOutlined', 5, 1, 1)
ON CONFLICT (code) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  path = EXCLUDED.path,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_deleted = 0,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM pms_role r
CROSS JOIN pms_menu m
WHERE m.code = 'home'
ON CONFLICT (role_id, menu_id) DO NOTHING;
