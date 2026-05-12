ALTER TABLE public.transcriptions
  ADD COLUMN IF NOT EXISTS source_audio_paths jsonb,
  ADD COLUMN IF NOT EXISTS source_file_names jsonb;