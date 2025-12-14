-- Enable DELETE for projects
CREATE POLICY "Editors can delete projects in their org"
ON public.projects
FOR DELETE
USING (organization_id = get_user_org_id(auth.uid()));

-- Enable DELETE for topics
CREATE POLICY "Users can delete topics in their org projects"
ON public.topics
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = topics.project_id
    AND p.organization_id = get_user_org_id(auth.uid())
));

-- Enable DELETE for documents
CREATE POLICY "Users can delete documents in their org projects"
ON public.documents
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = documents.project_id
    AND p.organization_id = get_user_org_id(auth.uid())
));