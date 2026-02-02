ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS drive_permissions_last_synced_at timestamp with time zone;
