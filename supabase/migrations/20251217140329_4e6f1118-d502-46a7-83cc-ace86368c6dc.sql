-- Add parent_id and display_order to topics for hierarchical structure
ALTER TABLE public.topics 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Create index for efficient parent lookups
CREATE INDEX IF NOT EXISTS idx_topics_parent_id ON public.topics(parent_id);
CREATE INDEX IF NOT EXISTS idx_topics_display_order ON public.topics(project_id, display_order);

-- Update RLS policies to allow moving topics (already covered by existing policies)