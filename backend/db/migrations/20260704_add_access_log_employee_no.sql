ALTER TABLE pms_access_log
  ADD COLUMN IF NOT EXISTS employee_no VARCHAR(50);

UPDATE pms_access_log l
SET employee_no = u.employee_no
FROM pms_user u
WHERE l.user_id = u.id
  AND (l.employee_no IS NULL OR l.employee_no = '');

CREATE INDEX IF NOT EXISTS idx_access_log_employee_no ON pms_access_log(employee_no);
