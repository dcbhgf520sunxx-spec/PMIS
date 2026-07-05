UPDATE pms_menu
SET sort_order = 20, updated_at = NOW()
WHERE code = 'user_auth';

UPDATE pms_menu
SET sort_order = 21, updated_at = NOW()
WHERE code = 'user';

UPDATE pms_menu
SET sort_order = 22, updated_at = NOW()
WHERE code = 'role';

UPDATE pms_menu
SET sort_order = 30, updated_at = NOW()
WHERE code = 'base_settings';

UPDATE pms_menu
SET sort_order = 31, updated_at = NOW()
WHERE code = 'archive';

UPDATE pms_menu
SET sort_order = 32, updated_at = NOW()
WHERE code = 'access_log';
