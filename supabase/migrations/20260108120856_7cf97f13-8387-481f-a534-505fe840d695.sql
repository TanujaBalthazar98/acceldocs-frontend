-- Drop the text version of the function (keeping only uuid)
DROP FUNCTION IF EXISTS public.approve_join_request(text);

-- Recreate the function with only UUID parameter type
CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request RECORD;
  _reviewer_id uuid;
BEGIN
  _reviewer_id := auth.uid();
  
  -- Get the request
  SELECT * INTO _request FROM public.join_requests WHERE id = _request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;
  
  -- Check if reviewer is org owner or admin
  IF NOT (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = _request.organization_id AND owner_id = _reviewer_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE organization_id = _request.organization_id AND user_id = _reviewer_id AND role IN ('owner', 'admin'))
  ) THEN
    RAISE EXCEPTION 'Not authorized to approve requests';
  END IF;
  
  -- Update request status
  UPDATE public.join_requests
  SET status = 'approved', reviewed_at = now(), reviewed_by = _reviewer_id
  WHERE id = _request_id;
  
  -- Upsert profile to set organization_id
  INSERT INTO public.profiles (id, email, organization_id)
  VALUES (_request.user_id, _request.user_email, _request.organization_id)
  ON CONFLICT (id) DO UPDATE SET organization_id = _request.organization_id;
  
  -- Add user role
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (_request.user_id, _request.organization_id, 'viewer')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN true;
END;
$$;