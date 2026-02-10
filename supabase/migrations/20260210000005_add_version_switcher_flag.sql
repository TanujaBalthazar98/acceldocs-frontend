-- Add version switcher visibility flag
ALTER TABLE projects 
ADD COLUMN show_version_switcher BOOLEAN DEFAULT false;

-- Add helpful comment
COMMENT ON COLUMN projects.show_version_switcher IS 
  'When true, public documentation will show a version switcher dropdown';
