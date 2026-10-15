BEGIN;
UPDATE pms_menu
SET icon = 'BlockOutlined', updater_id = 1, updated_at = NOW()
WHERE code = 'digital_twin' AND is_deleted = 0;
COMMIT;
