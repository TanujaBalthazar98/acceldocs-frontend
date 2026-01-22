CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: account_type; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
  CREATE TYPE public.account_type AS ENUM (
      'individual',
      'team',
      'enterprise'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM (
      'owner',
      'admin',
      'editor',
      'viewer'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


--
-- Name: connector_status; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
  CREATE TYPE public.connector_status AS ENUM (
      'connected',
      'disconnected',
      'error',
      'configuring'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


--
-- Name: connector_type; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
  CREATE TYPE public.connector_type AS ENUM (
      'atlassian',
      'claude',
      'custom_mcp'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


--
-- Name: project_role; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
  CREATE TYPE public.project_role AS ENUM (
      'admin',
      'editor',
      'reviewer',
      'viewer'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


--
-- Name: visibility_level; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
  CREATE TYPE public.visibility_level AS ENUM (
      'internal',
      'external',
      'public'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;


--
-- Name: accept_invitation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.accept_invitation(uuid);
DROP FUNCTION IF EXISTS public.accept_invitation(invitation_token uuid) CASCADE;
CREATE FUNCTION public.accept_invitation(invitation_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  inv RECORD;
  user_email TEXT;
  user_domain TEXT;
  inv_domain TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM public.profiles WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get invitation
  SELECT * INTO inv FROM public.invitations 
  WHERE token = invitation_token 
    AND accepted_at IS NULL 
    AND expires_at > now();
  
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Verify email matches
  IF inv.email != user_email THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;
  
  -- Verify domain matches org domain
  user_domain := split_part(user_email, '@', 2);
  SELECT domain INTO inv_domain FROM public.organizations WHERE id = inv.organization_id;
  
  IF user_domain != inv_domain THEN
    RAISE EXCEPTION 'Your email domain does not match the organization';
  END IF;
  
  -- Update user profile to join org
  UPDATE public.profiles 
  SET organization_id = inv.organization_id,
      account_type = 'team'
  WHERE id = auth.uid();
  
  -- Add user role
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), inv.organization_id, inv.role)
  ON CONFLICT DO NOTHING;
  
  -- Mark invitation as accepted
  UPDATE public.invitations 
  SET accepted_at = now() 
  WHERE id = inv.id;
  
  RETURN TRUE;
END;
$$;


--
-- Name: accept_project_invitation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.accept_project_invitation(uuid);
DROP FUNCTION IF EXISTS public.accept_project_invitation(invitation_token uuid) CASCADE;
CREATE FUNCTION public.accept_project_invitation(invitation_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  inv RECORD;
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM public.profiles WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get invitation
  SELECT * INTO inv FROM public.project_invitations 
  WHERE token = invitation_token 
    AND accepted_at IS NULL 
    AND expires_at > now();
  
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Verify email matches
  IF inv.email != user_email THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;
  
  -- Add user as project member
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (inv.project_id, auth.uid(), inv.role)
  ON CONFLICT DO NOTHING;
  
  -- Mark invitation as accepted
  UPDATE public.project_invitations 
  SET accepted_at = now() 
  WHERE id = inv.id;
  
  RETURN TRUE;
END;
$$;


--
-- Name: approve_join_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.approve_join_request(uuid);
DROP FUNCTION IF EXISTS public.approve_join_request(_request_id uuid) CASCADE;
CREATE FUNCTION public.approve_join_request(_request_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  req RECORD;
BEGIN
  -- Get the request
  SELECT * INTO req FROM public.join_requests 
  WHERE id = _request_id AND status = 'pending';
  
  IF req IS NULL THEN
    RAISE EXCEPTION 'Invalid or already processed request';
  END IF;
  
  -- Verify caller is org owner or admin
  IF NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = req.organization_id AND o.owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.organization_id = req.organization_id 
    AND ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to approve requests';
  END IF;
  
  -- Update request status
  UPDATE public.join_requests 
  SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = _request_id;
  
  -- Update user's profile to join the org
  UPDATE public.profiles 
  SET organization_id = req.organization_id, account_type = 'team'
  WHERE id = req.user_id;
  
  -- Add viewer role for the new member
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (req.user_id, req.organization_id, 'viewer')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN TRUE;
END;
$$;


--
-- Name: auto_generate_document_slug(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.auto_generate_document_slug() CASCADE;
CREATE FUNCTION public.auto_generate_document_slug() RETURNS trigger
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


--
-- Name: auto_generate_project_slug(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.auto_generate_project_slug() CASCADE;
CREATE FUNCTION public.auto_generate_project_slug() RETURNS trigger
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


--
-- Name: auto_generate_topic_slug(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.auto_generate_topic_slug() CASCADE;
CREATE FUNCTION public.auto_generate_topic_slug() RETURNS trigger
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


--
-- Name: can_access_drive(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.can_access_drive(_project_id uuid, _user_id uuid, _operation text) CASCADE;

CREATE FUNCTION public.can_access_drive(_project_id uuid, _user_id uuid, _operation text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
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


--
-- Name: can_change_member_role(uuid, uuid, uuid, public.project_role); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.can_change_member_role(_project_id uuid, _actor_id uuid, _target_user_id uuid, _new_role public.project_role) CASCADE;
CREATE FUNCTION public.can_change_member_role(_project_id uuid, _actor_id uuid, _target_user_id uuid, _new_role public.project_role) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
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


--
-- Name: can_configure_connector(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.can_configure_connector(_connector_id uuid, _user_id uuid) CASCADE;
CREATE FUNCTION public.can_configure_connector(_connector_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
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


--
-- Name: can_edit_project(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.can_edit_project(_project_id uuid, _user_id uuid) CASCADE;
CREATE FUNCTION public.can_edit_project(_project_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: can_manage_project_members(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.can_manage_project_members(_project_id uuid, _user_id uuid) CASCADE;
CREATE FUNCTION public.can_manage_project_members(_project_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE p.id = _project_id AND o.owner_id = _user_id
  )
  OR has_project_role(_project_id, _user_id, ARRAY['admin'::project_role]);
$$;


--
-- Name: can_use_connector(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.can_use_connector(_connector_id uuid, _user_id uuid) CASCADE;
CREATE FUNCTION public.can_use_connector(_connector_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
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


--
-- Name: can_view_project_members(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.can_view_project_members(_project_id uuid, _user_id uuid) CASCADE;
CREATE FUNCTION public.can_view_project_members(_project_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: check_project_permission(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.check_project_permission(_project_id uuid, _user_id uuid, _action text) CASCADE;
CREATE FUNCTION public.check_project_permission(_project_id uuid, _user_id uuid, _action text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
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


--
-- Name: ensure_unique_slug(text, text, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.ensure_unique_slug(base_slug text, table_name text, scope_column text, scope_value uuid, exclude_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_unique_slug(base_slug text, table_name text, scope_column text, scope_value uuid, exclude_id uuid) CASCADE;
CREATE FUNCTION public.ensure_unique_slug(base_slug text, table_name text, scope_column text, scope_value uuid, exclude_id uuid DEFAULT NULL::uuid) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $_$
DECLARE
  final_slug TEXT;
  counter INT := 0;
  slug_exists BOOLEAN;
BEGIN
  -- Whitelist validation for table_name to prevent SQL injection
  IF table_name NOT IN ('projects', 'documents', 'topics', 'organizations') THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;
  
  -- Whitelist validation for scope_column
  IF scope_column NOT IN ('organization_id', 'project_id') THEN
    RAISE EXCEPTION 'Invalid scope column: %', scope_column;
  END IF;

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
$_$;


--
-- Name: generate_slug(text); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.generate_slug(text) CASCADE;

DROP FUNCTION IF EXISTS public.generate_slug(title text) CASCADE;
CREATE FUNCTION public.generate_slug(title text) RETURNS text
    LANGUAGE sql IMMUTABLE
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


--
-- Name: get_drive_permission_for_role(public.project_role); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.get_drive_permission_for_role(public.project_role);

DROP FUNCTION IF EXISTS public.get_drive_permission_for_role(_role public.project_role) CASCADE;
CREATE FUNCTION public.get_drive_permission_for_role(_role public.project_role) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE _role
    WHEN 'admin' THEN 'writer'
    WHEN 'editor' THEN 'writer'
    WHEN 'reviewer' THEN 'commenter'
    WHEN 'viewer' THEN 'reader'
    ELSE NULL
  END;
$$;


--
-- Name: get_project_role(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.get_project_role(uuid, uuid) CASCADE;

DROP FUNCTION IF EXISTS public.get_project_role(_project_id uuid, _user_id uuid) CASCADE;
CREATE FUNCTION public.get_project_role(_project_id uuid, _user_id uuid) RETURNS public.project_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_user_org_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.get_user_org_id(uuid) CASCADE;

DROP FUNCTION IF EXISTS public.get_user_org_id(_user_id uuid) CASCADE;
CREATE FUNCTION public.get_user_org_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_domain TEXT;
  existing_org_id UUID;
  new_org_id UUID;
  is_personal BOOLEAN;
  selected_account_type TEXT;
BEGIN
  -- Extract domain from email
  user_domain := split_part(NEW.email, '@', 2);
  
  -- Check if it's a personal email domain
  is_personal := public.is_personal_email_domain(user_domain);
  
  -- Get account type from metadata (set during signup)
  selected_account_type := COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'individual');
  
  -- Personal email domains are always individual accounts
  IF is_personal THEN
    INSERT INTO public.profiles (id, email, full_name, organization_id, account_type)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', NULL, 'individual');
    
    -- No organization or role for individual users
    RETURN NEW;
  END IF;
  
  -- For business domains, check if organization exists
  SELECT id INTO existing_org_id FROM public.organizations WHERE domain = user_domain;
  
  IF existing_org_id IS NOT NULL THEN
    -- Organization exists - user must be invited, can't self-signup
    -- For now, create profile without org access (they need invitation)
    INSERT INTO public.profiles (id, email, full_name, organization_id, account_type)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', NULL, 'individual');
    
    RETURN NEW;
  ELSE
    -- No org exists for this domain - create one if team/enterprise selected
    IF selected_account_type IN ('team', 'enterprise') THEN
      -- Create new organization
      INSERT INTO public.organizations (domain, name, owner_id)
      VALUES (user_domain, user_domain, NEW.id)
      RETURNING id INTO new_org_id;
      
      -- Create profile with new org
      INSERT INTO public.profiles (id, email, full_name, organization_id, account_type)
      VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', new_org_id, selected_account_type::account_type);
      
      -- Assign owner role
      INSERT INTO public.user_roles (user_id, organization_id, role)
      VALUES (NEW.id, new_org_id, 'owner');
    ELSE
      -- Individual account with business email (no org created)
      INSERT INTO public.profiles (id, email, full_name, organization_id, account_type)
      VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', NULL, 'individual');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_org_role(uuid, uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.has_org_role(uuid, uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.has_org_role(_user_id uuid, _org_id uuid, _role public.app_role) CASCADE;
CREATE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
  )
$$;


--
-- Name: has_project_role(uuid, uuid, public.project_role[]); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.has_project_role(uuid, uuid, public.project_role[]) CASCADE;

DROP FUNCTION IF EXISTS public.has_project_role(_project_id uuid, _user_id uuid, _roles public.project_role[]) CASCADE;
CREATE FUNCTION public.has_project_role(_project_id uuid, _user_id uuid, _roles public.project_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id
      AND user_id = _user_id
      AND role = ANY(_roles)
  )
$$;


--
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid) CASCADE;

DROP FUNCTION IF EXISTS public.is_org_member(_org_id uuid, _user_id uuid) CASCADE;
CREATE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.organization_id = _org_id
      and ur.user_id = _user_id
  )
  or exists (
    select 1
    from public.organizations o
    where o.id = _org_id
      and o.owner_id = _user_id
  );
$$;


--
-- Name: is_org_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.is_org_owner(_org_id uuid, _user_id uuid) CASCADE;
CREATE FUNCTION public.is_org_owner(_org_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.organizations o
    where o.id = _org_id
      and o.owner_id = _user_id
  );
$$;


--
-- Name: is_personal_email_domain(text); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.is_personal_email_domain(email_domain text) CASCADE;
CREATE FUNCTION public.is_personal_email_domain(email_domain text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT email_domain = ANY(ARRAY[
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 
    'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'aol.com', 
    'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
    'tutanota.com', 'zoho.com', 'mail.com', 'gmx.com', 'gmx.net'
  ])
$$;


--
-- Name: is_project_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.is_project_member(_project_id uuid, _user_id uuid) CASCADE;
CREATE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = _project_id
      AND pm.user_id = _user_id
  );
$$;


--
-- Name: log_audit_action(text, text, uuid, uuid, jsonb, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.log_audit_action(_action text, _entity_type text, _entity_id uuid, _project_id uuid, _metadata jsonb, _success boolean, _error_message text) CASCADE;
CREATE FUNCTION public.log_audit_action(_action text, _entity_type text, _entity_id uuid, _project_id uuid, _metadata jsonb DEFAULT '{}'::jsonb, _success boolean DEFAULT true, _error_message text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: org_has_public_published_projects(uuid); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.org_has_public_published_projects(_org_id uuid) CASCADE;
CREATE FUNCTION public.org_has_public_published_projects(_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.organization_id = _org_id
      AND p.visibility = 'public'::public.visibility_level
      AND p.is_published = true
  );
$$;


--
-- Name: queue_drive_permission_sync(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.queue_drive_permission_sync() CASCADE;
CREATE FUNCTION public.queue_drive_permission_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: reject_join_request(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.reject_join_request(_request_id uuid, _reason text) CASCADE;
CREATE FUNCTION public.reject_join_request(_request_id uuid, _reason text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  req RECORD;
BEGIN
  -- Get the request
  SELECT * INTO req FROM public.join_requests 
  WHERE id = _request_id AND status = 'pending';
  
  IF req IS NULL THEN
    RAISE EXCEPTION 'Invalid or already processed request';
  END IF;
  
  -- Verify caller is org owner or admin
  IF NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = req.organization_id AND o.owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.organization_id = req.organization_id 
    AND ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to reject requests';
  END IF;
  
  -- Update request status
  UPDATE public.join_requests 
  SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = _reason
  WHERE id = _request_id;
  
  RETURN TRUE;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.audit_logs CASCADE;
CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    project_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: connector_actions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.connector_actions CASCADE;
CREATE TABLE public.connector_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connector_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action_type text NOT NULL,
    document_id uuid,
    input_data jsonb DEFAULT '{}'::jsonb,
    output_data jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: connector_credentials; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.connector_credentials CASCADE;
CREATE TABLE public.connector_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connector_id uuid NOT NULL,
    encrypted_credentials jsonb DEFAULT '{}'::jsonb NOT NULL,
    oauth_access_token text,
    oauth_refresh_token text,
    oauth_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: connector_permissions; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.connector_permissions CASCADE;
CREATE TABLE public.connector_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connector_id uuid NOT NULL,
    role public.project_role NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_use boolean DEFAULT false NOT NULL,
    can_configure boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: connectors; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.connectors CASCADE;
CREATE TABLE public.connectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    connector_type public.connector_type NOT NULL,
    name text NOT NULL,
    description text,
    endpoint_url text,
    status public.connector_status DEFAULT 'disconnected'::public.connector_status NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    last_health_check timestamp with time zone,
    last_sync_at timestamp with time zone,
    last_error text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    organization_id uuid
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.documents CASCADE;
CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    google_doc_id text NOT NULL,
    title text NOT NULL,
    content text,
    content_html text,
    last_synced_at timestamp with time zone,
    google_modified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    topic_id uuid,
    visibility public.visibility_level DEFAULT 'internal'::public.visibility_level NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    owner_id uuid,
    slug text,
    published_content_html text
);


--
-- Name: domains; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.domains CASCADE;
CREATE TABLE public.domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    project_id uuid,
    domain text NOT NULL,
    domain_type text DEFAULT 'custom'::text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    verification_token text,
    verified_at timestamp with time zone,
    ssl_status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT domain_scope CHECK ((((organization_id IS NOT NULL) AND (project_id IS NULL)) OR ((organization_id IS NULL) AND (project_id IS NOT NULL)) OR ((organization_id IS NOT NULL) AND (project_id IS NOT NULL)))),
    CONSTRAINT domains_domain_type_check CHECK ((domain_type = ANY (ARRAY['custom'::text, 'subdomain'::text]))),
    CONSTRAINT domains_ssl_status_check CHECK ((ssl_status = ANY (ARRAY['pending'::text, 'provisioning'::text, 'active'::text, 'failed'::text])))
);


--
-- Name: drive_permission_sync; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.drive_permission_sync CASCADE;
CREATE TABLE public.drive_permission_sync (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_member_id uuid,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    drive_file_id text NOT NULL,
    drive_permission_id text,
    role public.project_role NOT NULL,
    sync_status text DEFAULT 'pending'::text NOT NULL,
    last_synced_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: import_jobs; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.import_jobs CASCADE;
CREATE TABLE public.import_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_files integer DEFAULT 0 NOT NULL,
    processed_files integer DEFAULT 0 NOT NULL,
    topics_created integer DEFAULT 0 NOT NULL,
    pages_created integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb,
    current_file text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT import_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.invitations CASCADE;
CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email text NOT NULL,
    role public.app_role DEFAULT 'viewer'::public.app_role NOT NULL,
    invited_by uuid NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: join_requests; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.join_requests CASCADE;
CREATE TABLE public.join_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_email text NOT NULL,
    user_name text,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    rejection_reason text,
    CONSTRAINT join_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.organizations CASCADE;
CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain text NOT NULL,
    name text NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    drive_folder_id text,
    slug text,
    logo_url text,
    tagline text,
    primary_color text DEFAULT '#3B82F6'::text,
    secondary_color text DEFAULT '#1E40AF'::text,
    accent_color text DEFAULT '#F59E0B'::text,
    font_heading text DEFAULT 'Inter'::text,
    font_body text DEFAULT 'Inter'::text,
    custom_css text,
    hero_title text,
    hero_description text,
    show_search_on_landing boolean DEFAULT true,
    show_featured_projects boolean DEFAULT true,
    openapi_spec_json jsonb,
    openapi_spec_url text,
    mcp_enabled boolean DEFAULT false,
    custom_docs_domain text,
    subdomain text
);


--
-- Name: page_feedback; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.page_feedback CASCADE;
CREATE TABLE public.page_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    user_id uuid,
    user_name text,
    user_email text,
    content text NOT NULL,
    feedback_type text DEFAULT 'comment'::text NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    organization_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    account_type public.account_type DEFAULT 'individual'::public.account_type NOT NULL,
    google_refresh_token text,
    google_token_refreshed_at timestamp with time zone,
    subdomain text
);


--
-- Name: project_invitations; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.project_invitations CASCADE;
CREATE TABLE public.project_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    email text NOT NULL,
    role public.project_role DEFAULT 'viewer'::public.project_role NOT NULL,
    invited_by uuid NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.project_members CASCADE;
CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.project_role DEFAULT 'viewer'::public.project_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.projects CASCADE;
CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    drive_folder_id text,
    is_connected boolean DEFAULT false,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    visibility public.visibility_level DEFAULT 'internal'::public.visibility_level NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    slug text,
    allow_indexing boolean DEFAULT true,
    disallowed_paths text[] DEFAULT '{}'::text[],
    allow_llm_training boolean DEFAULT false,
    allow_llm_crawlers text[] DEFAULT '{}'::text[],
    allow_llm_summarization boolean DEFAULT true,
    openapi_spec_url text,
    openapi_spec_json jsonb,
    mcp_enabled boolean DEFAULT false
);


--
-- Name: slug_history; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.slug_history CASCADE;
CREATE TABLE public.slug_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    old_slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT slug_history_entity_type_check CHECK ((entity_type = ANY (ARRAY['organization'::text, 'project'::text, 'topic'::text, 'document'::text])))
);


--
-- Name: topics; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.topics CASCADE;
CREATE TABLE public.topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    drive_folder_id text NOT NULL,
    project_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text,
    parent_id uuid,
    display_order integer DEFAULT 0
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

DROP TABLE IF EXISTS public.user_roles CASCADE;
CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role public.app_role DEFAULT 'viewer'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: connector_actions connector_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_actions
    ADD CONSTRAINT connector_actions_pkey PRIMARY KEY (id);


--
-- Name: connector_credentials connector_credentials_connector_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_credentials
    ADD CONSTRAINT connector_credentials_connector_id_key UNIQUE (connector_id);


--
-- Name: connector_credentials connector_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_credentials
    ADD CONSTRAINT connector_credentials_pkey PRIMARY KEY (id);


--
-- Name: connector_permissions connector_permissions_connector_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_permissions
    ADD CONSTRAINT connector_permissions_connector_id_role_key UNIQUE (connector_id, role);


--
-- Name: connector_permissions connector_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_permissions
    ADD CONSTRAINT connector_permissions_pkey PRIMARY KEY (id);


--
-- Name: connectors connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT connectors_pkey PRIMARY KEY (id);


--
-- Name: connectors connectors_project_id_connector_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT connectors_project_id_connector_type_key UNIQUE (project_id, connector_type);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: documents documents_project_id_google_doc_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_project_id_google_doc_id_key UNIQUE (project_id, google_doc_id);


--
-- Name: domains domains_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_domain_key UNIQUE (domain);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: drive_permission_sync drive_permission_sync_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drive_permission_sync
    ADD CONSTRAINT drive_permission_sync_pkey PRIMARY KEY (id);


--
-- Name: import_jobs import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: join_requests join_requests_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT join_requests_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: join_requests join_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT join_requests_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_custom_docs_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_custom_docs_domain_key UNIQUE (custom_docs_domain);


--
-- Name: organizations organizations_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_domain_key UNIQUE (domain);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_subdomain_key UNIQUE (subdomain);


--
-- Name: page_feedback page_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_feedback
    ADD CONSTRAINT page_feedback_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_subdomain_key UNIQUE (subdomain);


--
-- Name: project_invitations project_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invitations
    ADD CONSTRAINT project_invitations_pkey PRIMARY KEY (id);


--
-- Name: project_invitations project_invitations_project_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invitations
    ADD CONSTRAINT project_invitations_project_id_email_key UNIQUE (project_id, email);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: slug_history slug_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slug_history
    ADD CONSTRAINT slug_history_pkey PRIMARY KEY (id);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: invitations unique_pending_invitation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT unique_pending_invitation UNIQUE (organization_id, email);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_organization_id_key UNIQUE (user_id, organization_id);


--
-- Name: documents_slug_project_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX documents_slug_project_unique ON public.documents USING btree (project_id, slug) WHERE (slug IS NOT NULL);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_project_id ON public.audit_logs USING btree (project_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_connector_actions_connector_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connector_actions_connector_id ON public.connector_actions USING btree (connector_id);


--
-- Name: idx_connector_actions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connector_actions_created_at ON public.connector_actions USING btree (created_at DESC);


--
-- Name: idx_connector_actions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connector_actions_user_id ON public.connector_actions USING btree (user_id);


--
-- Name: idx_connectors_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connectors_organization_id ON public.connectors USING btree (organization_id);


--
-- Name: idx_connectors_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connectors_project_id ON public.connectors USING btree (project_id);


--
-- Name: idx_connectors_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_connectors_status ON public.connectors USING btree (status);


--
-- Name: idx_domains_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domains_domain ON public.domains USING btree (domain);


--
-- Name: idx_domains_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_domains_org ON public.domains USING btree (organization_id);


--
-- Name: idx_drive_permission_sync_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drive_permission_sync_project ON public.drive_permission_sync USING btree (project_id);


--
-- Name: idx_drive_permission_sync_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drive_permission_sync_status ON public.drive_permission_sync USING btree (sync_status);


--
-- Name: idx_drive_permission_sync_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drive_permission_sync_user ON public.drive_permission_sync USING btree (user_id);


--
-- Name: idx_import_jobs_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_project ON public.import_jobs USING btree (project_id);


--
-- Name: idx_import_jobs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_jobs_user ON public.import_jobs USING btree (user_id);


--
-- Name: idx_organizations_custom_docs_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_custom_docs_domain ON public.organizations USING btree (custom_docs_domain) WHERE (custom_docs_domain IS NOT NULL);


--
-- Name: idx_organizations_subdomain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_subdomain ON public.organizations USING btree (subdomain);


--
-- Name: idx_page_feedback_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_feedback_document_id ON public.page_feedback USING btree (document_id);


--
-- Name: idx_profiles_subdomain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_subdomain ON public.profiles USING btree (subdomain);


--
-- Name: idx_topics_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_display_order ON public.topics USING btree (project_id, display_order);


--
-- Name: idx_topics_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_parent_id ON public.topics USING btree (parent_id);


--
-- Name: organizations_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organizations_slug_unique ON public.organizations USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: projects_slug_org_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX projects_slug_org_unique ON public.projects USING btree (organization_id, slug) WHERE (slug IS NOT NULL);


--
-- Name: slug_history_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX slug_history_lookup ON public.slug_history USING btree (entity_type, old_slug);


--
-- Name: topics_slug_project_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX topics_slug_project_unique ON public.topics USING btree (project_id, slug) WHERE (slug IS NOT NULL);


--
-- Name: documents auto_slug_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_slug_documents BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.auto_generate_document_slug();


--
-- Name: projects auto_slug_projects; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_slug_projects BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.auto_generate_project_slug();


--
-- Name: topics auto_slug_topics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_slug_topics BEFORE INSERT OR UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.auto_generate_topic_slug();


--
-- Name: project_members queue_drive_sync_on_member_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER queue_drive_sync_on_member_change AFTER INSERT OR DELETE OR UPDATE OF role ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.queue_drive_permission_sync();


--
-- Name: connector_credentials update_connector_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_connector_credentials_updated_at BEFORE UPDATE ON public.connector_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: connectors update_connectors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_connectors_updated_at BEFORE UPDATE ON public.connectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: documents update_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: page_feedback update_page_feedback_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_page_feedback_updated_at BEFORE UPDATE ON public.page_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_members update_project_members_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_members_updated_at BEFORE UPDATE ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: topics update_topics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: audit_logs audit_logs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: connector_actions connector_actions_connector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_actions
    ADD CONSTRAINT connector_actions_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.connectors(id) ON DELETE CASCADE;


--
-- Name: connector_actions connector_actions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_actions
    ADD CONSTRAINT connector_actions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: connector_actions connector_actions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_actions
    ADD CONSTRAINT connector_actions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: connector_credentials connector_credentials_connector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_credentials
    ADD CONSTRAINT connector_credentials_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.connectors(id) ON DELETE CASCADE;


--
-- Name: connector_permissions connector_permissions_connector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_permissions
    ADD CONSTRAINT connector_permissions_connector_id_fkey FOREIGN KEY (connector_id) REFERENCES public.connectors(id) ON DELETE CASCADE;


--
-- Name: connectors connectors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT connectors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: connectors connectors_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connectors
    ADD CONSTRAINT connectors_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: documents documents_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: documents documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: documents documents_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- Name: domains domains_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: domains domains_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: drive_permission_sync drive_permission_sync_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drive_permission_sync
    ADD CONSTRAINT drive_permission_sync_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: drive_permission_sync drive_permission_sync_project_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drive_permission_sync
    ADD CONSTRAINT drive_permission_sync_project_member_id_fkey FOREIGN KEY (project_member_id) REFERENCES public.project_members(id) ON DELETE CASCADE;


--
-- Name: import_jobs import_jobs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: join_requests join_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT join_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: join_requests join_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.join_requests
    ADD CONSTRAINT join_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: page_feedback page_feedback_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_feedback
    ADD CONSTRAINT page_feedback_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: page_feedback page_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_feedback
    ADD CONSTRAINT page_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: project_invitations project_invitations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invitations
    ADD CONSTRAINT project_invitations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: topics topics_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.topics(id) ON DELETE SET NULL;


--
-- Name: topics topics_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_permission_sync Admins can manage drive sync; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage drive sync" ON public.drive_permission_sync USING ((EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = drive_permission_sync.project_id) AND ((o.owner_id = auth.uid()) OR public.has_project_role(p.id, auth.uid(), ARRAY['admin'::public.project_role]))))));


--
-- Name: connectors Admins can manage org connectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage org connectors" ON public.connectors USING (((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.organization_id = connectors.organization_id) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))))))) WITH CHECK (((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.organization_id = connectors.organization_id) AND (user_roles.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])))))));


--
-- Name: slug_history Anyone can read slug history for redirects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read slug history for redirects" ON public.slug_history FOR SELECT USING (true);


--
-- Name: page_feedback Anyone can view feedback on published docs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view feedback on published docs" ON public.page_feedback FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.documents d
  WHERE ((d.id = page_feedback.document_id) AND (d.is_published = true) AND (d.visibility = 'public'::public.visibility_level)))));


--
-- Name: page_feedback Authenticated users can create feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create feedback" ON public.page_feedback FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: connector_actions Authorized users can create connector actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authorized users can create connector actions" ON public.connector_actions FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM ((public.connectors c
     JOIN public.connector_permissions cp ON ((cp.connector_id = c.id)))
     JOIN public.project_members pm ON (((pm.project_id = c.project_id) AND (pm.user_id = auth.uid()))))
  WHERE ((c.id = connector_actions.connector_id) AND (cp.role = pm.role) AND (cp.can_use = true))))));


--
-- Name: projects Editors can create projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Editors can create projects" ON public.projects FOR INSERT WITH CHECK ((organization_id = public.get_user_org_id(auth.uid())));


--
-- Name: projects Editors can delete projects in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Editors can delete projects in their org" ON public.projects FOR DELETE USING ((organization_id = public.get_user_org_id(auth.uid())));


--
-- Name: documents Editors can manage documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Editors can manage documents" ON public.documents USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = documents.project_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: projects Editors can update projects in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Editors can update projects in their org" ON public.projects FOR UPDATE USING ((organization_id = public.get_user_org_id(auth.uid())));


--
-- Name: documents External users can view docs in invited projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "External users can view docs in invited projects" ON public.documents FOR SELECT USING (((project_id IN ( SELECT pm.project_id
   FROM (public.project_members pm
     JOIN public.projects p ON ((p.id = pm.project_id)))
  WHERE ((pm.user_id = auth.uid()) AND (p.visibility = 'external'::public.visibility_level) AND (p.is_published = true)))) AND (published_content_html IS NOT NULL)));


--
-- Name: projects External users can view invited projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "External users can view invited projects" ON public.projects FOR SELECT USING (((visibility = 'external'::public.visibility_level) AND (is_published = true) AND public.is_project_member(id, auth.uid())));


--
-- Name: topics External users can view topics in invited projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "External users can view topics in invited projects" ON public.topics FOR SELECT USING ((project_id IN ( SELECT pm.project_id
   FROM (public.project_members pm
     JOIN public.projects p ON ((p.id = pm.project_id)))
  WHERE ((pm.user_id = auth.uid()) AND (p.visibility = 'external'::public.visibility_level) AND (p.is_published = true)))));


--
-- Name: connector_credentials Only project admins can manage credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only project admins can manage credentials" ON public.connector_credentials USING ((EXISTS ( SELECT 1
   FROM public.connectors c
  WHERE ((c.id = connector_credentials.connector_id) AND (public.has_project_role(c.project_id, auth.uid(), ARRAY['admin'::public.project_role]) OR (EXISTS ( SELECT 1
           FROM (public.projects p
             JOIN public.organizations o ON ((o.id = p.organization_id)))
          WHERE ((p.id = c.project_id) AND (o.owner_id = auth.uid())))))))));


--
-- Name: connector_credentials Only project admins can view credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only project admins can view credentials" ON public.connector_credentials FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.connectors c
  WHERE ((c.id = connector_credentials.connector_id) AND (public.has_project_role(c.project_id, auth.uid(), ARRAY['admin'::public.project_role]) OR (EXISTS ( SELECT 1
           FROM (public.projects p
             JOIN public.organizations o ON ((o.id = p.organization_id)))
          WHERE ((p.id = c.project_id) AND (o.owner_id = auth.uid())))))))));


--
-- Name: join_requests Org admins can update join requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can update join requests" ON public.join_requests FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = join_requests.organization_id) AND (o.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.organization_id = join_requests.organization_id) AND (ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])))))));


--
-- Name: join_requests Org admins can view join requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view join requests" ON public.join_requests FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = join_requests.organization_id) AND (o.owner_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.organization_id = join_requests.organization_id) AND (ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])))))));


--
-- Name: project_members Org members can view project members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view project members" ON public.project_members FOR SELECT USING (public.can_view_project_members(project_id, auth.uid()));


--
-- Name: domains Org owners can manage domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org owners can manage domains" ON public.domains USING (((organization_id IN ( SELECT organizations.id
   FROM public.organizations
  WHERE (organizations.owner_id = auth.uid()))) OR (project_id IN ( SELECT p.id
   FROM (public.projects p
     JOIN public.organizations o ON ((o.id = p.organization_id)))
  WHERE (o.owner_id = auth.uid())))));


--
-- Name: slug_history Org users can insert slug history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org users can insert slug history" ON public.slug_history FOR INSERT WITH CHECK (
CASE
    WHEN (entity_type = 'organization'::text) THEN (EXISTS ( SELECT 1
       FROM public.organizations o
      WHERE ((o.id = slug_history.entity_id) AND (o.owner_id = auth.uid()))))
    WHEN (entity_type = 'project'::text) THEN (EXISTS ( SELECT 1
       FROM public.projects p
      WHERE ((p.id = slug_history.entity_id) AND (p.organization_id = public.get_user_org_id(auth.uid())))))
    WHEN (entity_type = 'document'::text) THEN (EXISTS ( SELECT 1
       FROM (public.documents d
         JOIN public.projects p ON ((p.id = d.project_id)))
      WHERE ((d.id = slug_history.entity_id) AND (p.organization_id = public.get_user_org_id(auth.uid())))))
    ELSE false
END);


--
-- Name: page_feedback Org users can manage feedback on their docs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org users can manage feedback on their docs" ON public.page_feedback USING ((EXISTS ( SELECT 1
   FROM (public.documents d
     JOIN public.projects p ON ((p.id = d.project_id)))
  WHERE ((d.id = page_feedback.document_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: page_feedback Org users can view feedback on their docs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org users can view feedback on their docs" ON public.page_feedback FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.documents d
     JOIN public.projects p ON ((p.id = d.project_id)))
  WHERE ((d.id = page_feedback.document_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: invitations Owners can manage invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage invitations" ON public.invitations USING ((EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = invitations.organization_id) AND (o.owner_id = auth.uid())))));


--
-- Name: user_roles Owners can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage roles" ON public.user_roles TO authenticated USING (public.is_org_owner(organization_id, auth.uid())) WITH CHECK (public.is_org_owner(organization_id, auth.uid()));


--
-- Name: organizations Owners can update their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update their organization" ON public.organizations FOR UPDATE USING ((owner_id = auth.uid()));


--
-- Name: project_members Project admins can delete members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project admins can delete members" ON public.project_members FOR DELETE USING ((public.get_project_role(project_id, auth.uid()) = 'admin'::public.project_role));


--
-- Name: project_members Project admins can insert members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project admins can insert members" ON public.project_members FOR INSERT WITH CHECK (public.can_edit_project(project_id, auth.uid()));


--
-- Name: connector_permissions Project admins can manage connector permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project admins can manage connector permissions" ON public.connector_permissions USING ((EXISTS ( SELECT 1
   FROM public.connectors c
  WHERE ((c.id = connector_permissions.connector_id) AND (public.has_project_role(c.project_id, auth.uid(), ARRAY['admin'::public.project_role]) OR (EXISTS ( SELECT 1
           FROM (public.projects p
             JOIN public.organizations o ON ((o.id = p.organization_id)))
          WHERE ((p.id = c.project_id) AND (o.owner_id = auth.uid())))))))));


--
-- Name: connectors Project admins can manage connectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project admins can manage connectors" ON public.connectors USING ((public.has_project_role(project_id, auth.uid(), ARRAY['admin'::public.project_role]) OR (EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = connectors.project_id) AND (o.owner_id = auth.uid()))))));


--
-- Name: project_members Project admins can update members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project admins can update members" ON public.project_members FOR UPDATE USING ((public.get_project_role(project_id, auth.uid()) = 'admin'::public.project_role)) WITH CHECK ((public.get_project_role(project_id, auth.uid()) = 'admin'::public.project_role));


--
-- Name: audit_logs Project admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project admins can view audit logs" ON public.audit_logs FOR SELECT USING ((public.has_project_role(project_id, auth.uid(), ARRAY['admin'::public.project_role]) OR (EXISTS ( SELECT 1
   FROM (public.projects p
     JOIN public.organizations o ON ((o.id = p.organization_id)))
  WHERE ((p.id = audit_logs.project_id) AND (o.owner_id = auth.uid()))))));


--
-- Name: project_invitations Project editors can manage invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project editors can manage invitations" ON public.project_invitations USING (public.can_edit_project(project_id, auth.uid()));


--
-- Name: connector_actions Project members can view connector actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project members can view connector actions" ON public.connector_actions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = connector_actions.project_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: connector_permissions Project members can view connector permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project members can view connector permissions" ON public.connector_permissions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.connectors c
     JOIN public.projects p ON ((p.id = c.project_id)))
  WHERE ((c.id = connector_permissions.connector_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: connectors Project members can view connectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project members can view connectors" ON public.connectors FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = connectors.project_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: documents Public documents are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public documents are viewable by everyone" ON public.documents FOR SELECT USING (((visibility = 'public'::public.visibility_level) AND (is_published = true)));


--
-- Name: domains Public domains are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public domains are viewable by everyone" ON public.domains FOR SELECT USING ((is_verified = true));


--
-- Name: organizations Public orgs are viewable for docs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public orgs are viewable for docs" ON public.organizations FOR SELECT USING (public.org_has_public_published_projects(id));


--
-- Name: projects Public projects are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public projects are viewable by everyone" ON public.projects FOR SELECT USING (((visibility = 'public'::public.visibility_level) AND (is_published = true)));


--
-- Name: join_requests Users can cancel own pending requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can cancel own pending requests" ON public.join_requests FOR DELETE USING (((auth.uid() = user_id) AND (status = 'pending'::text)));


--
-- Name: join_requests Users can create join requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create join requests" ON public.join_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: organizations Users can create their own organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own organization" ON public.organizations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = owner_id));


