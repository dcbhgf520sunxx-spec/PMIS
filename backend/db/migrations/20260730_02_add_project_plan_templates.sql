CREATE TABLE IF NOT EXISTS pms_project_plan_template (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  status SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_project_plan_template_code UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS pms_project_plan_template_stage (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES pms_project_plan_template(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_project_plan_template_stage_name UNIQUE (template_id, name)
);

CREATE TABLE IF NOT EXISTS pms_project_plan_template_item (
  id BIGSERIAL PRIMARY KEY,
  template_stage_id BIGINT NOT NULL REFERENCES pms_project_plan_template_stage(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  requires_delivery_file SMALLINT NOT NULL DEFAULT 0 CHECK (requires_delivery_file IN (0,1)),
  delivery_requirement TEXT,
  remark TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_project_plan_template_item_name UNIQUE (template_stage_id, name),
  CHECK (requires_delivery_file = 0 OR NULLIF(BTRIM(delivery_requirement), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_project_plan_template_enabled
  ON pms_project_plan_template(status, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_project_plan_template_stage_sort
  ON pms_project_plan_template_stage(template_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_project_plan_template_item_sort
  ON pms_project_plan_template_item(template_stage_id, sort_order, id);

INSERT INTO pms_project_plan_template(code,name,description,status,sort_order)
VALUES('ai_project_standard','AI 项目标准模板','AI 项目从立项到验收的标准阶段主计划',1,0)
ON CONFLICT(code) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  status=EXCLUDED.status,
  sort_order=EXCLUDED.sort_order,
  updated_at=NOW();

INSERT INTO pms_project_plan_template_stage(template_id,name,description,sort_order)
SELECT t.id,v.name,NULL,v.sort_order
FROM pms_project_plan_template t
CROSS JOIN (VALUES
  ('项目立项',0),
  ('场景定义与前期筹备',1),
  ('数据准备与环境搭建',2),
  ('模型开发与技术落地',3),
  ('系统联调与功能验证',4),
  ('试运行与优化完善',5),
  ('项目验收与成果交付',6)
) v(name,sort_order)
WHERE t.code='ai_project_standard'
ON CONFLICT(template_id,name) DO UPDATE SET
  sort_order=EXCLUDED.sort_order,
  updated_at=NOW();

INSERT INTO pms_project_plan_template_item
  (template_stage_id,name,requires_delivery_file,delivery_requirement,remark,sort_order)
SELECT s.id,v.item_name,v.requires_delivery,
  CASE WHEN v.requires_delivery=1 THEN '关键交付文件' ELSE NULL END,
  NULL,v.item_sort
FROM pms_project_plan_template t
JOIN pms_project_plan_template_stage s ON s.template_id=t.id
JOIN (VALUES
  ('项目立项','需求场景说明',0,0),
  ('项目立项','立项汇报',1,1),
  ('场景定义与前期筹备','项目团队组建',0,0),
  ('场景定义与前期筹备','场景需求调研及评审',1,1),
  ('场景定义与前期筹备','项目主计划',0,2),
  ('场景定义与前期筹备','需求说明书及评审',1,3),
  ('场景定义与前期筹备','实施方案及评审',1,4),
  ('场景定义与前期筹备','外部供应商商务',0,5),
  ('场景定义与前期筹备','项目启动会',0,6),
  ('数据准备与环境搭建','原始数据准备',1,0),
  ('数据准备与环境搭建','数据治理',0,1),
  ('数据准备与环境搭建','数据对接规范与接口开发',0,2),
  ('数据准备与环境搭建','开发&测试环境搭建',0,3),
  ('模型开发与技术落地','方案设计与评审',1,0),
  ('模型开发与技术落地','模型训练与调优',0,1),
  ('模型开发与技术落地','功能模块开发',0,2),
  ('模型开发与技术落地','系统集成与联调',0,3),
  ('系统联调与功能验证','功能测试',0,0),
  ('系统联调与功能验证','用户测试',0,1),
  ('系统联调与功能验证','测试报告',1,2),
  ('系统联调与功能验证','上线确认',0,3),
  ('系统联调与功能验证','生产环境部署',0,4),
  ('试运行与优化完善','用户培训',0,0),
  ('试运行与优化完善','系统运维',0,1),
  ('试运行与优化完善','试运行报告',1,2),
  ('项目验收与成果交付','成果准备',0,0),
  ('项目验收与成果交付','项目验收',1,1)
) v(stage_name,item_name,requires_delivery,item_sort) ON v.stage_name=s.name
WHERE t.code='ai_project_standard'
ON CONFLICT(template_stage_id,name) DO UPDATE SET
  requires_delivery_file=EXCLUDED.requires_delivery_file,
  delivery_requirement=EXCLUDED.delivery_requirement,
  sort_order=EXCLUDED.sort_order,
  updated_at=NOW();
