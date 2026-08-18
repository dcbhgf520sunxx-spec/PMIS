UPDATE pms_menu
SET name = '调整优先级',
    updated_at = NOW()
WHERE code IN (
  'requirement_priority_adjust',
  'project_priority_adjust',
  'task_priority_adjust'
)
  AND name <> '调整优先级';
