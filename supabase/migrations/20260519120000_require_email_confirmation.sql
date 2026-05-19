-- Block transcription until auth.users email is confirmed (OAuth included via confirmed_at).
CREATE OR REPLACE FUNCTION public.is_auth_email_confirmed(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_user_id
      AND (
        u.email_confirmed_at IS NOT NULL
        OR u.confirmed_at IS NOT NULL
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_user_transcribe(
  p_user_id uuid,
  p_estimated_seconds integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
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
  c_free_file_sec constant integer := 7200;
  c_basic_monthly_sec constant bigint := 36000;
  c_pro_monthly_sec constant bigint := 180000;
  c_team_monthly_sec constant bigint := 360000;
  c_basic_monthly_count constant integer := 5;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT public.is_auth_email_confirmed(p_user_id) THEN
    RETURN false;
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

GRANT EXECUTE ON FUNCTION public.is_auth_email_confirmed(uuid) TO authenticated;
