DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pms_work_order
    WHERE is_deleted = 0
    GROUP BY problem_desc
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '存在重复的有效工单问题描述，无法创建唯一索引';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_work_order_problem_desc_active
  ON pms_work_order(md5(problem_desc))
  WHERE is_deleted = 0;
