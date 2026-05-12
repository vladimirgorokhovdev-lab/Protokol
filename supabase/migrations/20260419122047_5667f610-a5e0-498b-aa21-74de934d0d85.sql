
-- Folders table
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  case_number TEXT,
  color TEXT NOT NULL DEFAULT '#1e3a8a',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders" ON public.folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own folders" ON public.folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#d4af37',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tags" ON public.tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add folder_id to transcriptions
ALTER TABLE public.transcriptions ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;
CREATE INDEX idx_transcriptions_folder_id ON public.transcriptions(folder_id);

-- Junction table transcription_tags
CREATE TABLE public.transcription_tags (
  transcription_id UUID NOT NULL REFERENCES public.transcriptions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (transcription_id, tag_id)
);

ALTER TABLE public.transcription_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transcription tags" ON public.transcription_tags FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.transcriptions t WHERE t.id = transcription_id AND t.user_id = auth.uid()));

CREATE POLICY "Users can create own transcription tags" ON public.transcription_tags FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.transcriptions t WHERE t.id = transcription_id AND t.user_id = auth.uid()));

CREATE POLICY "Users can delete own transcription tags" ON public.transcription_tags FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.transcriptions t WHERE t.id = transcription_id AND t.user_id = auth.uid()));

CREATE INDEX idx_transcription_tags_tag_id ON public.transcription_tags(tag_id);

-- Trigger for folders.updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_folders_updated_at BEFORE UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enhanced search RPC: searches by text content AND filename, returns transcription IDs with match count
CREATE OR REPLACE FUNCTION public.search_transcriptions_advanced(
  p_query TEXT DEFAULT NULL,
  p_folder_id UUID DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT NULL,
  p_speaker TEXT DEFAULT NULL,
  p_case_number TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  transcription_id UUID,
  match_count BIGINT,
  first_snippet TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT t.id
    FROM public.transcriptions t
    LEFT JOIN public.folders f ON f.id = t.folder_id
    WHERE t.user_id = auth.uid()
      AND (p_folder_id IS NULL OR t.folder_id = p_folder_id)
      AND (p_case_number IS NULL OR f.case_number ILIKE '%' || p_case_number || '%')
      AND (p_date_from IS NULL OR t.created_at >= p_date_from)
      AND (p_date_to IS NULL OR t.created_at <= p_date_to)
      AND (
        p_tag_ids IS NULL OR EXISTS (
          SELECT 1 FROM public.transcription_tags tt
          WHERE tt.transcription_id = t.id AND tt.tag_id = ANY(p_tag_ids)
        )
      )
      AND (
        p_speaker IS NULL OR EXISTS (
          SELECT 1 FROM public.transcription_segments s
          WHERE s.transcription_id = t.id AND s.speaker ILIKE '%' || p_speaker || '%'
        )
      )
  )
  SELECT
    b.id,
    COALESCE(COUNT(s.id) FILTER (WHERE p_query IS NOT NULL AND s.text ILIKE '%' || p_query || '%'), 0) AS match_count,
    (SELECT s2.text FROM public.transcription_segments s2
      WHERE s2.transcription_id = b.id
        AND (p_query IS NULL OR s2.text ILIKE '%' || p_query || '%')
      ORDER BY s2.segment_order LIMIT 1) AS first_snippet
  FROM base b
  LEFT JOIN public.transcription_segments s ON s.transcription_id = b.id
  GROUP BY b.id
  HAVING (p_query IS NULL OR COUNT(s.id) FILTER (WHERE s.text ILIKE '%' || p_query || '%') > 0)
  ORDER BY match_count DESC;
$$;
