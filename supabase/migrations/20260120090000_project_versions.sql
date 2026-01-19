-- Project versions
CREATE TABLE IF NOT EXISTS public.project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  semver_major integer NOT NULL DEFAULT 1,
  semver_minor integer NOT NULL DEFAULT 0,
  semver_patch integer NOT NULL DEFAULT 0,
  created_from_version_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_versions_project_id_fkey'
      AND conrelid = 'public.project_versions'::regclass
  ) THEN
    ALTER TABLE public.project_versions
      ADD CONSTRAINT project_versions_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_versions_created_from_version_id_fkey'
      AND conrelid = 'public.project_versions'::regclass
  ) THEN
    ALTER TABLE public.project_versions
      ADD CONSTRAINT project_versions_created_from_version_id_fkey
      FOREIGN KEY (created_from_version_id) REFERENCES public.project_versions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_versions_created_by_fkey'
      AND conrelid = 'public.project_versions'::regclass
  ) THEN
    ALTER TABLE public.project_versions
      ADD CONSTRAINT project_versions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS project_versions_project_slug_key ON public.project_versions(project_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS project_versions_default_unique ON public.project_versions(project_id) WHERE is_default;

CREATE TRIGGER update_project_versions_updated_at
  BEFORE UPDATE ON public.project_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project versions in their org" ON public.project_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_versions.project_id
        AND p.organization_id = public.get_user_org_id(auth.uid())
    )
  );

CREATE POLICY "External users can view versions in invited projects" ON public.project_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_versions.project_id
        AND p.visibility = 'external'::public.visibility_level
        AND p.is_published = true
        AND public.is_project_member(p.id, auth.uid())
    )
    AND is_published = true
  );

CREATE POLICY "Public versions are viewable by everyone" ON public.project_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_versions.project_id
        AND p.visibility = 'public'::public.visibility_level
        AND p.is_published = true
    )
    AND is_published = true
  );

CREATE POLICY "Editors can manage project versions" ON public.project_versions
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_versions.project_id
        AND p.organization_id = public.get_user_org_id(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_versions.project_id
        AND p.organization_id = public.get_user_org_id(auth.uid())
    )
  );

-- Seed default versions per project
INSERT INTO public.project_versions (project_id, name, slug, is_default, is_published, semver_major, semver_minor, semver_patch, created_by)
SELECT
  p.id,
  'v1.0' AS name,
  'v1.0' AS slug,
  true AS is_default,
  p.is_published,
  1,
  0,
  0,
  p.created_by
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.project_versions pv
  WHERE pv.project_id = p.id
);

-- Add version reference to topics/documents
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS project_version_id uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS project_version_id uuid;

UPDATE public.topics t
SET project_version_id = pv.id
FROM public.project_versions pv
WHERE t.project_version_id IS NULL
  AND pv.project_id = t.project_id
  AND pv.is_default = true;

UPDATE public.documents d
SET project_version_id = pv.id
FROM public.project_versions pv
WHERE d.project_version_id IS NULL
  AND pv.project_id = d.project_id
  AND pv.is_default = true;

ALTER TABLE public.topics ALTER COLUMN project_version_id SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN project_version_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'topics_project_version_id_fkey'
      AND conrelid = 'public.topics'::regclass
  ) THEN
    ALTER TABLE public.topics
      ADD CONSTRAINT topics_project_version_id_fkey
      FOREIGN KEY (project_version_id) REFERENCES public.project_versions(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_project_version_id_fkey'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_project_version_id_fkey
      FOREIGN KEY (project_version_id) REFERENCES public.project_versions(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS public.documents_slug_project_unique;
DROP INDEX IF EXISTS public.topics_slug_project_unique;

CREATE UNIQUE INDEX IF NOT EXISTS documents_slug_version_unique
  ON public.documents (project_version_id, slug)
  WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS topics_slug_version_unique
  ON public.topics (project_version_id, slug)
  WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_unique_slug(
  base_slug text,
  table_name text,
  scope_column text,
  scope_value uuid,
  exclude_id uuid DEFAULT NULL::uuid
) RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $_$
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
  IF scope_column NOT IN ('organization_id', 'project_id', 'project_version_id') THEN
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
$_$;

CREATE OR REPLACE FUNCTION public.auto_generate_document_slug() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  default_version_id uuid;
BEGIN
  IF NEW.project_version_id IS NULL THEN
    SELECT id INTO default_version_id
    FROM public.project_versions
    WHERE project_id = NEW.project_id
      AND is_default = true
    ORDER BY semver_major DESC, semver_minor DESC, semver_patch DESC
    LIMIT 1;

    IF default_version_id IS NULL THEN
      SELECT id INTO default_version_id
      FROM public.project_versions
      WHERE project_id = NEW.project_id
      ORDER BY is_published DESC, semver_major DESC, semver_minor DESC, semver_patch DESC
      LIMIT 1;
    END IF;

    NEW.project_version_id := default_version_id;
  END IF;

  -- Only generate slug if not provided or if title changed
  IF NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.title != NEW.title AND NEW.slug = OLD.slug) THEN
    base_slug := generate_slug(NEW.title);
    NEW.slug := ensure_unique_slug(base_slug, 'documents', 'project_version_id', NEW.project_version_id, NEW.id);

    -- Store old slug in history if updating
    IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug != NEW.slug THEN
      INSERT INTO public.slug_history (entity_type, entity_id, old_slug)
      VALUES ('document', NEW.id, OLD.slug);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_topic_slug() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  default_version_id uuid;
BEGIN
  IF NEW.project_version_id IS NULL THEN
    SELECT id INTO default_version_id
    FROM public.project_versions
    WHERE project_id = NEW.project_id
      AND is_default = true
    ORDER BY semver_major DESC, semver_minor DESC, semver_patch DESC
    LIMIT 1;

    IF default_version_id IS NULL THEN
      SELECT id INTO default_version_id
      FROM public.project_versions
      WHERE project_id = NEW.project_id
      ORDER BY is_published DESC, semver_major DESC, semver_minor DESC, semver_patch DESC
      LIMIT 1;
    END IF;

    NEW.project_version_id := default_version_id;
  END IF;

  -- Only generate slug if not provided or if name changed
  IF NEW.slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.name != NEW.name AND NEW.slug = OLD.slug) THEN
    base_slug := generate_slug(NEW.name);
    NEW.slug := ensure_unique_slug(base_slug, 'topics', 'project_version_id', NEW.project_version_id, NEW.id);

    -- Store old slug in history if updating
    IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug != NEW.slug THEN
      INSERT INTO public.slug_history (entity_type, entity_id, old_slug)
      VALUES ('topic', NEW.id, OLD.slug);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
