-- Create audit_logs table for comprehensive activity tracking
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_audit_logs_project_id ON public.audit_logs(project_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only project admins and org owners can view audit logs
CREATE POLICY "Project admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  has_project_role(project_id, auth.uid(), ARRAY['admin'::project_role])
  OR EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = audit_logs.project_id AND o.owner_id = auth.uid()
  )
);

-- Allow inserts from authenticated users (for logging their own actions)
CREATE POLICY "Users can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create comprehensive RBAC permission check function
CREATE OR REPLACE FUNCTION public.check_project_permission(
  _project_id uuid,
  _user_id uuid,
  _action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role project_role;
  is_org_owner boolean;
BEGIN
  -- Check if user is org owner
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = _project_id AND o.owner_id = _user_id
  ) INTO is_org_owner;
  
  -- Org owners have full access
  IF is_org_owner THEN
    RETURN true;
  END IF;
  
  -- Get user's role on this project
  SELECT role INTO user_role
  FROM project_members
  WHERE project_id = _project_id AND user_id = _user_id;
  
  -- If no role found, check if project is public for view actions
  IF user_role IS NULL THEN
    IF _action IN ('view', 'view_published') THEN
      RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = _project_id AND is_published = true AND visibility = 'public'
      );
    END IF;
    RETURN false;
  END IF;
  
  -- Define permissions per role
  CASE user_role
    WHEN 'admin' THEN
      -- Admin: full access
      RETURN true;
      
    WHEN 'editor' THEN
      -- Editor: can edit, publish, create, but not manage members or delete project
      RETURN _action IN (
        'view', 'view_published', 'view_draft',
        'edit_document', 'create_document', 'delete_document',
        'edit_topic', 'create_topic', 'delete_topic',
        'publish', 'unpublish',
        'sync_content', 'move_topic', 'move_page',
        'edit_metadata', 'export_document'
      );
      
    WHEN 'reviewer' THEN
      -- Reviewer: can only view and comment (comment handled at Drive level)
      RETURN _action IN (
        'view', 'view_published', 'view_draft',
        'comment'
      );
      
    WHEN 'viewer' THEN
      -- Viewer: read-only published docs only
      RETURN _action IN ('view', 'view_published');
      
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Function to log actions to audit table
CREATE OR REPLACE FUNCTION public.log_audit_action(
  _action text,
  _entity_type text,
  _entity_id uuid,
  _project_id uuid,
  _metadata jsonb DEFAULT '{}',
  _success boolean DEFAULT true,
  _error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    project_id,
    metadata,
    success,
    error_message
  ) VALUES (
    auth.uid(),
    _action,
    _entity_type,
    _entity_id,
    _project_id,
    _metadata,
    _success,
    _error_message
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Function to get user's role on a project
CREATE OR REPLACE FUNCTION public.get_project_role(_project_id uuid, _user_id uuid)
RETURNS project_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM projects p
        JOIN organizations o ON o.id = p.organization_id
        WHERE p.id = _project_id AND o.owner_id = _user_id
      ) THEN 'admin'::project_role
      ELSE (
        SELECT role FROM project_members
        WHERE project_id = _project_id AND user_id = _user_id
      )
    END
$$;

-- Function to check if user can perform Drive operations
CREATE OR REPLACE FUNCTION public.can_access_drive(_project_id uuid, _user_id uuid, _operation text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role project_role;
BEGIN
  user_role := get_project_role(_project_id, _user_id);
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  CASE _operation
    -- Edit operations - admin and editor only
    WHEN 'edit' THEN
      RETURN user_role IN ('admin', 'editor');
    -- Download/export - admin and editor only
    WHEN 'download' THEN
      RETURN user_role IN ('admin', 'editor');
    WHEN 'export' THEN
      RETURN user_role IN ('admin', 'editor');
    -- Share through Drive - admin only
    WHEN 'share' THEN
      RETURN user_role = 'admin';
    -- View - all roles can view
    WHEN 'view' THEN
      RETURN true;
    -- Comment - admin, editor, reviewer
    WHEN 'comment' THEN
      RETURN user_role IN ('admin', 'editor', 'reviewer');
    ELSE
      RETURN false;
  END CASE;
END;
$$;