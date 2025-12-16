-- Add published_content_html column to store the last published version of content
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS published_content_html text;

-- Copy existing content_html to published_content_html for already published documents
UPDATE public.documents 
SET published_content_html = content_html 
WHERE is_published = true AND published_content_html IS NULL;