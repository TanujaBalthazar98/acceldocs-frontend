
-- Security: set immutable search_path for get_drive_permission_for_role
CREATE OR REPLACE FUNCTION public.get_drive_permission_for_role(_role public.project_role)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE _role
    WHEN 'admin' THEN 'writer'
    WHEN 'editor' THEN 'writer'
    WHEN 'reviewer' THEN 'commenter'
    WHEN 'viewer' THEN 'reader'
    ELSE NULL
  END;
$function$;
