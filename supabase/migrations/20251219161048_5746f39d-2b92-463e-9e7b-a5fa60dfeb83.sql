-- Add SEO and crawler control fields to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS allow_indexing boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS disallowed_paths text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS allow_llm_training boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_llm_crawlers text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS allow_llm_summarization boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS openapi_spec_url text,
ADD COLUMN IF NOT EXISTS openapi_spec_json jsonb,
ADD COLUMN IF NOT EXISTS mcp_enabled boolean DEFAULT false;