BEGIN;

INSERT INTO pms_menu (id, parent_id, name, code, type, path, icon, sort_order, creator_id, updater_id)
VALUES (23, 0, '知识库', 'knowledge_base', 2, '/knowledge-base', 'BookOutlined', 12, 1, 1)
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
SELECT 1, id FROM pms_menu WHERE code = 'knowledge_base' AND is_deleted = 0
ON CONFLICT (role_id, menu_id) DO NOTHING;

SELECT setval('pms_menu_id_seq', COALESCE((SELECT MAX(id) FROM pms_menu), 1), true);

COMMIT;
