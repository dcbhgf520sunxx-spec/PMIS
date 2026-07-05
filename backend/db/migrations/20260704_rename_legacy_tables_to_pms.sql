DO $$
BEGIN
  IF to_regclass('public.work_order') IS NOT NULL
     AND to_regclass('public.pms_work_order') IS NULL THEN
    ALTER TABLE public.work_order RENAME TO pms_work_order;
  END IF;

  IF to_regclass('public.archive_type') IS NOT NULL
     AND to_regclass('public.pms_archive_type') IS NULL THEN
    ALTER TABLE public.archive_type RENAME TO pms_archive_type;
  END IF;

  IF to_regclass('public.archive') IS NOT NULL
     AND to_regclass('public.pms_archive') IS NULL THEN
    ALTER TABLE public.archive RENAME TO pms_archive;
  END IF;

  IF to_regclass('public.op_log') IS NOT NULL
     AND to_regclass('public.pms_op_log') IS NULL THEN
    ALTER TABLE public.op_log RENAME TO pms_op_log;
  END IF;
END $$;

