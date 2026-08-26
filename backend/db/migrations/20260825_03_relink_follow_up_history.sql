UPDATE pms_op_log AS log
SET module = CASE
      WHEN follow_up.project_id IS NOT NULL THEN '项目'
      WHEN follow_up.requirement_id IS NOT NULL THEN '需求'
      ELSE '任务'
    END,
    target_id = COALESCE(follow_up.project_id, follow_up.requirement_id, follow_up.task_id),
    target_name = CASE
      WHEN follow_up.project_id IS NOT NULL THEN (SELECT project.name FROM pms_project AS project WHERE project.id = follow_up.project_id)
      WHEN follow_up.requirement_id IS NOT NULL THEN (SELECT requirement.title FROM pms_requirement AS requirement WHERE requirement.id = follow_up.requirement_id)
      ELSE (SELECT task.name FROM pms_task AS task WHERE task.id = follow_up.task_id)
    END,
    action = CASE log.action
      WHEN '新增' THEN '新增跟进'
      WHEN '编辑' THEN '编辑跟进'
      WHEN '删除' THEN '删除跟进'
      ELSE log.action
    END,
    field_name = 'follow_up_content',
    old_value = CASE WHEN log.action = '删除' THEN follow_up.content ELSE log.old_value END,
    new_value = CASE WHEN log.action = '删除' THEN NULL ELSE log.new_value END
FROM pms_follow_up_record AS follow_up
WHERE log.module = '跟进记录'
  AND log.target_id = follow_up.id;
