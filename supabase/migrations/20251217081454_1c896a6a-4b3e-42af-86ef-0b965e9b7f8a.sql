-- Create import_jobs table to track import progress
CREATE TABLE public.import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  topics_created INTEGER NOT NULL DEFAULT 0,
  pages_created INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  current_file TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own import jobs
CREATE POLICY "Users can view their own import jobs"
ON public.import_jobs
FOR SELECT
USING (auth.uid() = user_id);

-- Enable realtime for import_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.import_jobs;

-- Create index for faster lookups
CREATE INDEX idx_import_jobs_project ON public.import_jobs(project_id);
CREATE INDEX idx_import_jobs_user ON public.import_jobs(user_id);