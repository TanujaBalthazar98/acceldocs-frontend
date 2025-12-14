-- Create topics table for subfolders within projects
CREATE TABLE public.topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Users can view topics in their org's projects
CREATE POLICY "Users can view topics in their org projects"
ON public.topics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = topics.project_id
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

-- Users can create topics in their org's projects
CREATE POLICY "Users can create topics in their org projects"
ON public.topics
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = topics.project_id
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

-- Users can update topics in their org's projects
CREATE POLICY "Users can update topics in their org projects"
ON public.topics
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = topics.project_id
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

-- Add topic_id to documents table (pages belong to topics, not directly to projects)
ALTER TABLE public.documents ADD COLUMN topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE;

-- Create trigger for updated_at
CREATE TRIGGER update_topics_updated_at
BEFORE UPDATE ON public.topics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();