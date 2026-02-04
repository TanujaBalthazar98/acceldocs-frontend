-- Allow topics without a Drive folder (non-Drive projects or pre-sync creation)
ALTER TABLE public.topics
  ALTER COLUMN drive_folder_id DROP NOT NULL;

-- Optional: remove any empty-string defaults if present (safety)
ALTER TABLE public.topics
  ALTER COLUMN drive_folder_id DROP DEFAULT;
