-- Allow users to insert their own profile (for cases where the trigger didn't fire)
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);