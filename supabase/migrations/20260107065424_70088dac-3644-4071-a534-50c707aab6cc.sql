-- Fix infinite recursion involving organizations <-> projects policies by avoiding direct projects lookup inside organizations RLS.

-- 1) Helper function (SECURITY DEFINER) to check whether an org has any public, published projects.
CREATE OR REPLACE FUNCTION public.org_has_public_published_projects(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.organization_id = _org_id
      AND p.visibility = 'public'::public.visibility_level
      AND p.is_published = true
  );
$$;

-- 2) Replace the organizations policy that referenced projects directly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='organizations'
      AND policyname='Public orgs are viewable for docs'
  ) THEN
    EXECUTE 'DROP POLICY "Public orgs are viewable for docs" ON public.organizations';
  END IF;
END $$;

CREATE POLICY "Public orgs are viewable for docs"
ON public.organizations
FOR SELECT
TO public
USING (public.org_has_public_published_projects(id));
