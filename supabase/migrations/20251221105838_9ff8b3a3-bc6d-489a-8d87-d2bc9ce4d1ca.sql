-- Add OpenAPI spec fields to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS openapi_spec_json jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS openapi_spec_url text DEFAULT NULL;