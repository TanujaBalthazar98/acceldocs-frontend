-- Create visibility enum
CREATE TYPE public.visibility_level AS ENUM ('internal', 'external', 'public');

-- Add visibility and published columns to projects
ALTER TABLE public.projects
ADD COLUMN visibility visibility_level NOT NULL DEFAULT 'internal',
ADD COLUMN is_published boolean NOT NULL DEFAULT false;

-- Add visibility, published, and owner_id columns to documents
ALTER TABLE public.documents
ADD COLUMN visibility visibility_level NOT NULL DEFAULT 'internal',
ADD COLUMN is_published boolean NOT NULL DEFAULT false,
ADD COLUMN owner_id uuid REFERENCES public.profiles(id);

-- Create RLS policy for public documents (read-only for public visibility)
CREATE POLICY "Public documents are viewable by everyone"
ON public.documents
FOR SELECT
USING (visibility = 'public' AND is_published = true);

-- Create RLS policy for public projects (read-only for public visibility)
CREATE POLICY "Public projects are viewable by everyone"
ON public.projects
FOR SELECT
USING (visibility = 'public' AND is_published = true);