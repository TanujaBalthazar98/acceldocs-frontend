-- Update the duplicate_project_version RPC to preserve project_id for topics and documents
CREATE OR REPLACE FUNCTION duplicate_project_version(
    source_version_id UUID,
    new_name TEXT,
    new_slug TEXT,
    created_by_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_version_id UUID;
    v_project_id UUID;
    topic_mapping JSONB := '{}'::jsonb;
    doc_mapping JSONB := '{}'::jsonb;
    t RECORD;
    d RECORD;
    r RECORD;
    cloned_topic_id UUID;
    cloned_doc_id UUID;
    new_parent_id UUID;
    v_content_html TEXT;
    v_content_changed BOOLEAN;
    v_new_content_id UUID;
BEGIN
    -- 1. Get project_id from source version
    SELECT project_id INTO v_project_id
    FROM project_versions
    WHERE id = source_version_id;

    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'Source version not found';
    END IF;

    -- 2. Create the new version
    INSERT INTO project_versions (
        project_id,
        name,
        slug,
        is_default,
        is_published,
        created_by
    ) VALUES (
        v_project_id,
        new_name,
        new_slug,
        false,
        false,
        created_by_id
    )
    RETURNING id INTO new_version_id;

    -- 3. Clone Topics (maintaining hierarchy and project_id)
    -- This loop clones all topics associated with the source version,
    -- including those that belong to child projects.
    FOR t IN (
        SELECT * FROM topics 
        WHERE project_version_id = source_version_id
        ORDER BY parent_id NULLS FIRST 
    ) LOOP
        -- If this topic has a parent, find its new ID from our mapping
        new_parent_id := NULL;
        IF t.parent_id IS NOT NULL THEN
            new_parent_id := (topic_mapping->>t.parent_id::text)::UUID;
        END IF;

        INSERT INTO topics (
            project_id, -- CRITICAL FIX: Preserve original project_id (could be sub-project)
            project_version_id,
            name,
            slug,
            parent_id,
            display_order,
            drive_folder_id
        ) VALUES (
            t.project_id, -- Used to be v_project_id (bug)
            new_version_id,
            t.name,
            t.slug,
            new_parent_id,
            t.display_order,
            t.drive_folder_id
        )
        RETURNING id INTO cloned_topic_id;

        -- Add to mapping
        topic_mapping := topic_mapping || jsonb_build_object(t.id::text, cloned_topic_id::text);
    END LOOP;

    -- 4. Clone Documents (maintaining topic mapping and project_id)
    FOR d IN (
        SELECT * FROM documents 
        WHERE project_version_id = source_version_id
    ) LOOP
        INSERT INTO documents (
            project_id, -- CRITICAL FIX: Preserve original project_id
            project_version_id,
            topic_id,
            title,
            slug,
            google_doc_id,
            visibility,
            is_published,
            content_id,
            published_content_id,
            display_order,
            owner_id,
            video_url,
            video_title
        ) VALUES (
            d.project_id, -- Used to be v_project_id (bug)
            new_version_id,
            (topic_mapping->>d.topic_id::text)::UUID,
            d.title,
            d.slug,
            d.google_doc_id,
            d.visibility,
            false, -- Clones start as unpublished
            d.content_id, -- Copy content reference (Copy-on-Write)
            NULL, -- Reset published content for the new version by default
            d.display_order,
            d.owner_id,
            d.video_url,
            d.video_title
        )
        RETURNING id INTO cloned_doc_id;

        -- Add to document mapping
        doc_mapping := doc_mapping || jsonb_build_object(d.id::text, cloned_doc_id::text);
    END LOOP;

    -- 5. Internal Link Rewriting (Copy-on-Write)
    FOR d IN (
        SELECT id, content_id 
        FROM documents 
        WHERE project_version_id = new_version_id
          AND content_id IS NOT NULL
    ) LOOP
        -- Fetch current content
        SELECT content INTO v_content_html
        FROM document_contents
        WHERE id = d.content_id;

        v_content_changed := false;

        -- Apply all replacements from the mapping
        FOR r IN SELECT * FROM jsonb_each_text(doc_mapping) LOOP
            IF v_content_html LIKE '%/page/' || r.key || '%' THEN
                v_content_html := REPLACE(v_content_html, '/page/' || r.key, '/page/' || r.value);
                v_content_changed := true;
            END IF;
        END LOOP;

        -- If content actually changed, create a new row in document_contents
        IF v_content_changed THEN
            INSERT INTO document_contents (content)
            VALUES (v_content_html)
            RETURNING id INTO v_new_content_id;

            UPDATE documents
            SET content_id = v_new_content_id
            WHERE id = d.id;
        END IF;
    END LOOP;

    RETURN new_version_id;
END;
$$;
