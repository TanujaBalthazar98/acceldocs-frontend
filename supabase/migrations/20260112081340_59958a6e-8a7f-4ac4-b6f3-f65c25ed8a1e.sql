
-- Fix: Change documents INSERT/UPDATE/DELETE policies from RESTRICTIVE to PERMISSIVE
-- Restrictive policies alone block all access - they need permissive policies to restrict from.

-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Project editors can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Project editors can update documents" ON public.documents;
DROP POLICY IF EXISTS "Project editors can delete documents" ON public.documents;

-- Recreate as PERMISSIVE policies (the default)
CREATE POLICY "Project editors can insert documents" 
ON public.documents 
FOR INSERT 
TO authenticated
WITH CHECK (can_edit_project(project_id, auth.uid()));

CREATE POLICY "Project editors can update documents" 
ON public.documents 
FOR UPDATE 
TO authenticated
USING (can_edit_project(project_id, auth.uid()))
WITH CHECK (can_edit_project(project_id, auth.uid()));

CREATE POLICY "Project editors can delete documents" 
ON public.documents 
FOR DELETE 
TO authenticated
USING (can_edit_project(project_id, auth.uid()));
