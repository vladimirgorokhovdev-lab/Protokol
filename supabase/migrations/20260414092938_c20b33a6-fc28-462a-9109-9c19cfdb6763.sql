
-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', false);

-- RLS: users can upload to their own folder
CREATE POLICY "Users can upload own audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: users can view own audio
CREATE POLICY "Users can view own audio"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: users can delete own audio
CREATE POLICY "Users can delete own audio"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add audio_path column to transcriptions
ALTER TABLE public.transcriptions
ADD COLUMN audio_path TEXT;
