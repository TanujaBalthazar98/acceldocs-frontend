-- Add slug columns to organizations, projects, and documents
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique constraints for slugs (scoped appropriately)
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique ON public.organizations(slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_org_unique ON public.projects(organization_id, slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS documents_slug_project_unique ON public.documents(project_id, slug) WHERE slug IS NOT NULL;

-- Create slug history table for redirects
CREATE TABLE IF NOT EXISTS public.slug_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('organization', 'project', 'document')),
  entity_id UUID NOT NULL,
  old_slug TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS slug_history_lookup ON public.slug_history(entity_type, old_slug);

-- Enable RLS on slug_history
ALTER TABLE public.slug_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for slug_history (public read for redirects)
CREATE POLICY "Anyone can read slug history for redirects"
ON public.slug_history
FOR SELECT
USING (true);

CREATE POLICY "Org users can insert slug history"
ON public.slug_history
FOR INSERT
WITH CHECK (
  CASE 
    WHEN entity_type = 'organization' THEN 
      EXISTS (SELECT 1 FROM organizations o WHERE o.id = entity_id AND o.owner_id = auth.uid())
    WHEN entity_type = 'project' THEN 
      EXISTS (SELECT 1 FROM projects p WHERE p.id = entity_id AND p.organization_id = get_user_org_id(auth.uid()))
    WHEN entity_type = 'document' THEN 
      EXISTS (SELECT 1 FROM documents d JOIN projects p ON p.id = d.project_id WHERE d.id = entity_id AND p.organization_id = get_user_org_id(auth.uid()))
    ELSE false
  END
);

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION public.generate_slug(title TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  )
$$;

-- Function to ensure unique slug within scope
CREATE OR REPLACE FUNCTION public.ensure_unique_slug(
  base_slug TEXT,
  table_name TEXT,
  scope_column TEXT,
  scope_value UUID,
  exclude_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  final_slug TEXT;
  counter INT := 0;
  slug_exists BOOLEAN;
BEGIN
  final_slug := base_slug;
  
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE slug = $1 AND %I = $2 AND ($3 IS NULL OR id != $3))',
      table_name, scope_column
    ) INTO slug_exists USING final_slug, scope_value, exclude_id;
    
    IF NOT slug_exists THEN
      RETURN final_slug;
    END IF;
    
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
END;
$$;

-- Trigger function to auto-generate slugs for projects
CREATE OR REPLACE FUNCTION public.auto_generate_project_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
BEGIN
  -- Only generate slug if not provided or if name changed
  IF NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.name != NEW.name AND NEW.slug = OLD.slug) THEN
    base_slug := generate_slug(NEW.name);
    NEW.slug := ensure_unique_slug(base_slug, 'projects', 'organization_id', NEW.organization_id, NEW.id);
    
    -- Store old slug in history if updating
    IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug != NEW.slug THEN
      INSERT INTO public.slug_history (entity_type, entity_id, old_slug)
      VALUES ('project', NEW.id, OLD.slug);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function to auto-generate slugs for documents
CREATE OR REPLACE FUNCTION public.auto_generate_document_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
BEGIN
  -- Only generate slug if not provided or if title changed
  IF NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.title != NEW.title AND NEW.slug = OLD.slug) THEN
    base_slug := generate_slug(NEW.title);
    NEW.slug := ensure_unique_slug(base_slug, 'documents', 'project_id', NEW.project_id, NEW.id);
    
    -- Store old slug in history if updating
    IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug != NEW.slug THEN
      INSERT INTO public.slug_history (entity_type, entity_id, old_slug)
      VALUES ('document', NEW.id, OLD.slug);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS auto_slug_projects ON public.projects;
CREATE TRIGGER auto_slug_projects
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION auto_generate_project_slug();

DROP TRIGGER IF EXISTS auto_slug_documents ON public.documents;
CREATE TRIGGER auto_slug_documents
BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION auto_generate_document_slug();

-- Generate slugs for existing records
UPDATE public.organizations SET slug = generate_slug(name) WHERE slug IS NULL;
UPDATE public.projects SET slug = generate_slug(name) WHERE slug IS NULL;
UPDATE public.documents SET slug = generate_slug(title) WHERE slug IS NULL;