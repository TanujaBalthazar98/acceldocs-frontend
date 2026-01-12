-- Add policy for public access to topics in public projects
CREATE POLICY "Public topics are viewable by everyone" 
ON public.topics 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = topics.project_id 
    AND p.visibility = 'public'::visibility_level 
    AND p.is_published = true
  )
);