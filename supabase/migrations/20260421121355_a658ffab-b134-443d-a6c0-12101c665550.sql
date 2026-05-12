CREATE TYPE public.transcription_job_status AS ENUM (
  'queued',
  'processing',
  'done',
  'error'
);

CREATE TABLE public.transcription_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  audio_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  num_speakers INTEGER,
  status public.transcription_job_status NOT NULL DEFAULT 'queued',
  status_message TEXT,
  error TEXT,
  segments JSONB,
  transcription_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_transcription_jobs_user_id ON public.transcription_jobs(user_id);
CREATE INDEX idx_transcription_jobs_status ON public.transcription_jobs(status);

ALTER TABLE public.transcription_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON public.transcription_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own jobs"
  ON public.transcription_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON public.transcription_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
  ON public.transcription_jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER transcription_jobs_set_updated_at
  BEFORE UPDATE ON public.transcription_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.transcription_jobs;
ALTER TABLE public.transcription_jobs REPLICA IDENTITY FULL;