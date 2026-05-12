
CREATE OR REPLACE FUNCTION public.search_transcriptions(search_query TEXT)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ts.transcription_id
  FROM public.transcription_segments ts
  JOIN public.transcriptions t ON t.id = ts.transcription_id
  WHERE t.user_id = auth.uid()
    AND ts.text ILIKE '%' || search_query || '%'
$$;
