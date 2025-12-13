-- Create account type enum
CREATE TYPE public.account_type AS ENUM ('individual', 'team', 'enterprise');

-- Add account_type to profiles
ALTER TABLE public.profiles ADD COLUMN account_type public.account_type NOT NULL DEFAULT 'individual';

-- Make organization_id nullable for individual users (already nullable, but ensuring clarity)
-- Add constraint: individual users should not have organization_id

-- Create function to check if email is personal domain
CREATE OR REPLACE FUNCTION public.is_personal_email_domain(email_domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT email_domain = ANY(ARRAY[
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 
    'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'aol.com', 
    'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
    'tutanota.com', 'zoho.com', 'mail.com', 'gmx.com', 'gmx.net'
  ])
$$;

-- Update the handle_new_user function to handle individual vs team accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_domain TEXT;
  existing_org_id UUID;
  new_org_id UUID;
  is_personal BOOLEAN;
  selected_account_type TEXT;
BEGIN
  -- Extract domain from email
  user_domain := split_part(NEW.email, '@', 2);
  
  -- Check if it's a personal email domain
  is_personal := public.is_personal_email_domain(user_domain);
  
  -- Get account type from metadata (set during signup)
  selected_account_type := COALESCE(NEW.raw_user_meta_data ->> 'account_type', 'individual');
  
  -- Personal email domains are always individual accounts
  IF is_personal THEN
    INSERT INTO public.profiles (id, email, full_name, organization_id, account_type)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', NULL, 'individual');
    
    -- No organization or role for individual users
    RETURN NEW;
  END IF;
  
  -- For business domains, check if organization exists
  SELECT id INTO existing_org_id FROM public.organizations WHERE domain = user_domain;
  
  IF existing_org_id IS NOT NULL THEN
    -- Organization exists - user must be invited, can't self-signup
    -- For now, create profile without org access (they need invitation)
    INSERT INTO public.profiles (id, email, full_name, organization_id, account_type)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', NULL, 'individual');
    
    RETURN NEW;
  ELSE
    -- No org exists for this domain - create one if team/enterprise selected
    IF selected_account_type IN ('team', 'enterprise') THEN
      -- Create new organization
      INSERT INTO public.organizations (domain, name, owner_id)
      VALUES (user_domain, user_domain, NEW.id)
      RETURNING id INTO new_org_id;
      
      -- Create profile with new org
      INSERT INTO public.profiles (id, email, full_name, organization_id, account_type)
      VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', new_org_id, selected_account_type::account_type);
      
      -- Assign owner role
      INSERT INTO public.user_roles (user_id, organization_id, role)
      VALUES (NEW.id, new_org_id, 'owner');
    ELSE
      -- Individual account with business email (no org created)
      INSERT INTO public.profiles (id, email, full_name, organization_id, account_type)
      VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', NULL, 'individual');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();