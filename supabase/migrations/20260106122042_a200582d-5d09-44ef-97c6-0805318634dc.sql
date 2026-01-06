-- Fix workspace switcher visibility: allow users to read their own org memberships across multiple organizations

-- user_roles: allow a user to select all of their own role rows (not just current profile org)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_roles' 
      AND policyname = 'Users can view their own roles'
  ) THEN
    CREATE POLICY "Users can view their own roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- organizations: allow a user to select any organization they have a membership in
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'organizations' 
      AND policyname = 'Users can view organizations they belong to'
  ) THEN
    CREATE POLICY "Users can view organizations they belong to"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.organization_id = organizations.id
          AND ur.user_id = auth.uid()
      )
    );
  END IF;
END $$;