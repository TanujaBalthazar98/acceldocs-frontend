-- Fix org-level RBAC: users with an organization role (admin/editor/viewer)
-- should automatically have equivalent project permissions across all projects in the org,
-- even if they are not explicitly present in project_members.

CREATE OR REPLACE FUNCTION public.get_project_role(_project_id uuid, _user_id uuid)
RETURNS public.project_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org_id uuid;
  _org_role public.app_role;
  _proj_role public.project_role;
BEGIN
  SELECT organization_id INTO _org_id
  FROM public.projects
  WHERE id = _project_id;

  IF _org_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Org owner always maps to admin on all projects
  IF public.is_org_owner(_org_id, _user_id) THEN
    RETURN 'admin'::public.project_role;
  END IF;

  -- Map org-level roles to project roles
  SELECT role INTO _org_role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND organization_id = _org_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'editor' THEN 2
    WHEN 'viewer' THEN 3
    WHEN 'owner' THEN 0
    ELSE 9
  END
  LIMIT 1;

  IF _org_role IS NOT NULL THEN
    IF _org_role = 'admin' THEN
      RETURN 'admin'::public.project_role;
    ELSIF _org_role = 'editor' THEN
      RETURN 'editor'::public.project_role;
    ELSIF _org_role = 'viewer' THEN
      RETURN 'viewer'::public.project_role;
    ELSIF _org_role = 'owner' THEN
      RETURN 'admin'::public.project_role;
    END IF;
  END IF;

  -- Fallback to explicit per-project membership
  SELECT role INTO _proj_role
  FROM public.project_members
  WHERE project_id = _project_id
    AND user_id = _user_id
  LIMIT 1;

  RETURN _proj_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    public.get_project_role(_project_id, _user_id) IN (
      'admin'::public.project_role,
      'editor'::public.project_role
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.check_project_permission(_project_id uuid, _user_id uuid, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role public.project_role;
BEGIN
  user_role := public.get_project_role(_project_id, _user_id);

  -- If no role, allow view of public published projects only
  IF user_role IS NULL THEN
    IF _action IN ('view', 'view_published') THEN
      RETURN EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = _project_id
          AND is_published = true
          AND visibility = 'public'::public.visibility_level
      );
    END IF;
    RETURN false;
  END IF;

  CASE user_role
    WHEN 'admin' THEN
      -- Full project control (except org-level actions)
      RETURN true;

    WHEN 'editor' THEN
      RETURN _action IN (
        'view', 'view_published', 'view_draft',
        'edit_document', 'create_document', 'delete_document',
        'edit_topic', 'create_topic', 'delete_topic',
        'publish', 'unpublish',
        'sync_content', 'move_topic', 'move_page',
        'edit_metadata', 'export_document', 'download_document',
        'edit_project_settings'
      );

    WHEN 'reviewer' THEN
      RETURN _action IN (
        'view', 'view_published', 'view_draft',
        'comment', 'view_audit_logs'
      );

    WHEN 'viewer' THEN
      RETURN _action IN ('view', 'view_published');

    ELSE
      RETURN false;
  END CASE;
END;
$$;