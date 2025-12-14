-- Create project_invitations table for inviting users who haven't signed up yet
CREATE TABLE public.project_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role project_role NOT NULL DEFAULT 'viewer',
  invited_by UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, email)
);

-- Enable RLS
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- Project admins/editors can manage invitations
CREATE POLICY "Project editors can manage invitations"
ON public.project_invitations
FOR ALL
USING (can_edit_project(project_id, auth.uid()));

-- Users can view their own invitations
CREATE POLICY "Users can view their invitations by email"
ON public.project_invitations
FOR SELECT
USING (email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- Create function to accept project invitation
CREATE OR REPLACE FUNCTION public.accept_project_invitation(invitation_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM public.profiles WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Get invitation
  SELECT * INTO inv FROM public.project_invitations 
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
  
  -- Add user as project member
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (inv.project_id, auth.uid(), inv.role)
  ON CONFLICT DO NOTHING;
  
  -- Mark invitation as accepted
  UPDATE public.project_invitations 
  SET accepted_at = now() 
  WHERE id = inv.id;
  
  RETURN TRUE;
END;
$$;