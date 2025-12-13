-- Add drive_folder_id column to organizations for the root Drive folder
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS drive_folder_id text;