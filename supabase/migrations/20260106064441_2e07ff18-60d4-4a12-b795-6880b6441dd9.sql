-- Add custom documentation domain field to organizations
ALTER TABLE public.organizations
ADD COLUMN custom_docs_domain text UNIQUE;

-- Add index for faster domain lookups
CREATE INDEX idx_organizations_custom_docs_domain ON public.organizations(custom_docs_domain) WHERE custom_docs_domain IS NOT NULL;

-- Add a comment explaining the field
COMMENT ON COLUMN public.organizations.custom_docs_domain IS 'Custom subdomain for published documentation (e.g., docs.company.com)';