-- Fix infinite recursion between projects <-> project_members RLS policies

-- Helper: check if a user is explicitly a member of a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = _project_id
      AND pm.user_id = _user_id
  );
$$;

-- Helper: can the user view project members for a project? (bypasses RLS)
CREATE OR REPLACE FUNCTION public.can_view_project_members(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT organization_id
    FROM public.projects
    WHERE id = _project_id
  )
  SELECT
    EXISTS (
      SELECT 1
      FROM p
      WHERE public.is_org_owner(p.organization_id, _user_id)
         OR public.is_org_member(p.organization_id, _user_id)
    );
$$;

-- Rework projects policy that referenced project_members (caused recursion)
DROP POLICY IF EXISTS "External users can view invited projects" ON public.projects;
CREATE POLICY "External users can view invited projects"
ON public.projects
FOR SELECT
USING (
  (visibility = 'external'::public.visibility_level)
  AND is_published = true
  AND public.is_project_member(id, auth.uid())
);

-- Rework project_members SELECT policy that referenced projects (caused recursion)
DROP POLICY IF EXISTS "Org members can view project members" ON public.project_members;
CREATE POLICY "Org members can view project members"
ON public.project_members
FOR SELECT
USING (
  public.can_view_project_members(project_id, auth.uid())
);

-- Remove remaining project_members policies that join projects/organizations (avoid recursion)
DROP POLICY IF EXISTS "Project admins can update members" ON public.project_members;
CREATE POLICY "Project admins can update members"
ON public.project_members
FOR UPDATE
USING (public.get_project_role(project_id, auth.uid()) = 'admin'::public.project_role)
WITH CHECK (public.get_project_role(project_id, auth.uid()) = 'admin'::public.project_role);

DROP POLICY IF EXISTS "Project admins can delete members" ON public.project_members;
CREATE POLICY "Project admins can delete members"
ON public.project_members
FOR DELETE
USING (public.get_project_role(project_id, auth.uid()) = 'admin'::public.project_role);
