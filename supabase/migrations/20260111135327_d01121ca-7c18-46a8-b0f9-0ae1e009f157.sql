-- Tighten document write access to project editors/admins (and org owner via can_edit_project)

-- Remove overly-broad / misleading policies (and avoid policy AND conflicts)
DROP POLICY IF EXISTS "Editors can manage documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents in their org projects" ON public.documents;

-- Allow only project editors/admins (and org owner) to create/update/delete documents
CREATE POLICY "Project editors can insert documents"
ON public.documents
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "Project editors can update documents"
ON public.documents
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.can_edit_project(project_id, auth.uid()))
WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "Project editors can delete documents"
ON public.documents
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.can_edit_project(project_id, auth.uid()));
