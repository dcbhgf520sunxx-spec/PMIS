DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pms_bug
    WHERE activation_reason IS NOT NULL AND char_length(activation_reason) > 100
  ) THEN
    RAISE EXCEPTION '存在超过 100 字的激活原因，请先人工确认后再执行迁移';
  END IF;
END $$;

ALTER TABLE pms_bug DROP CONSTRAINT IF EXISTS chk_bug_activation_reason;
ALTER TABLE pms_bug ADD CONSTRAINT chk_bug_activation_reason CHECK (
  (status = 3 AND activation_reason IS NOT NULL AND btrim(activation_reason) <> '' AND char_length(activation_reason) <= 100)
  OR (status <> 3 AND activation_reason IS NULL)
);
