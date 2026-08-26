-- 将迁移执行时已经存在的需求、项目和任务优先级统一回填为“中”（1）。
-- 不修改字段默认值；迁移完成后新建记录仍按现有规则默认为“低”（0）。

UPDATE pms_requirement
SET priority = 1
WHERE priority IS DISTINCT FROM 1;

UPDATE pms_project
SET priority = 1
WHERE priority IS DISTINCT FROM 1;

UPDATE pms_task
SET priority = 1
WHERE priority IS DISTINCT FROM 1;
