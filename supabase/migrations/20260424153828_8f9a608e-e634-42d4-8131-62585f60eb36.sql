
CREATE OR REPLACE FUNCTION public.split_transcription_segment(
  p_segment_id uuid,
  p_first_text text,
  p_second_text text,
  p_split_time real
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transcription_id uuid;
  v_segment_order int;
  v_speaker text;
  v_speaker_index int;
  v_end_time real;
  v_user_id uuid;
  v_new_id uuid;
BEGIN
  SELECT s.transcription_id, s.segment_order, s.speaker, s.speaker_index, s.end_time, t.user_id
    INTO v_transcription_id, v_segment_order, v_speaker, v_speaker_index, v_end_time, v_user_id
  FROM public.transcription_segments s
  JOIN public.transcriptions t ON t.id = s.transcription_id
  WHERE s.id = p_segment_id;

  IF v_transcription_id IS NULL THEN
    RAISE EXCEPTION 'Segment not found';
  END IF;

  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Shift subsequent segments to make room
  UPDATE public.transcription_segments
     SET segment_order = segment_order + 1
   WHERE transcription_id = v_transcription_id
     AND segment_order > v_segment_order;

  -- Update first half
  UPDATE public.transcription_segments
     SET text = p_first_text,
         end_time = p_split_time,
         is_edited = true
   WHERE id = p_segment_id;

  -- Insert second half
  INSERT INTO public.transcription_segments
    (transcription_id, speaker, speaker_index, text, start_time, end_time, segment_order, is_edited)
  VALUES
    (v_transcription_id, v_speaker, v_speaker_index, p_second_text, p_split_time, v_end_time, v_segment_order + 1, true)
  RETURNING id INTO v_new_id;

  -- Bump segment_count
  UPDATE public.transcriptions
     SET segment_count = segment_count + 1
   WHERE id = v_transcription_id;

  RETURN v_new_id;
END;
$$;
