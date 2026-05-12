
-- Transcriptions table
CREATE TABLE public.transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  duration REAL NOT NULL DEFAULT 0,
  speaker_count INTEGER NOT NULL DEFAULT 0,
  segment_count INTEGER NOT NULL DEFAULT 0,
  speaker_names JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transcriptions"
  ON public.transcriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transcriptions"
  ON public.transcriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transcriptions"
  ON public.transcriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own transcriptions"
  ON public.transcriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Transcription segments table
CREATE TABLE public.transcription_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transcription_id UUID NOT NULL REFERENCES public.transcriptions(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  speaker_index INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  start_time REAL NOT NULL DEFAULT 0,
  end_time REAL NOT NULL DEFAULT 0,
  segment_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.transcription_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own segments"
  ON public.transcription_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transcriptions t
      WHERE t.id = transcription_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own segments"
  ON public.transcription_segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transcriptions t
      WHERE t.id = transcription_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own segments"
  ON public.transcription_segments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcriptions t
      WHERE t.id = transcription_id AND t.user_id = auth.uid()
    )
  );

CREATE INDEX idx_segments_transcription ON public.transcription_segments(transcription_id);
CREATE INDEX idx_transcriptions_user ON public.transcriptions(user_id);
CREATE INDEX idx_transcriptions_created ON public.transcriptions(created_at DESC);
