-- Drop the existing INSERT policy and recreate with correct role
DROP POLICY IF EXISTS "Users can create their own organization" ON public.organizations;

CREATE POLICY "Users can create their own organization"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);