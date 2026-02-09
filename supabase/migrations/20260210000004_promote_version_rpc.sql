-- Create a function to promote a project version to be the default one
CREATE OR REPLACE FUNCTION promote_version_to_default(target_version_id UUID)
RETURNS VOID AS $$
DECLARE
    v_project_id UUID;
BEGIN
    -- 1. Get the project_id for the target version
    SELECT project_id INTO v_project_id
    FROM project_versions
    WHERE id = target_version_id;

    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'Project version not found';
    END IF;

    -- 2. Clear default status from all versions of this project
    UPDATE project_versions
    SET is_default = false
    WHERE project_id = v_project_id;

    -- 3. Set the target version as default
    UPDATE project_versions
    SET is_default = true
    WHERE id = target_version_id;

    -- Note: Ensure is_published is also true for default versions? 
    -- Usually, yes, if it's the canonical one.
    UPDATE project_versions
    SET is_published = true
    WHERE id = target_version_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
