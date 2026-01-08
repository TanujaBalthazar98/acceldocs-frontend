-- Add parent_id column to projects for sub-projects (1 level of nesting)
ALTER TABLE public.projects 
ADD COLUMN parent_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Create index for faster parent lookups
CREATE INDEX idx_projects_parent_id ON public.projects(parent_id);

-- Add constraint to prevent deep nesting (only 1 level allowed)
-- A project can only have a parent if that parent has no parent itself
CREATE OR REPLACE FUNCTION public.check_project_nesting_depth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    -- Check if the parent already has a parent (would make this 2+ levels deep)
    IF EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = NEW.parent_id AND parent_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Sub-projects cannot have their own sub-projects (max 1 level of nesting)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_project_nesting_depth
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.check_project_nesting_depth();