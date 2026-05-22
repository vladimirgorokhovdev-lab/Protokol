ALTER TABLE public.transcription_jobs
  ADD COLUMN IF NOT EXISTS elevenlabs_transcription_id text,
  ADD COLUMN IF NOT EXISTS elevenlabs_request_id text;
