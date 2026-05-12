
CREATE TABLE public.speaker_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.speaker_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own presets" ON public.speaker_presets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own presets" ON public.speaker_presets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own presets" ON public.speaker_presets FOR DELETE TO authenticated USING (auth.uid() = user_id);
