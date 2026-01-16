-- Enforce external collaborators as viewer-only at DB level.

CREATE OR REPLACE FUNCTION public.normalize_external_project_role(
  _project_id uuid,
  _email text,
  _requested public.project_role
)
RETURNS public.project_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_domain text;
  email_domain text;
BEGIN
  IF _email IS NULL THEN
    RETURN 'viewer'::public.project_role;
  END IF;

  SELECT o.domain
  INTO org_domain
  FROM public.projects p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = _project_id;

  IF org_domain IS NULL THEN
    RETURN _requested;
  END IF;

  email_domain := lower(split_part(_email, '@', 2));

  IF email_domain IS NULL OR email_domain = '' THEN
    RETURN 'viewer'::public.project_role;
  END IF;

  IF email_domain <> lower(org_domain) THEN
    RETURN 'viewer'::public.project_role;
  END IF;

  RETURN _requested;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_external_invitation_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.role := public.normalize_external_project_role(NEW.project_id, NEW.email, NEW.role);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_external_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_email text;
BEGIN
  SELECT email INTO profile_email
  FROM public.profiles
  WHERE id = NEW.user_id;

  NEW.role := public.normalize_external_project_role(NEW.project_id, profile_email, NEW.role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_external_invitation_role ON public.project_invitations;
CREATE TRIGGER enforce_external_invitation_role
BEFORE INSERT OR UPDATE OF role, email ON public.project_invitations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_external_invitation_role();

DROP TRIGGER IF EXISTS enforce_external_member_role ON public.project_members;
CREATE TRIGGER enforce_external_member_role
BEFORE INSERT OR UPDATE OF role, user_id ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_external_member_role();

-- Normalize existing external roles to viewer.
UPDATE public.project_invitations pi
SET role = 'viewer'::public.project_role
FROM public.projects p
JOIN public.organizations o ON o.id = p.organization_id
WHERE pi.project_id = p.id
  AND lower(split_part(pi.email, '@', 2)) <> lower(o.domain);

UPDATE public.project_members pm
SET role = 'viewer'::public.project_role
FROM public.projects p
JOIN public.organizations o ON o.id = p.organization_id
WHERE pm.project_id = p.id
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = pm.user_id
      AND lower(split_part(pr.email, '@', 2)) <> lower(o.domain)
  );

-- Ensure org admins/owners can manage members via org-level roles.
CREATE OR REPLACE FUNCTION public.can_manage_project_members(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    public.get_project_role(_project_id, _user_id) = 'admin'::public.project_role,
    false
  );
$$;
