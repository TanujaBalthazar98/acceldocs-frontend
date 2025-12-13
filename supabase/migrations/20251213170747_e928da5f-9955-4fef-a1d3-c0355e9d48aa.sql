-- Create invitations table
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique pending invitation per email per org
  CONSTRAINT unique_pending_invitation UNIQUE (organization_id, email)
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Org owners/admins can manage invitations
CREATE POLICY "Owners can manage invitations"
ON public.invitations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = invitations.organization_id
    AND o.owner_id = auth.uid()
  )
);

-- Users can view invitations sent to their email
CREATE POLICY "Users can view their invitations"
ON public.invitations
FOR SELECT
USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- Function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv RECORD;
  user_email TEXT;
  user_domain TEXT;
  inv_domain TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM public.profiles WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get invitation
  SELECT * INTO inv FROM public.invitations 
  WHERE token = invitation_token 
    AND accepted_at IS NULL 
    AND expires_at > now();
  
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Verify email matches
  IF inv.email != user_email THEN
    RAISE EXCEPTION 'Invitation email does not match your account';
  END IF;
  
  -- Verify domain matches org domain
  user_domain := split_part(user_email, '@', 2);
  SELECT domain INTO inv_domain FROM public.organizations WHERE id = inv.organization_id;
  
  IF user_domain != inv_domain THEN
    RAISE EXCEPTION 'Your email domain does not match the organization';
  END IF;
  
  -- Update user profile to join org
  UPDATE public.profiles 
  SET organization_id = inv.organization_id,
      account_type = 'team'
  WHERE id = auth.uid();
  
  -- Add user role
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), inv.organization_id, inv.role)
  ON CONFLICT DO NOTHING;
  
  -- Mark invitation as accepted
  UPDATE public.invitations 
  SET accepted_at = now() 
  WHERE id = inv.id;
  
  RETURN TRUE;
END;
$$;