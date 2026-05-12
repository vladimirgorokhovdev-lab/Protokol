
CREATE OR REPLACE FUNCTION public.restore_transcription_segment(
  p_id uuid,
  p_transcription_id uuid,
  p_speaker text,
  p_speaker_index int,
  p_text text,
  p_start_time real,
  p_end_time real,
  p_segment_order int,
  p_is_edited boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.transcriptions WHERE id = p_transcription_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Transcription not found';
  END IF;

  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Make room: shift segment_order of segments at or after target order
  UPDATE public.transcription_segments
     SET segment_order = segment_order + 1
   WHERE transcription_id = p_transcription_id
     AND segment_order >= p_segment_order;

  INSERT INTO public.transcription_segments
    (id, transcription_id, speaker, speaker_index, text, start_time, end_time, segment_order, is_edited)
  VALUES
    (p_id, p_transcription_id, p_speaker, p_speaker_index, p_text, p_start_time, p_end_time, p_segment_order, p_is_edited)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.transcriptions
     SET segment_count = segment_count + 1
   WHERE id = p_transcription_id;
END;
$$;
