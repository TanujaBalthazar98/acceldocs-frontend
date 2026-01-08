-- Fix the approve_join_request function to create profile if it doesn't exist
CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req RECORD;
BEGIN
  -- Get the request
  SELECT * INTO req FROM public.join_requests 
  WHERE id = _request_id::uuid AND status = 'pending';
  
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
  WHERE id = _request_id::uuid;
  
  -- Create or update the user's profile to join the org
  INSERT INTO public.profiles (id, email, full_name, organization_id, account_type)
  VALUES (req.user_id, req.user_email, req.user_name, req.organization_id, 'team')
  ON CONFLICT (id) DO UPDATE 
  SET organization_id = req.organization_id, 
      account_type = 'team',
      full_name = COALESCE(profiles.full_name, req.user_name),
      updated_at = now();
  
  -- Add viewer role for the new member
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (req.user_id, req.organization_id, 'viewer')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- Ensure the trigger is attached to auth.users for new signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();