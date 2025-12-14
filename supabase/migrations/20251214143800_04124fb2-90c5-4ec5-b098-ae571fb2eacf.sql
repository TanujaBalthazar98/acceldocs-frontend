-- Add column to store Google refresh tokens securely
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

-- Add column to store last token refresh time
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS google_token_refreshed_at TIMESTAMP WITH TIME ZONE;

-- RLS policy to allow users to update their own refresh token
CREATE POLICY "Users can update own refresh token" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);