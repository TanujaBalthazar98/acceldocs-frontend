-- Add subdomain field for organizations (e.g., acme -> acme.docspeare.io)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;

-- Add subdomain field for personal accounts (e.g., john -> john.docspeare.io)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;

-- Create a domains table for custom domain management
CREATE TABLE IF NOT EXISTS public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  domain_type text NOT NULL DEFAULT 'custom' CHECK (domain_type IN ('custom', 'subdomain')),
  is_primary boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  verification_token text,
  verified_at timestamp with time zone,
  ssl_status text DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'provisioning', 'active', 'failed')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  -- Either org-level or project-level domain
  CONSTRAINT domain_scope CHECK (
    (organization_id IS NOT NULL AND project_id IS NULL) OR
    (organization_id IS NULL AND project_id IS NOT NULL) OR
    (organization_id IS NOT NULL AND project_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

-- RLS policies for domains
CREATE POLICY "Public domains are viewable by everyone"
ON public.domains FOR SELECT
USING (is_verified = true);

CREATE POLICY "Org owners can manage domains"
ON public.domains FOR ALL
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE owner_id = auth.uid()
  )
  OR
  project_id IN (
    SELECT p.id FROM projects p
    JOIN organizations o ON o.id = p.organization_id
    WHERE o.owner_id = auth.uid()
  )
);

-- Add RLS policy for projects to allow viewing by external invited users
CREATE POLICY "External users can view invited projects"
ON public.projects FOR SELECT
USING (
  visibility = 'external'::visibility_level
  AND is_published = true
  AND id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  )
);

-- Add RLS policy for documents to allow external users to view docs in invited projects
CREATE POLICY "External users can view docs in invited projects"
ON public.documents FOR SELECT
USING (
  project_id IN (
    SELECT pm.project_id FROM project_members pm
    JOIN projects p ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    AND p.visibility = 'external'::visibility_level
    AND p.is_published = true
  )
  AND published_content_html IS NOT NULL
);

-- Add RLS policy for topics to allow external users to view topics in invited projects
CREATE POLICY "External users can view topics in invited projects"
ON public.topics FOR SELECT
USING (
  project_id IN (
    SELECT pm.project_id FROM project_members pm
    JOIN projects p ON p.id = pm.project_id
    WHERE pm.user_id = auth.uid()
    AND p.visibility = 'external'::visibility_level
    AND p.is_published = true
  )
);

-- Create index for faster domain lookups
CREATE INDEX IF NOT EXISTS idx_domains_domain ON public.domains(domain);
CREATE INDEX IF NOT EXISTS idx_domains_org ON public.domains(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain ON public.organizations(subdomain);
CREATE INDEX IF NOT EXISTS idx_profiles_subdomain ON public.profiles(subdomain);

-- Update organizations RLS to allow public viewing for published docs
CREATE POLICY "Public orgs are viewable for docs"
ON public.organizations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.organization_id = organizations.id
    AND p.visibility = 'public'::visibility_level
    AND p.is_published = true
  )
);