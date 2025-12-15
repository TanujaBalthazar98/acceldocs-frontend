-- Add branding columns to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#1E40AF',
ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#F59E0B',
ADD COLUMN IF NOT EXISTS font_heading TEXT DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS font_body TEXT DEFAULT 'Inter',
ADD COLUMN IF NOT EXISTS custom_css TEXT,
ADD COLUMN IF NOT EXISTS hero_title TEXT,
ADD COLUMN IF NOT EXISTS hero_description TEXT,
ADD COLUMN IF NOT EXISTS show_search_on_landing BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_featured_projects BOOLEAN DEFAULT true;

-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for org logo uploads
CREATE POLICY "Anyone can view org logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

CREATE POLICY "Org owners can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-logos' 
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id::text = (storage.foldername(name))[1]
    AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "Org owners can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-logos' 
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id::text = (storage.foldername(name))[1]
    AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "Org owners can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-logos' 
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id::text = (storage.foldername(name))[1]
    AND o.owner_id = auth.uid()
  )
);