-- ============================================================
-- COMPREHENSIVE RBAC ENHANCEMENT MIGRATION (Part 1)
-- ============================================================

-- 1. Enhanced permission check function with full role hierarchy
CREATE OR REPLACE FUNCTION public.check_project_permission(_project_id uuid, _user_id uuid, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role project_role;
  is_org_owner boolean;
BEGIN
  -- Check if user is org owner (org owner = full control like admin)
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = _project_id AND o.owner_id = _user_id
  ) INTO is_org_owner;
  
  IF is_org_owner THEN
    RETURN true;
  END IF;
  
  -- Get user's role on this project
  SELECT role INTO user_role
  FROM project_members
  WHERE project_id = _project_id AND user_id = _user_id;
  
  -- If no role, check for public access
  IF user_role IS NULL THEN
    IF _action IN ('view', 'view_published') THEN
      RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = _project_id AND is_published = true AND visibility = 'public'
      );
    END IF;
    RETURN false;
  END IF;
  
  -- Permission matrix by role
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

-- 2. Enhanced Drive access function with all operations + org owner check
CREATE OR REPLACE FUNCTION public.can_access_drive(_project_id uuid, _user_id uuid, _operation text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role project_role;
  is_org_owner boolean;
BEGIN
  -- Org owner has full Drive access
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = _project_id AND o.owner_id = _user_id
  ) INTO is_org_owner;
  
  IF is_org_owner THEN
    RETURN true;
  END IF;

  user_role := get_project_role(_project_id, _user_id);
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  CASE _operation
    -- Edit operations: admin, editor
    WHEN 'edit' THEN
      RETURN user_role IN ('admin', 'editor');
    WHEN 'write' THEN
      RETURN user_role IN ('admin', 'editor');
    WHEN 'create' THEN
      RETURN user_role IN ('admin', 'editor');
    WHEN 'delete' THEN
      RETURN user_role IN ('admin', 'editor');
      
    -- Download/export: admin, editor
    WHEN 'download' THEN
      RETURN user_role IN ('admin', 'editor');
    WHEN 'export' THEN
      RETURN user_role IN ('admin', 'editor');
      
    -- Share through Drive: admin only
    WHEN 'share' THEN
      RETURN user_role = 'admin';
      
    -- View: all roles
    WHEN 'view' THEN
      RETURN true;
    WHEN 'read' THEN
      RETURN true;
      
    -- Comment: admin, editor, reviewer
    WHEN 'comment' THEN
      RETURN user_role IN ('admin', 'editor', 'reviewer');
      
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- 3. Function to get Drive permission role from app role
CREATE OR REPLACE FUNCTION public.get_drive_permission_for_role(_role project_role)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _role
    WHEN 'admin' THEN 'writer'
    WHEN 'editor' THEN 'writer'
    WHEN 'reviewer' THEN 'commenter'
    WHEN 'viewer' THEN 'reader'
    ELSE NULL
  END;
$$;

-- 4. Create table for tracking Drive permission sync
CREATE TABLE IF NOT EXISTS public.drive_permission_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_member_id uuid REFERENCES project_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  drive_permission_id text,
  role project_role NOT NULL,
  sync_status text NOT NULL DEFAULT 'pending',
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for lookup
CREATE INDEX IF NOT EXISTS idx_drive_permission_sync_project ON drive_permission_sync(project_id);
CREATE INDEX IF NOT EXISTS idx_drive_permission_sync_user ON drive_permission_sync(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_permission_sync_status ON drive_permission_sync(sync_status);

-- Enable RLS
ALTER TABLE public.drive_permission_sync ENABLE ROW LEVEL SECURITY;

-- Policies for drive_permission_sync
DROP POLICY IF EXISTS "Admins can manage drive sync" ON public.drive_permission_sync;
CREATE POLICY "Admins can manage drive sync"
ON public.drive_permission_sync
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = drive_permission_sync.project_id 
    AND (o.owner_id = auth.uid() OR has_project_role(p.id, auth.uid(), ARRAY['admin'::project_role]))
  )
);

DROP POLICY IF EXISTS "Users can view own sync status" ON public.drive_permission_sync;
CREATE POLICY "Users can view own sync status"
ON public.drive_permission_sync
FOR SELECT
USING (user_id = auth.uid());

-- 5. Function to queue Drive permission sync when role changes
CREATE OR REPLACE FUNCTION public.queue_drive_permission_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  project_drive_folder text;
BEGIN
  -- Get project's Drive folder ID
  SELECT drive_folder_id INTO project_drive_folder
  FROM projects
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  
  IF project_drive_folder IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO drive_permission_sync (project_member_id, user_id, project_id, drive_file_id, role, sync_status)
    VALUES (NEW.id, NEW.user_id, NEW.project_id, project_drive_folder, NEW.role, 'pending');
    
  ELSIF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO drive_permission_sync (project_member_id, user_id, project_id, drive_file_id, role, sync_status)
    VALUES (NEW.id, NEW.user_id, NEW.project_id, project_drive_folder, NEW.role, 'pending');
    
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE drive_permission_sync
    SET sync_status = 'pending_removal', updated_at = now()
    WHERE project_member_id = OLD.id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger for permission sync queue
DROP TRIGGER IF EXISTS queue_drive_sync_on_member_change ON project_members;
CREATE TRIGGER queue_drive_sync_on_member_change
AFTER INSERT OR UPDATE OF role OR DELETE ON project_members
FOR EACH ROW
EXECUTE FUNCTION queue_drive_permission_sync();

-- 6. Function to validate role change permissions
CREATE OR REPLACE FUNCTION public.can_change_member_role(_project_id uuid, _actor_id uuid, _target_user_id uuid, _new_role project_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_role project_role;
  target_role project_role;
  is_actor_org_owner boolean;
  is_target_org_owner boolean;
BEGIN
  -- Check if actor is org owner
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = _project_id AND o.owner_id = _actor_id
  ) INTO is_actor_org_owner;
  
  -- Org owners can do anything except demote another org owner
  IF is_actor_org_owner THEN
    SELECT EXISTS (
      SELECT 1 FROM projects p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = _project_id AND o.owner_id = _target_user_id
    ) INTO is_target_org_owner;
    
    RETURN NOT is_target_org_owner;
  END IF;
  
  -- Get actor's role
  actor_role := get_project_role(_project_id, _actor_id);
  target_role := get_project_role(_project_id, _target_user_id);
  
  -- Only admins can change roles
  IF actor_role != 'admin' THEN
    RETURN false;
  END IF;
  
  -- Admins cannot promote to admin (only org owner can)
  IF _new_role = 'admin' THEN
    RETURN false;
  END IF;
  
  -- Cannot change another admin's role
  IF target_role = 'admin' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- 7. Function to check if user can manage project members
CREATE OR REPLACE FUNCTION public.can_manage_project_members(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = _project_id AND o.owner_id = _user_id
  )
  OR has_project_role(_project_id, _user_id, ARRAY['admin'::project_role]);
$$;