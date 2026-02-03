-- Backfill project_id from topics and project_versions where possible.
UPDATE public.documents d
SET project_id = t.project_id
FROM public.topics t
WHERE d.project_id IS NULL
  AND d.topic_id = t.id;

UPDATE public.documents d
SET project_id = v.project_id
FROM public.project_versions v
WHERE d.project_id IS NULL
  AND d.project_version_id = v.id;

-- Auto-fill project_id when topic_id or project_version_id is provided.
CREATE OR REPLACE FUNCTION public.set_document_project_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    IF NEW.topic_id IS NOT NULL THEN
      SELECT project_id INTO NEW.project_id
      FROM public.topics
      WHERE id = NEW.topic_id;
    END IF;

    IF NEW.project_id IS NULL AND NEW.project_version_id IS NOT NULL THEN
      SELECT project_id INTO NEW.project_id
      FROM public.project_versions
      WHERE id = NEW.project_version_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_set_project_id ON public.documents;
CREATE TRIGGER documents_set_project_id
BEFORE INSERT OR UPDATE OF topic_id, project_version_id, project_id
ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.set_document_project_id();

-- Enforce that if a document has a topic or version, it must also have a project.
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_project_required_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_project_required_check
  CHECK ((topic_id IS NULL AND project_version_id IS NULL) OR project_id IS NOT NULL);
