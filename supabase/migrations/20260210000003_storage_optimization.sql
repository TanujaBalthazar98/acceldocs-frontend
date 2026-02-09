-- Phase 3: Storage Optimization (Copy-on-Write)

-- 1. Create document_contents table
CREATE TABLE IF NOT EXISTS document_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add reference columns to documents
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content_id UUID REFERENCES document_contents(id),
ADD COLUMN IF NOT EXISTS published_content_id UUID REFERENCES document_contents(id);

-- 3. Initial Migration: Move existing content to document_contents
-- We use a CTE to insert and then update
DO $$
DECLARE
    doc_row RECORD;
    new_content_id UUID;
    new_published_id UUID;
BEGIN
    FOR doc_row IN SELECT id, content_html, published_content_html FROM documents LOOP
        new_content_id := NULL;
        new_published_id := NULL;

        IF doc_row.content_html IS NOT NULL THEN
            INSERT INTO document_contents (content) VALUES (doc_row.content_html) RETURNING id INTO new_content_id;
        END IF;

        IF doc_row.published_content_html IS NOT NULL THEN
            -- Check if draft and published are identical to share the row
            IF doc_row.content_html = doc_row.published_content_html THEN
                new_published_id := new_content_id;
            ELSE
                INSERT INTO document_contents (content) VALUES (doc_row.published_content_html) RETURNING id INTO new_published_id;
            END IF;
        END IF;

        UPDATE documents 
        SET content_id = new_content_id, 
            published_content_id = new_published_id 
        WHERE id = doc_row.id;
    END LOOP;
END;
$$;

-- 4. Update the duplicate_project_version RPC to use references
-- (We'll do this in a separate command or update the existing one)

-- Note: We wait to drop content_html and published_content_html until 
-- the application code is updated to use the new columns.
