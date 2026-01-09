-- Allow 'stopped' status for import jobs
ALTER TABLE public.import_jobs DROP CONSTRAINT IF EXISTS import_jobs_status_check;
ALTER TABLE public.import_jobs
  ADD CONSTRAINT import_jobs_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'processing'::text,
        'completed'::text,
        'failed'::text,
        'stopped'::text
      ]
    )
  );