--
-- Name: topics Users can create topics in their org projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create topics in their org projects" ON public.topics FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = topics.project_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: documents Users can delete documents in their org projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete documents in their org projects" ON public.documents FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = documents.project_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: page_feedback Users can delete own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own feedback" ON public.page_feedback FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: topics Users can delete topics in their org projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete topics in their org projects" ON public.topics FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = topics.project_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: audit_logs Users can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: page_feedback Users can update own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own feedback" ON public.page_feedback FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: profiles Users can update own refresh token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own refresh token" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: topics Users can update topics in their org projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update topics in their org projects" ON public.topics FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = topics.project_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: documents Users can view documents in their org projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view documents in their org projects" ON public.documents FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = documents.project_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: connectors Users can view org connectors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view org connectors" ON public.connectors FOR SELECT USING (((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (project_id IN ( SELECT project_members.project_id
   FROM public.project_members
  WHERE (project_members.user_id = auth.uid())))));


--
-- Name: organizations Users can view organizations by domain; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view organizations by domain" ON public.organizations FOR SELECT USING (((auth.uid() IS NOT NULL) AND (lower(domain) = lower(split_part(COALESCE(( SELECT p.email
   FROM public.profiles p
  WHERE (p.id = auth.uid())), ''::text), '@'::text, 2)))));


