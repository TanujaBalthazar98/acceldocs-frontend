-- Disable version switcher for sub-projects to consolidate versioning at root level
-- Only root projects should have show_version_switcher enabled

UPDATE projects
SET show_version_switcher = false
WHERE parent_id IS NOT NULL;
