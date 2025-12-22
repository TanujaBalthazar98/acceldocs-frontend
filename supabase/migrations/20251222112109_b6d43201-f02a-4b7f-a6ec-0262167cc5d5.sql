-- Create enum for connector types
CREATE TYPE public.connector_type AS ENUM ('atlassian', 'claude', 'custom_mcp');

-- Create enum for connector status
CREATE TYPE public.connector_status AS ENUM ('connected', 'disconnected', 'error', 'configuring');

-- Create connectors table (registry of available connectors per project)
CREATE TABLE public.connectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  connector_type connector_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  endpoint_url TEXT,
  status connector_status NOT NULL DEFAULT 'disconnected',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  last_health_check TIMESTAMP WITH TIME ZONE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(project_id, connector_type)
);

-- Create connector_credentials table (secure storage for API keys/OAuth tokens)
CREATE TABLE public.connector_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connector_id UUID NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE UNIQUE,
  encrypted_credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create connector_actions table (log of all connector actions)
CREATE TABLE public.connector_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connector_id UUID NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create connector_permissions table (role-based connector access)
CREATE TABLE public.connector_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connector_id UUID NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  role project_role NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_use BOOLEAN NOT NULL DEFAULT false,
  can_configure BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(connector_id, role)
);

-- Enable RLS on all connector tables
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for connectors table
CREATE POLICY "Project members can view connectors"
ON public.connectors FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = connectors.project_id
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Project admins can manage connectors"
ON public.connectors FOR ALL
USING (
  has_project_role(project_id, auth.uid(), ARRAY['admin'::project_role])
  OR EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = connectors.project_id AND o.owner_id = auth.uid()
  )
);

-- RLS Policies for connector_credentials (only admins can access)
CREATE POLICY "Only project admins can view credentials"
ON public.connector_credentials FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM connectors c
    WHERE c.id = connector_credentials.connector_id
    AND (
      has_project_role(c.project_id, auth.uid(), ARRAY['admin'::project_role])
      OR EXISTS (
        SELECT 1 FROM projects p
        JOIN organizations o ON o.id = p.organization_id
        WHERE p.id = c.project_id AND o.owner_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Only project admins can manage credentials"
ON public.connector_credentials FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM connectors c
    WHERE c.id = connector_credentials.connector_id
    AND (
      has_project_role(c.project_id, auth.uid(), ARRAY['admin'::project_role])
      OR EXISTS (
        SELECT 1 FROM projects p
        JOIN organizations o ON o.id = p.organization_id
        WHERE p.id = c.project_id AND o.owner_id = auth.uid()
      )
    )
  )
);

-- RLS Policies for connector_actions
CREATE POLICY "Project members can view connector actions"
ON public.connector_actions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = connector_actions.project_id
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Authorized users can create connector actions"
ON public.connector_actions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM connectors c
    JOIN connector_permissions cp ON cp.connector_id = c.id
    JOIN project_members pm ON pm.project_id = c.project_id AND pm.user_id = auth.uid()
    WHERE c.id = connector_actions.connector_id
    AND cp.role = pm.role
    AND cp.can_use = true
  )
);

-- RLS Policies for connector_permissions
CREATE POLICY "Project members can view connector permissions"
ON public.connector_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM connectors c
    JOIN projects p ON p.id = c.project_id
    WHERE c.id = connector_permissions.connector_id
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

CREATE POLICY "Project admins can manage connector permissions"
ON public.connector_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM connectors c
    WHERE c.id = connector_permissions.connector_id
    AND (
      has_project_role(c.project_id, auth.uid(), ARRAY['admin'::project_role])
      OR EXISTS (
        SELECT 1 FROM projects p
        JOIN organizations o ON o.id = p.organization_id
        WHERE p.id = c.project_id AND o.owner_id = auth.uid()
      )
    )
  )
);

-- Function to check if user can use a connector
CREATE OR REPLACE FUNCTION public.can_use_connector(_connector_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role project_role;
  connector_project_id UUID;
  is_org_owner BOOLEAN;
BEGIN
  -- Get connector's project
  SELECT project_id INTO connector_project_id FROM connectors WHERE id = _connector_id;
  
  IF connector_project_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if org owner
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = connector_project_id AND o.owner_id = _user_id
  ) INTO is_org_owner;
  
  IF is_org_owner THEN
    RETURN true;
  END IF;
  
  -- Get user's role
  SELECT role INTO user_role FROM project_members
  WHERE project_id = connector_project_id AND user_id = _user_id;
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Admins can always use connectors
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Check connector permissions for role
  RETURN EXISTS (
    SELECT 1 FROM connector_permissions
    WHERE connector_id = _connector_id
    AND role = user_role
    AND can_use = true
  );
END;
$$;

-- Function to check if user can configure a connector
CREATE OR REPLACE FUNCTION public.can_configure_connector(_connector_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  connector_project_id UUID;
BEGIN
  -- Get connector's project
  SELECT project_id INTO connector_project_id FROM connectors WHERE id = _connector_id;
  
  IF connector_project_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Only admins and org owners can configure
  RETURN has_project_role(connector_project_id, _user_id, ARRAY['admin'::project_role])
    OR EXISTS (
      SELECT 1 FROM projects p
      JOIN organizations o ON o.id = p.organization_id
      WHERE p.id = connector_project_id AND o.owner_id = _user_id
    );
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_connectors_updated_at
BEFORE UPDATE ON public.connectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_connector_credentials_updated_at
BEFORE UPDATE ON public.connector_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_connectors_project_id ON public.connectors(project_id);
CREATE INDEX idx_connectors_status ON public.connectors(status);
CREATE INDEX idx_connector_actions_connector_id ON public.connector_actions(connector_id);
CREATE INDEX idx_connector_actions_user_id ON public.connector_actions(user_id);
CREATE INDEX idx_connector_actions_created_at ON public.connector_actions(created_at DESC);