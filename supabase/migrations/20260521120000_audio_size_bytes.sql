-- Track uploaded audio size for per-user / per-team storage quotas (GB limits).
ALTER TABLE public.transcriptions
  ADD COLUMN IF NOT EXISTS audio_size_bytes bigint;

COMMENT ON COLUMN public.transcriptions.audio_size_bytes IS
  'Size of file in audio-files bucket when audio_path is set; cleared when audio is deleted.';
