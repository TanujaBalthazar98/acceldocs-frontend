-- Fix ensure_unique_slug() by adding whitelist validation for table_name and scope_column
CREATE OR REPLACE FUNCTION public.ensure_unique_slug(base_slug text, table_name text, scope_column text, scope_value uuid, exclude_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  final_slug TEXT;
  counter INT := 0;
  slug_exists BOOLEAN;
BEGIN
  -- Whitelist validation for table_name to prevent SQL injection
  IF table_name NOT IN ('projects', 'documents', 'topics', 'organizations') THEN
    RAISE EXCEPTION 'Invalid table name: %', table_name;
  END IF;
  
  -- Whitelist validation for scope_column
  IF scope_column NOT IN ('organization_id', 'project_id') THEN
    RAISE EXCEPTION 'Invalid scope column: %', scope_column;
  END IF;

  final_slug := base_slug;
  
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE slug = $1 AND %I = $2 AND ($3 IS NULL OR id != $3))',
      table_name, scope_column
    ) INTO slug_exists USING final_slug, scope_value, exclude_id;
    
    IF NOT slug_exists THEN
      RETURN final_slug;
    END IF;
    
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
END;
$function$;