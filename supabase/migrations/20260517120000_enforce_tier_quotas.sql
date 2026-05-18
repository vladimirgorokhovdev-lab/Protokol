ALTER TABLE public.transcription_jobs
  ADD COLUMN IF NOT EXISTS estimated_seconds integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.pending_job_seconds_personal(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(GREATEST(estimated_seconds, 0)), 0)::bigint
  FROM public.transcription_jobs
  WHERE user_id = p_user_id
    AND status IN ('queued', 'processing');
$$;

CREATE OR REPLACE FUNCTION public.pending_job_seconds_team(p_team_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(GREATEST(j.estimated_seconds, 0)), 0)::bigint
  FROM public.transcription_jobs j
  INNER JOIN public.team_members tm ON tm.user_id = j.user_id
  WHERE tm.team_id = p_team_id
    AND j.status IN ('queued', 'processing');
$$;

CREATE OR REPLACE FUNCTION public.pending_job_count_personal(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.transcription_jobs
  WHERE user_id = p_user_id
    AND status IN ('queued', 'processing');
$$;

CREATE OR REPLACE FUNCTION public.can_use_ai_summary(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
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
      RETURN true;
    END IF;
  END IF;

  SELECT tier, status INTO v_tier, v_status
  FROM public.subscriptions
  WHERE user_id = p_user_id AND team_id IS NULL;

  RETURN v_tier = 'pro' AND v_status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.can_user_transcribe(
  p_user_id uuid,
  p_estimated_seconds integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_tier public.subscription_tier;
  v_status public.subscription_status;
  v_total_count integer;
  v_monthly_count integer;
  v_monthly_seconds bigint;
  v_month_start date;
  v_pending_seconds bigint;
  v_pending_jobs integer;
  v_est integer;
  -- Limits (seconds): free file 2h, basic 10h/mo, pro 50h/mo, team 100h/mo
  c_free_file_sec constant integer := 7200;
  c_basic_monthly_sec constant bigint := 36000;
  c_pro_monthly_sec constant bigint := 180000;
  c_team_monthly_sec constant bigint := 360000;
  c_basic_monthly_count constant integer := 5;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_est := GREATEST(COALESCE(p_estimated_seconds, 0), 0);

  v_team_id := public.get_user_team_id(p_user_id);
  IF v_team_id IS NOT NULL THEN
    SELECT tier, status INTO v_tier, v_status
    FROM public.subscriptions
    WHERE team_id = v_team_id;

    IF v_tier = 'team' AND v_status = 'active' THEN
      SELECT monthly_seconds, month_start
      INTO v_monthly_seconds, v_month_start
      FROM public.team_usage
      WHERE team_id = v_team_id;

      v_monthly_seconds := COALESCE(v_monthly_seconds, 0);
      IF v_month_start IS NULL OR v_month_start < date_trunc('month', now())::date THEN
        v_monthly_seconds := 0;
      END IF;

      v_pending_seconds := public.pending_job_seconds_team(v_team_id);
      RETURN (v_monthly_seconds + v_pending_seconds + v_est) < c_team_monthly_sec;
    END IF;
  END IF;

  SELECT tier, status INTO v_tier, v_status
  FROM public.subscriptions
  WHERE user_id = p_user_id AND team_id IS NULL;

  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  SELECT total_count, monthly_count, monthly_seconds, month_start
  INTO v_total_count, v_monthly_count, v_monthly_seconds, v_month_start
  FROM public.transcription_usage
  WHERE user_id = p_user_id;

  v_total_count := COALESCE(v_total_count, 0);
  v_monthly_count := COALESCE(v_monthly_count, 0);
  v_monthly_seconds := COALESCE(v_monthly_seconds, 0);
  v_month_start := COALESCE(v_month_start, date_trunc('month', now())::date);

  IF v_month_start < date_trunc('month', now())::date THEN
    v_monthly_count := 0;
    v_monthly_seconds := 0;
  END IF;

  v_pending_seconds := public.pending_job_seconds_personal(p_user_id);
  v_pending_jobs := public.pending_job_count_personal(p_user_id);

  IF v_tier = 'free' OR v_status IS NULL OR v_status <> 'active' THEN
    IF v_est > c_free_file_sec THEN
      RETURN false;
    END IF;
    RETURN (v_total_count + v_pending_jobs) < 1;
  END IF;

  IF v_tier = 'basic' AND v_status = 'active' THEN
    IF (v_monthly_count + v_pending_jobs) >= c_basic_monthly_count THEN
      RETURN false;
    END IF;
    RETURN (v_monthly_seconds + v_pending_seconds + v_est) < c_basic_monthly_sec;
  END IF;

  IF v_tier = 'pro' AND v_status = 'active' THEN
    RETURN (v_monthly_seconds + v_pending_seconds + v_est) < c_pro_monthly_sec;
  END IF;

  RETURN false;
END;
$$;

-- Personal usage: skip when billing goes through active team pool.
CREATE OR REPLACE FUNCTION public.increment_team_usage(p_team_id uuid, p_seconds integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secs bigint := GREATEST(COALESCE(p_seconds, 0), 0);
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
  v_secs bigint := GREATEST(COALESCE(p_seconds, 0), 0);
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
