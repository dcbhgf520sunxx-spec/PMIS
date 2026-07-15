ALTER TABLE pms_bug DROP CONSTRAINT IF EXISTS chk_bug_activation_reason;

ALTER TABLE pms_bug ADD CONSTRAINT chk_bug_activation_reason CHECK (
  (status <> 3 OR activation_reason IS NOT NULL)
  AND (
    activation_reason IS NULL
    OR (btrim(activation_reason) <> '' AND char_length(activation_reason) <= 100)
  )
);
