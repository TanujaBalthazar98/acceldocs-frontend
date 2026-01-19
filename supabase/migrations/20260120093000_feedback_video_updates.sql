alter table public.documents
  add column if not exists video_url text,
  add column if not exists video_title text;

alter table public.page_feedback
  add column if not exists rating integer,
  add column if not exists issue_type text;

alter table public.page_feedback
  drop constraint if exists page_feedback_rating_check;

alter table public.page_feedback
  add constraint page_feedback_rating_check
  check (rating is null or rating between 1 and 5);

alter table public.page_feedback
  drop constraint if exists page_feedback_issue_type_check;

alter table public.page_feedback
  add constraint page_feedback_issue_type_check
  check (issue_type is null or issue_type in ('bug', 'question', 'idea'));

DROP POLICY IF EXISTS "Authenticated users can create feedback" ON public.page_feedback;

CREATE POLICY "Users can create feedback" ON public.page_feedback
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = page_feedback.document_id
        AND d.is_published = true
        AND d.visibility = 'public'
    )
  );
