-- Add custom_links column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS custom_links jsonb DEFAULT '[]'::jsonb;
