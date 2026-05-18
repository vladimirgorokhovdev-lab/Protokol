-- Idempotent billing: deduct completed job duration from personal or team quota.
ALTER TABLE public.transcription_jobs
  ADD COLUMN IF NOT EXISTS usage_billed_at timestamptz;

CREATE OR REPLACE FUNCTION public.apply_team_usage(p_team_id uuid, p_seconds integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secs bigint := GREATEST(COALESCE(p_seconds, 0), 0);
BEGIN
  INSERT INTO public.team_usage (
    team_id, monthly_count, month_start, total_count, monthly_seconds, total_seconds
  )
  VALUES (p_team_id, 1, date_trunc('month', now())::date, 1, v_secs, v_secs)
  ON CONFLICT (team_id) DO UPDATE SET
    monthly_count = CASE
      WHEN team_usage.month_start = date_trunc('month', now())::date
      THEN team_usage.monthly_count + 1
      ELSE 1
    END,
    monthly_seconds = CASE
      WHEN team_usage.month_start = date_trunc('month', now())::date
      THEN team_usage.monthly_seconds + v_secs
      ELSE v_secs
    END,
    month_start = date_trunc('month', now())::date,
    total_count = team_usage.total_count + 1,
    total_seconds = team_usage.total_seconds + v_secs;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_transcription_usage(
  p_user_id uuid,
  p_seconds integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secs bigint := GREATEST(COALESCE(p_seconds, 0), 0);
BEGIN
  INSERT INTO public.transcription_usage (
    user_id, total_count, monthly_count, month_start, monthly_seconds, total_seconds
  )
  VALUES (p_user_id, 1, 1, date_trunc('month', now())::date, v_secs, v_secs)
  ON CONFLICT (user_id) DO UPDATE SET
    total_count = transcription_usage.total_count + 1,
    monthly_count = CASE
      WHEN transcription_usage.month_start = date_trunc('month', now())::date
      THEN transcription_usage.monthly_count + 1
      ELSE 1
    END,
    monthly_seconds = CASE
      WHEN transcription_usage.month_start = date_trunc('month', now())::date
      THEN transcription_usage.monthly_seconds + v_secs
      ELSE v_secs
    END,
    total_seconds = transcription_usage.total_seconds + v_secs,
    month_start = date_trunc('month', now())::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_team_usage(p_team_id uuid, p_seconds integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier public.subscription_tier;
  v_status public.subscription_status;
BEGIN
  IF NOT public.is_team_member(auth.uid(), p_team_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT tier, status INTO v_tier, v_status
  FROM public.subscriptions
  WHERE team_id = p_team_id;

  IF v_tier IS DISTINCT FROM 'team' OR v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Team subscription is not active';
  END IF;

  PERFORM public.apply_team_usage(p_team_id, p_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_transcription_usage(
  p_user_id uuid,
  p_seconds integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_tier public.subscription_tier;
  v_status public.subscription_status;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_team_id := public.get_user_team_id(p_user_id);
  IF v_team_id IS NOT NULL THEN
    SELECT tier, status INTO v_tier, v_status
    FROM public.subscriptions
    WHERE team_id = v_team_id;
    IF v_tier = 'team' AND v_status = 'active' THEN
      RETURN;
    END IF;
  END IF;

  PERFORM public.apply_transcription_usage(p_user_id, p_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION public.bill_transcription_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.transcription_jobs%ROWTYPE;
  v_seconds integer;
  v_team_id uuid;
  v_tier public.subscription_tier;
  v_status public.subscription_status;
  v_seg_max numeric;
BEGIN
  SELECT * INTO v_job
  FROM public.transcription_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_job.usage_billed_at IS NOT NULL THEN
    RETURN true;
  END IF;

  IF v_job.status IS DISTINCT FROM 'done' THEN
    RETURN false;
  END IF;

  SELECT COALESCE(MAX(
    GREATEST(
      COALESCE((seg->>'endTime')::numeric, 0),
      COALESCE((seg->>'end_time')::numeric, 0)
    )
  ), 0)
  INTO v_seg_max
  FROM jsonb_array_elements(COALESCE(v_job.segments, '[]'::jsonb)) AS seg;

  v_seconds := GREATEST(
    COALESCE(v_job.estimated_seconds, 0),
    COALESCE(v_seg_max, 0)::integer
  );

  UPDATE public.transcription_jobs
  SET usage_billed_at = now()
  WHERE id = p_job_id;

  v_team_id := public.get_user_team_id(v_job.user_id);
  IF v_team_id IS NOT NULL THEN
    SELECT tier, status INTO v_tier, v_status
    FROM public.subscriptions
    WHERE team_id = v_team_id;
    IF v_tier = 'team' AND v_status = 'active' THEN
      PERFORM public.apply_team_usage(v_team_id, v_seconds);
      RETURN true;
    END IF;
  END IF;

  PERFORM public.apply_transcription_usage(v_job.user_id, v_seconds);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.bill_my_transcription_job(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.transcription_jobs
  WHERE id = p_job_id;

  IF v_user_id IS NULL OR v_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN public.bill_transcription_job(p_job_id);
END;
$$;

REVOKE ALL ON FUNCTION public.bill_transcription_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bill_transcription_job(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.bill_my_transcription_job(uuid) TO authenticated;
