-- Fix org discovery policy to avoid referencing auth.users (can cause permission errors)
DROP POLICY IF EXISTS "Users can view organizations by domain" ON public.organizations;

CREATE POLICY "Users can view organizations by domain"
ON public.organizations
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND lower(domain) = lower(
    split_part(
      coalesce((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), ''),
      '@',
      2
    )
  )
);