-- Billing status on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_status text DEFAULT 'active';

-- Immutable document versions
CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid,
  project_id uuid NOT NULL,
  project_version_id uuid NOT NULL,
  title text NOT NULL,
  content_html text NOT NULL,
  content_text text,
  source_doc_id text,
  created_by uuid,
  is_preview boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_versions_document_id_fkey'
      AND conrelid = 'public.document_versions'::regclass
  ) THEN
    ALTER TABLE public.document_versions
      ADD CONSTRAINT document_versions_document_id_fkey
      FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_versions_project_id_fkey'
      AND conrelid = 'public.document_versions'::regclass
  ) THEN
    ALTER TABLE public.document_versions
      ADD CONSTRAINT document_versions_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_versions_project_version_id_fkey'
      AND conrelid = 'public.document_versions'::regclass
  ) THEN
    ALTER TABLE public.document_versions
      ADD CONSTRAINT document_versions_project_version_id_fkey
      FOREIGN KEY (project_version_id) REFERENCES public.project_versions(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_versions_created_by_fkey'
      AND conrelid = 'public.document_versions'::regclass
  ) THEN
    ALTER TABLE public.document_versions
      ADD CONSTRAINT document_versions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_versions_project_id
  ON public.document_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_project_version_id
  ON public.document_versions(project_version_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id
  ON public.document_versions(document_id);

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view document versions in their org" ON public.document_versions;
CREATE POLICY "Users can view document versions in their org" ON public.document_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = document_versions.project_id
        AND p.organization_id = public.get_user_org_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Public document versions are viewable" ON public.document_versions;
CREATE POLICY "Public document versions are viewable" ON public.document_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = document_versions.project_id
        AND p.visibility = 'public'::public.visibility_level
        AND p.is_published = true
    )
    AND is_published = true
  );

DROP POLICY IF EXISTS "Editors can create document versions" ON public.document_versions;
CREATE POLICY "Editors can create document versions" ON public.document_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = document_versions.project_id
        AND p.organization_id = public.get_user_org_id(auth.uid())
    )
  );
