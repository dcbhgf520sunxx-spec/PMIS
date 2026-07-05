DO $$
DECLARE
  next_code TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pms_archive_type WHERE code_prefix = 'SYS') THEN
    UPDATE pms_archive_type SET name = '系统', is_deleted = 0, updated_at = NOW() WHERE code_prefix = 'SYS';
  ELSE
    SELECT LPAD((COALESCE(MAX(code::INT), 0) + 1)::TEXT, 3, '0') INTO next_code FROM pms_archive_type WHERE code ~ '^[0-9]+$';
    INSERT INTO pms_archive_type (code, code_prefix, name, creator_id, updater_id) VALUES (next_code, 'SYS', '系统', 1, 1);
  END IF;

  IF EXISTS (SELECT 1 FROM pms_archive_type WHERE code_prefix = 'PT') THEN
    UPDATE pms_archive_type SET name = '问题类型', is_deleted = 0, updated_at = NOW() WHERE code_prefix = 'PT';
  ELSE
    SELECT LPAD((COALESCE(MAX(code::INT), 0) + 1)::TEXT, 3, '0') INTO next_code FROM pms_archive_type WHERE code ~ '^[0-9]+$';
    INSERT INTO pms_archive_type (code, code_prefix, name, creator_id, updater_id) VALUES (next_code, 'PT', '问题类型', 1, 1);
  END IF;

  IF EXISTS (SELECT 1 FROM pms_archive_type WHERE code_prefix = 'NT') THEN
    UPDATE pms_archive_type SET name = '档案分类', is_deleted = 0, updated_at = NOW() WHERE code_prefix = 'NT';
  ELSE
    SELECT LPAD((COALESCE(MAX(code::INT), 0) + 1)::TEXT, 3, '0') INTO next_code FROM pms_archive_type WHERE code ~ '^[0-9]+$';
    INSERT INTO pms_archive_type (code, code_prefix, name, creator_id, updater_id) VALUES (next_code, 'NT', '档案分类', 1, 1);
  END IF;

  IF EXISTS (SELECT 1 FROM pms_archive_type WHERE code_prefix = 'PLAN') THEN
    UPDATE pms_archive_type SET name = '方案分类', is_deleted = 0, updated_at = NOW() WHERE code_prefix = 'PLAN';
  ELSE
    SELECT LPAD((COALESCE(MAX(code::INT), 0) + 1)::TEXT, 3, '0') INTO next_code FROM pms_archive_type WHERE code ~ '^[0-9]+$';
    INSERT INTO pms_archive_type (code, code_prefix, name, creator_id, updater_id) VALUES (next_code, 'PLAN', '方案分类', 1, 1);
  END IF;
END $$;

INSERT INTO pms_archive (code, name, archive_type_id, sort_order, status, creator_id, updater_id, is_deleted)
VALUES
  ('SYS001', '后台管理系统', (SELECT id FROM pms_archive_type WHERE code_prefix = 'SYS'), 1, 1, 1, 1, 0),
  ('PT001', '日常操作', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 1, 1, 1, 1, 0),
  ('PT002', '系统优化', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 2, 1, 1, 1, 0),
  ('PT003', '故障报障', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 3, 1, 1, 1, 0),
  ('PT004', '后台维护', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 4, 1, 1, 1, 0),
  ('PT005', '其他', (SELECT id FROM pms_archive_type WHERE code_prefix = 'PT'), 5, 1, 1, 1, 0)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  archive_type_id = EXCLUDED.archive_type_id,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  is_deleted = 0,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_role (code, name, description, creator_id, updater_id, is_deleted)
SELECT
  'demo_role_' || LPAD(i::TEXT, 3, '0'),
  '模拟角色' || LPAD(i::TEXT, 3, '0'),
  '用于列表、表单、详情和权限样板验证的模拟角色' || LPAD(i::TEXT, 3, '0'),
  1,
  1,
  0
FROM generate_series(1, 60) AS s(i)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_deleted = 0,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_role_menu (role_id, menu_id)
SELECT r.id, m.id
FROM pms_role r
CROSS JOIN pms_menu m
WHERE r.code LIKE 'demo_role_%'
ON CONFLICT (role_id, menu_id) DO NOTHING;

INSERT INTO pms_user (employee_no, real_name, phone, password, status, first_login, creator_id, updater_id, is_deleted)
SELECT
  'MUSER' || LPAD(i::TEXT, 3, '0'),
  '模拟用户' || LPAD(i::TEXT, 3, '0'),
  '139' || LPAD(i::TEXT, 8, '0'),
  '$2b$10$sJ8gCvuCgJQbcihvZEIWheUQEq1oIyVVh3EZa8fSlpOy80ihQ5UPi',
  CASE WHEN i % 10 = 0 THEN 0 ELSE 1 END,
  0,
  1,
  1,
  0
FROM generate_series(1, 60) AS s(i)
ON CONFLICT (employee_no) DO UPDATE SET
  real_name = EXCLUDED.real_name,
  phone = EXCLUDED.phone,
  status = EXCLUDED.status,
  first_login = EXCLUDED.first_login,
  is_deleted = 0,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_user_role (user_id, role_id)
