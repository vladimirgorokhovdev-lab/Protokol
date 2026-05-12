
CREATE OR REPLACE FUNCTION public.merge_transcription_segments(
  p_first_id uuid,
  p_second_id uuid,
  p_merged_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transcription_id uuid;
  v_user_id uuid;
  v_first_order int;
  v_second_order int;
  v_second_end real;
  v_second_tr uuid;
BEGIN
  SELECT s.transcription_id, t.user_id, s.segment_order
    INTO v_transcription_id, v_user_id, v_first_order
  FROM public.transcription_segments s
  JOIN public.transcriptions t ON t.id = s.transcription_id
  WHERE s.id = p_first_id;

  SELECT s.transcription_id, s.segment_order, s.end_time
    INTO v_second_tr, v_second_order, v_second_end
  FROM public.transcription_segments s
  WHERE s.id = p_second_id;

  IF v_transcription_id IS NULL OR v_second_tr IS NULL THEN
    RAISE EXCEPTION 'Segment not found';
  END IF;

  IF v_transcription_id <> v_second_tr THEN
    RAISE EXCEPTION 'Segments belong to different transcriptions';
  END IF;

  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Update first: extend end_time, set merged text, mark edited
  UPDATE public.transcription_segments
     SET text = p_merged_text,
         end_time = v_second_end,
         is_edited = true
   WHERE id = p_first_id;

  -- Delete second
  DELETE FROM public.transcription_segments WHERE id = p_second_id;

  -- Shift segment_order of subsequent segments down by 1
  UPDATE public.transcription_segments
     SET segment_order = segment_order - 1
   WHERE transcription_id = v_transcription_id
     AND segment_order > v_second_order;

  -- Decrement segment_count
  UPDATE public.transcriptions
     SET segment_count = GREATEST(segment_count - 1, 0)
   WHERE id = v_transcription_id;
END;
$$;
