-- Create a table for user feedback/comments on documentation pages
CREATE TABLE public.page_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  content TEXT NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'comment', -- 'comment', 'suggestion', 'issue'
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can read feedback on public/published documents
CREATE POLICY "Anyone can view feedback on published docs" 
ON public.page_feedback 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = page_feedback.document_id 
    AND d.is_published = true 
    AND d.visibility = 'public'
  )
);

-- Authenticated users can create feedback
CREATE POLICY "Authenticated users can create feedback" 
ON public.page_feedback 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own feedback
CREATE POLICY "Users can update own feedback" 
ON public.page_feedback 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own feedback
CREATE POLICY "Users can delete own feedback" 
ON public.page_feedback 
FOR DELETE 
USING (auth.uid() = user_id);

-- Org users can view all feedback on their org's documents
CREATE POLICY "Org users can view feedback on their docs" 
ON public.page_feedback 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM documents d
    JOIN projects p ON p.id = d.project_id
    WHERE d.id = page_feedback.document_id 
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

-- Org users can manage (resolve/delete) feedback on their documents
CREATE POLICY "Org users can manage feedback on their docs" 
ON public.page_feedback 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM documents d
    JOIN projects p ON p.id = d.project_id
    WHERE d.id = page_feedback.document_id 
    AND p.organization_id = get_user_org_id(auth.uid())
  )
);

-- Create index for faster lookups
CREATE INDEX idx_page_feedback_document_id ON public.page_feedback(document_id);

-- Add trigger for updated_at
CREATE TRIGGER update_page_feedback_updated_at
BEFORE UPDATE ON public.page_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();