--
-- Name: organizations Users can view organizations they belong to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view organizations they belong to" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id, auth.uid()));


--
-- Name: join_requests Users can view own join requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own join requests" ON public.join_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: drive_permission_sync Users can view own sync status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sync status" ON public.drive_permission_sync FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles Users can view profiles in same org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view profiles in same org" ON public.profiles FOR SELECT USING ((organization_id = public.get_user_org_id(auth.uid())));


--
-- Name: projects Users can view projects in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view projects in their org" ON public.projects FOR SELECT USING ((organization_id = public.get_user_org_id(auth.uid())));


--
-- Name: user_roles Users can view roles in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view roles in their org" ON public.user_roles FOR SELECT USING ((organization_id = public.get_user_org_id(auth.uid())));


--
-- Name: invitations Users can view their invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their invitations" ON public.invitations FOR SELECT USING ((email = ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: project_invitations Users can view their invitations by email; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their invitations by email" ON public.project_invitations FOR SELECT USING ((email = ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: organizations Users can view their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their organization" ON public.organizations FOR SELECT TO authenticated USING (((id = public.get_user_org_id(auth.uid())) OR (owner_id = auth.uid())));


--
-- Name: import_jobs Users can view their own import jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own import jobs" ON public.import_jobs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: topics Users can view topics in their org projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view topics in their org projects" ON public.topics FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = topics.project_id) AND (p.organization_id = public.get_user_org_id(auth.uid()))))));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: connector_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connector_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: connector_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connector_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: connector_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connector_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: connectors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

--
-- Name: drive_permission_sync; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drive_permission_sync ENABLE ROW LEVEL SECURITY;

--
-- Name: import_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: join_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: page_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: project_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: slug_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slug_history ENABLE ROW LEVEL SECURITY;

--
-- Name: topics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;
