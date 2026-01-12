-- Drop the current public document viewing policy
DROP POLICY IF EXISTS "Public documents are viewable by everyone" ON public.documents;

-- Create updated policy that allows viewing documents when:
-- 1. The document itself is public and published, OR
-- 2. The parent project is public and published, AND the document is published with published_content_html
CREATE POLICY "Public documents are viewable by everyone" 
ON public.documents 
FOR SELECT 
USING (
  -- Direct document-level public visibility
  ((visibility = 'public'::visibility_level) AND (is_published = true))
  OR
  -- Project-level public visibility (document inherits from project)
  (
    (is_published = true) 
    AND (published_content_html IS NOT NULL)
    AND EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = documents.project_id 
      AND p.visibility = 'public'::visibility_level 
      AND p.is_published = true
    )
  )
);