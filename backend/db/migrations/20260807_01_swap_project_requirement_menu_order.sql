UPDATE pms_menu
SET sort_order = 8, updated_at = NOW()
WHERE code = 'project';

UPDATE pms_menu
SET sort_order = 7, updated_at = NOW()
WHERE code = 'requirement';
