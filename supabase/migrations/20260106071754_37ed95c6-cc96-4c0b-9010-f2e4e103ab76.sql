-- Allow authenticated users to view organizations by domain (for onboarding flow)
-- This enables new users to see existing orgs they could potentially join
CREATE POLICY "Users can view organizations by domain"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  domain = split_part((SELECT email FROM auth.users WHERE id = auth.uid()), '@', 2)
);