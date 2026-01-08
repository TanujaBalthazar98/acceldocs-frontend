-- Add display_order column to documents for manual ordering
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_documents_display_order ON public.documents(topic_id, display_order);

-- Set initial display_order based on current order (by title or created_at)
WITH ordered_docs AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY topic_id 
    ORDER BY 
      -- Try to extract version numbers for smart ordering
      CASE 
        WHEN title ~ '^Version \d' THEN 
          CAST(REGEXP_REPLACE(title, '^Version (\d+)\.(\d+)\.(\d+).*', '\1', 'g') AS integer) * 10000 +
          CAST(REGEXP_REPLACE(title, '^Version (\d+)\.(\d+)\.(\d+).*', '\2', 'g') AS integer) * 100 +
          CAST(REGEXP_REPLACE(title, '^Version (\d+)\.(\d+)\.(\d+).*', '\3', 'g') AS integer)
        ELSE 0
      END DESC,
      created_at ASC
  ) as rn
  FROM public.documents
)
UPDATE public.documents d
SET display_order = od.rn
FROM ordered_docs od
WHERE d.id = od.id;