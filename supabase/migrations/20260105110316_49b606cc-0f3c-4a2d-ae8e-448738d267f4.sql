-- Create join_requests table for org membership requests
CREATE TABLE public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  rejection_reason TEXT,
  UNIQUE (organization_id, user_id)
);

-- Enable RLS
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own join requests
CREATE POLICY "Users can view own join requests"
ON public.join_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create join requests
CREATE POLICY "Users can create join requests"
ON public.join_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can cancel their pending requests
CREATE POLICY "Users can cancel own pending requests"
ON public.join_requests
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Org owners/admins can view all requests for their org
CREATE POLICY "Org admins can view join requests"
ON public.join_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = join_requests.organization_id
    AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.organization_id = join_requests.organization_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

-- Org owners/admins can update (approve/reject) requests
CREATE POLICY "Org admins can update join requests"
ON public.join_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = join_requests.organization_id
    AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.organization_id = join_requests.organization_id
    AND ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

-- Function to approve a join request
CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id UUID)
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
  WHERE id = _request_id AND status = 'pending';
  
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
  WHERE id = _request_id;
  
  -- Update user's profile to join the org
  UPDATE public.profiles 
  SET organization_id = req.organization_id, account_type = 'team'
  WHERE id = req.user_id;
  
  -- Add viewer role for the new member
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (req.user_id, req.organization_id, 'viewer')
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- Function to reject a join request
CREATE OR REPLACE FUNCTION public.reject_join_request(_request_id UUID, _reason TEXT DEFAULT NULL)
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
  WHERE id = _request_id AND status = 'pending';
  
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
    RAISE EXCEPTION 'Not authorized to reject requests';
  END IF;
  
  -- Update request status
  UPDATE public.join_requests 
  SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), rejection_reason = _reason
  WHERE id = _request_id;
  
  RETURN TRUE;
END;
$$;