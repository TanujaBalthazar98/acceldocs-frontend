-- Allow authenticated users to create their own organization (where they are the owner)
CREATE POLICY "Users can create their own organization"
ON public.organizations
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Re-create the profile for the test user (since it was deleted but the auth user still exists)
-- This will be handled by the handle_new_user trigger on next login