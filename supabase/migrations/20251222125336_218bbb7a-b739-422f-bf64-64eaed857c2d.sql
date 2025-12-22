-- Add organization_id to connectors table for org-level connectors
ALTER TABLE public.connectors 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Make project_id nullable (connectors can be org-level)
ALTER TABLE public.connectors 
ALTER COLUMN project_id DROP NOT NULL;

-- Create index for organization-level queries
CREATE INDEX idx_connectors_organization_id ON public.connectors(organization_id);

-- Update RLS policies for connectors to allow org-level access
DROP POLICY IF EXISTS "Users can view connectors for their projects" ON public.connectors;
DROP POLICY IF EXISTS "Users can manage connectors for their projects" ON public.connectors;

-- Allow users to view connectors in their organization
CREATE POLICY "Users can view org connectors"
ON public.connectors
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  OR 
  project_id IN (
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
  )
);

-- Allow admins to manage org connectors
CREATE POLICY "Admins can manage org connectors"
ON public.connectors
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND organization_id = connectors.organization_id
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND organization_id = connectors.organization_id
    AND role IN ('owner', 'admin')
  )
);