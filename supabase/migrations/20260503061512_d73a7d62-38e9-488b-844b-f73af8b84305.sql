
-- 1. Feedback: drop overly broad policies, add admin-scoped + own-feedback
DROP POLICY IF EXISTS "Authenticated users can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Authenticated users can delete feedback" ON public.feedback;

CREATE POLICY "Admins view all feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins delete feedback" ON public.feedback
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Admin guard on get_feedback_with_email
CREATE OR REPLACE FUNCTION public.get_feedback_with_email(p_filter text DEFAULT 'all')
RETURNS TABLE (
  id uuid,
  user_id uuid,
  category text,
  message text,
  page_url text,
  created_at timestamptz,
  user_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.user_id,
    f.category,
    f.message,
    f.page_url,
    f.created_at,
    u.email::text AS user_email
  FROM public.feedback f
  LEFT JOIN auth.users u ON u.id = f.user_id
  WHERE (p_filter = 'all' OR f.category = p_filter)
  ORDER BY f.created_at DESC;
END;
$$;

-- 3. Admin guard on get_auth_user_count
CREATE OR REPLACE FUNCTION public.get_auth_user_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN (SELECT count(*)::integer FROM auth.users);
END;
$$;

-- 4. Owner check on increment_transcription_usage
CREATE OR REPLACE FUNCTION public.increment_transcription_usage(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.transcription_usage (user_id, total_count, monthly_count, month_start)
  VALUES (p_user_id, 1, 1, date_trunc('month', now())::date)
  ON CONFLICT (user_id) DO UPDATE SET
    total_count = transcription_usage.total_count + 1,
    monthly_count = CASE
      WHEN transcription_usage.month_start = date_trunc('month', now())::date
      THEN transcription_usage.monthly_count + 1
      ELSE 1
    END,
    month_start = date_trunc('month', now())::date;
END;
$$;

-- 5. Restrict transcriptions/segments policies to authenticated role
DROP POLICY IF EXISTS "Users can view own transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Users can create own transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Users can delete own transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Users can update own transcriptions" ON public.transcriptions;

CREATE POLICY "Users can view own transcriptions" ON public.transcriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transcriptions" ON public.transcriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transcriptions" ON public.transcriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own transcriptions" ON public.transcriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own segments" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can create own segments" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can delete own segments" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can update own segments" ON public.transcription_segments;

CREATE POLICY "Users can view own segments" ON public.transcription_segments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transcriptions t WHERE t.id = transcription_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can create own segments" ON public.transcription_segments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.transcriptions t WHERE t.id = transcription_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can delete own segments" ON public.transcription_segments
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transcriptions t WHERE t.id = transcription_id AND t.user_id = auth.uid()));
CREATE POLICY "Users can update own segments" ON public.transcription_segments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transcriptions t WHERE t.id = transcription_id AND t.user_id = auth.uid()));

-- 6. Add UPDATE policy on audio-files storage bucket
CREATE POLICY "Users can update own audio"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'audio-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'audio-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
