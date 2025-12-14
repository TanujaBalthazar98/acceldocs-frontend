-- Create project role enum
CREATE TYPE public.project_role AS ENUM ('admin', 'editor', 'reviewer', 'viewer');

-- Create project_members table
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check project membership
CREATE OR REPLACE FUNCTION public.has_project_role(_project_id uuid, _user_id uuid, _roles project_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id
      AND user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Create function to check if user is project admin/editor
CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id
      AND user_id = _user_id
      AND role IN ('admin', 'editor')
  )
  OR EXISTS (
    -- Project creator (org owner) always has access
    SELECT 1
    FROM public.projects p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = _project_id AND o.owner_id = _user_id
  )
$$;

-- RLS Policies for project_members
CREATE POLICY "Org members can view project members"
ON public.project_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_members.project_id
      AND p.organization_id = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Project admins can insert members"
ON public.project_members
FOR INSERT
WITH CHECK (
  can_edit_project(project_id, auth.uid())
);

CREATE POLICY "Project admins can update members"
ON public.project_members
FOR UPDATE
USING (
  has_project_role(project_id, auth.uid(), ARRAY['admin'::project_role])
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = project_members.project_id AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "Project admins can delete members"
ON public.project_members
FOR DELETE
USING (
  has_project_role(project_id, auth.uid(), ARRAY['admin'::project_role])
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = project_members.project_id AND o.owner_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_project_members_updated_at
BEFORE UPDATE ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();