SELECT u.id, r.id
FROM generate_series(1, 60) AS s(i)
JOIN pms_user u ON u.employee_no = 'MUSER' || LPAD(i::TEXT, 3, '0')
JOIN pms_role r ON r.code = 'demo_role_' || LPAD((((i - 1) % 60) + 1)::TEXT, 3, '0')
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO pms_archive (code, name, archive_type_id, sort_order, status, creator_id, updater_id, is_deleted)
SELECT
  'PLAN' || LPAD(i::TEXT, 3, '0'),
  '方案分类' || LPAD(i::TEXT, 3, '0'),
  (SELECT id FROM pms_archive_type WHERE code_prefix = 'PLAN'),
  i,
  CASE WHEN i % 12 = 0 THEN 0 ELSE 1 END,
  1,
  1,
  0
FROM generate_series(1, 60) AS s(i)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  archive_type_id = EXCLUDED.archive_type_id,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  is_deleted = 0,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

INSERT INTO pms_archive (code, name, archive_type_id, sort_order, status, creator_id, updater_id, is_deleted)
SELECT
  'NT' || LPAD(i::TEXT, 3, '0'),
  '档案分类' || LPAD(i::TEXT, 3, '0'),
  (SELECT id FROM pms_archive_type WHERE code_prefix = 'NT'),
  i,
  CASE WHEN i % 15 = 0 THEN 0 ELSE 1 END,
  1,
  1,
  0
FROM generate_series(1, 60) AS s(i)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  archive_type_id = EXCLUDED.archive_type_id,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  is_deleted = 0,
  updater_id = EXCLUDED.updater_id,
  updated_at = NOW();

WITH demo_orders AS (
  SELECT
    i,
    '模拟工单' || LPAD(i::TEXT, 3, '0') || '：' ||
      (ARRAY['账号权限调整', '数据同步异常', '基础档案维护', '报表口径确认', '流程节点配置', '系统参数优化'])[((i - 1) % 6) + 1] AS problem_desc,
    'MUSER' || LPAD((((i - 1) % 60) + 1)::TEXT, 3, '0') AS follower_no,
    'PT' || LPAD((((i - 1) % 5) + 1)::TEXT, 3, '0') AS problem_type_code
  FROM generate_series(1, 60) AS s(i)
)
INSERT INTO pms_work_order (
  system_id,
  problem_type,
  problem_desc,
  result_desc,
  follower_id,
  urgency,
  status,
  is_overdue,
  expected_resolve_date,
  resolve_date,
  close_date,
  submitter_name,
  submitter_dept,
  submit_time,
  creator_id,
  updater_id,
  is_deleted
)
SELECT
  sys.id,
  pt.id,
  d.problem_desc,
  CASE WHEN d.i % 4 IN (2, 3) THEN '已按模拟流程处理完成' ELSE NULL END,
  follower.id,
  (d.i - 1) % 3,
  (d.i - 1) % 4,
  CASE WHEN d.i % 9 = 0 THEN 1 ELSE 0 END,
  NOW() + ((d.i % 10) - 3) * INTERVAL '1 day',
  CASE WHEN d.i % 4 IN (2, 3) THEN NOW() - (d.i % 5) * INTERVAL '1 day' ELSE NULL END,
  CASE WHEN d.i % 4 = 3 THEN NOW() - (d.i % 3) * INTERVAL '1 day' ELSE NULL END,
  '提交人' || LPAD(d.i::TEXT, 3, '0'),
  (ARRAY['综合部', '运营部', '财务部', '客服部', '技术部'])[((d.i - 1) % 5) + 1],
  NOW() - (d.i % 20) * INTERVAL '1 day',
  1,
  1,
  0
FROM demo_orders d
JOIN pms_archive sys ON sys.code = 'SYS001'
JOIN pms_archive pt ON pt.code = d.problem_type_code
JOIN pms_user follower ON follower.employee_no = d.follower_no
WHERE NOT EXISTS (
  SELECT 1 FROM pms_work_order w WHERE w.problem_desc = d.problem_desc AND w.is_deleted = 0
);

SELECT setval(pg_get_serial_sequence('pms_user', 'id'), COALESCE((SELECT MAX(id) FROM pms_user), 1), true);
SELECT setval(pg_get_serial_sequence('pms_role', 'id'), COALESCE((SELECT MAX(id) FROM pms_role), 1), true);
SELECT setval(pg_get_serial_sequence('pms_archive_type', 'id'), COALESCE((SELECT MAX(id) FROM pms_archive_type), 1), true);
SELECT setval(pg_get_serial_sequence('pms_archive', 'id'), COALESCE((SELECT MAX(id) FROM pms_archive), 1), true);
SELECT setval(pg_get_serial_sequence('pms_work_order', 'id'), COALESCE((SELECT MAX(id) FROM pms_work_order), 1), true);
