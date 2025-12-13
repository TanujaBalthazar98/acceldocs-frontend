-- Drop and recreate SELECT policy to also allow owners to view their organization
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;

CREATE POLICY "Users can view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = get_user_org_id(auth.uid()) 
  OR owner_id = auth.uid()
);