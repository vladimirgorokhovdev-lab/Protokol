-- Fix: team members must access segments of team transcriptions
DROP POLICY IF EXISTS "Users can view own segments" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can create own segments" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can update own segments" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can delete own segments" ON public.transcription_segments;

CREATE POLICY "View own or team segments"
ON public.transcription_segments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transcriptions t
    WHERE t.id = transcription_segments.transcription_id
      AND (
        t.user_id = auth.uid()
        OR (t.team_id IS NOT NULL AND public.is_team_member(auth.uid(), t.team_id))
      )
  )
);

CREATE POLICY "Insert own or team segments"
ON public.transcription_segments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.transcriptions t
    WHERE t.id = transcription_segments.transcription_id
      AND (
        t.user_id = auth.uid()
        OR (t.team_id IS NOT NULL AND public.is_team_member(auth.uid(), t.team_id))
      )
  )
);

CREATE POLICY "Update own or team segments"
ON public.transcription_segments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transcriptions t
    WHERE t.id = transcription_segments.transcription_id
      AND (
        t.user_id = auth.uid()
        OR (t.team_id IS NOT NULL AND public.is_team_member(auth.uid(), t.team_id))
      )
  )
);

CREATE POLICY "Delete own or team segments"
ON public.transcription_segments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transcriptions t
    WHERE t.id = transcription_segments.transcription_id
      AND (
        t.user_id = auth.uid()
        OR (t.team_id IS NOT NULL AND public.is_team_owner(auth.uid(), t.team_id))
      )
  )
);