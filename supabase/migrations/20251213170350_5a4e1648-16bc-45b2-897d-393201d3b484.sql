-- Fix function search path for is_personal_email_domain
CREATE OR REPLACE FUNCTION public.is_personal_email_domain(email_domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT email_domain = ANY(ARRAY[
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 
    'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'aol.com', 
    'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
    'tutanota.com', 'zoho.com', 'mail.com', 'gmx.com', 'gmx.net'
  ])
$$;