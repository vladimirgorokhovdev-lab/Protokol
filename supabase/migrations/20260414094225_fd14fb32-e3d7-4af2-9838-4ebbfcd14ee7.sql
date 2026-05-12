
CREATE POLICY "Users can update own segments"
ON public.transcription_segments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM transcriptions t
    WHERE t.id = transcription_segments.transcription_id
    AND t.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM transcriptions t
    WHERE t.id = transcription_segments.transcription_id
    AND t.user_id = auth.uid()
  )
);
