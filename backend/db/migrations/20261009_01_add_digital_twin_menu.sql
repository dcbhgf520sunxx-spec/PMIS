BEGIN;
INSERT INTO pms_menu (parent_id, name, code, type, path, icon, sort_order, creator_id, updater_id)
VALUES (0, '数字孪生', 'digital_twin', 2, '/digital-twin', 'AppstoreOutlined', 12, 1, 1)
ON CONFLICT (code) DO UPDATE SET parent_id = EXCLUDED.parent_id, name = EXCLUDED.name,
  type = EXCLUDED.type, path = EXCLUDED.path, icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order, updater_id = EXCLUDED.updater_id, updated_at = NOW();
UPDATE pms_menu SET sort_order = 13, updater_id = 1, updated_at = NOW()
WHERE code = 'knowledge_base' AND is_deleted = 0 AND sort_order = 12;
INSERT INTO pms_role_menu (role_id, menu_id)
SELECT id, (SELECT id FROM pms_menu WHERE code = 'digital_twin') FROM pms_role
WHERE code = 'admin' AND is_deleted = 0
ON CONFLICT (role_id, menu_id) DO NOTHING;
COMMIT;
