-- Add content_id and published_content_id columns to documents table
-- These will be used for future content versioning system

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_id uuid;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS published_content_id uuid;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_content_id 
  ON public.documents(content_id);

CREATE INDEX IF NOT EXISTS idx_documents_published_content_id 
  ON public.documents(published_content_id);

-- Add helpful comments
COMMENT ON COLUMN public.documents.content_id IS 
  'References content for draft/current version';

COMMENT ON COLUMN public.documents.published_content_id IS 
  'References content for published version';
