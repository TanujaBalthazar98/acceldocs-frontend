-- Add slug column to topics
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique constraint for topic slugs (scoped to project)
CREATE UNIQUE INDEX IF NOT EXISTS topics_slug_project_unique ON public.topics(project_id, slug) WHERE slug IS NOT NULL;

-- Trigger function to auto-generate slugs for topics
CREATE OR REPLACE FUNCTION public.auto_generate_topic_slug()
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
    NEW.slug := ensure_unique_slug(base_slug, 'topics', 'project_id', NEW.project_id, NEW.id);
    
    -- Store old slug in history if updating
    IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug != NEW.slug THEN
      INSERT INTO public.slug_history (entity_type, entity_id, old_slug)
      VALUES ('topic', NEW.id, OLD.slug);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for topics
DROP TRIGGER IF EXISTS auto_slug_topics ON public.topics;
CREATE TRIGGER auto_slug_topics
BEFORE INSERT OR UPDATE ON public.topics
FOR EACH ROW
EXECUTE FUNCTION auto_generate_topic_slug();

-- Update slug_history check constraint to include 'topic'
ALTER TABLE public.slug_history DROP CONSTRAINT IF EXISTS slug_history_entity_type_check;
ALTER TABLE public.slug_history ADD CONSTRAINT slug_history_entity_type_check 
  CHECK (entity_type IN ('organization', 'project', 'topic', 'document'));

-- Generate slugs for existing topics
UPDATE public.topics SET slug = generate_slug(name) WHERE slug IS NULL;