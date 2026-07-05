UPDATE pms_menu
SET name = '基础设置', parent_id = 0, type = 1, path = NULL, icon = 'SettingOutlined', sort_order = 30, updated_at = NOW()
WHERE code = 'base_settings';

UPDATE pms_menu
SET name = '基础档案', parent_id = (SELECT id FROM pms_menu WHERE code = 'base_settings'), type = 2, path = '/archive', icon = NULL, sort_order = 31, updated_at = NOW()
WHERE code = 'archive';

UPDATE pms_menu
SET name = '访问日志', parent_id = (SELECT id FROM pms_menu WHERE code = 'base_settings'), type = 2, path = '/access-logs', icon = NULL, sort_order = 32, updated_at = NOW()
WHERE code = 'access_log';

UPDATE pms_menu
SET name = '用户权限', parent_id = 0, type = 1, path = NULL, icon = 'UserOutlined', sort_order = 20, updated_at = NOW()
WHERE code = 'user_auth';

UPDATE pms_menu
SET name = '用户管理', parent_id = (SELECT id FROM pms_menu WHERE code = 'user_auth'), type = 2, path = '/users', icon = NULL, sort_order = 21, updated_at = NOW()
WHERE code = 'user';

UPDATE pms_menu
SET name = '角色管理', parent_id = (SELECT id FROM pms_menu WHERE code = 'user_auth'), type = 2, path = '/roles', icon = NULL, sort_order = 22, updated_at = NOW()
WHERE code = 'role';
