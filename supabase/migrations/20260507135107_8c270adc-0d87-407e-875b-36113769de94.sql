-- Add seconds tracking to team_usage
ALTER TABLE public.team_usage
  ADD COLUMN IF NOT EXISTS monthly_seconds bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_seconds bigint NOT NULL DEFAULT 0;

-- Updated increment: accepts duration in seconds
CREATE OR REPLACE FUNCTION public.increment_team_usage(p_team_id uuid, p_seconds integer DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_secs bigint := GREATEST(COALESCE(p_seconds, 0), 0);
BEGIN
  IF NOT public.is_team_member(auth.uid(), p_team_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.team_usage (team_id, monthly_count, month_start, total_count, monthly_seconds, total_seconds)
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

-- Updated can_user_transcribe: team uses 100 hours pool
CREATE OR REPLACE FUNCTION public.can_user_transcribe(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_id uuid;
  v_tier subscription_tier;
  v_status subscription_status;
  v_total_count INTEGER;
  v_monthly_count INTEGER;
  v_monthly_seconds bigint;
  v_month_start DATE;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_team_id := public.get_user_team_id(p_user_id);
  IF v_team_id IS NOT NULL THEN
    SELECT tier, status INTO v_tier, v_status
    FROM public.subscriptions WHERE team_id = v_team_id;

    IF v_tier = 'team' AND v_status = 'active' THEN
      SELECT monthly_seconds, month_start INTO v_monthly_seconds, v_month_start
        FROM public.team_usage WHERE team_id = v_team_id;
      v_monthly_seconds := COALESCE(v_monthly_seconds, 0);
      IF v_month_start IS NULL OR v_month_start < date_trunc('month', now())::date THEN
        v_monthly_seconds := 0;
      END IF;
      -- 100 hours = 360000 seconds
      RETURN v_monthly_seconds < 360000;
    END IF;
  END IF;

  -- Личная подписка
  SELECT tier, status INTO v_tier, v_status
  FROM public.subscriptions WHERE user_id = p_user_id AND team_id IS NULL;

  IF v_tier IS NULL THEN v_tier := 'free'; END IF;

  IF v_tier = 'pro' AND v_status = 'active' THEN RETURN true; END IF;

  SELECT total_count, monthly_count, month_start INTO v_total_count, v_monthly_count, v_month_start
  FROM public.transcription_usage WHERE user_id = p_user_id;

  v_total_count := COALESCE(v_total_count, 0);
  v_monthly_count := COALESCE(v_monthly_count, 0);
  v_month_start := COALESCE(v_month_start, date_trunc('month', now())::date);

  IF v_month_start < date_trunc('month', now())::date THEN
    v_monthly_count := 0;
  END IF;

  IF v_tier = 'free' OR v_status IS NULL OR v_status != 'active' THEN
    RETURN v_total_count < 1;
  END IF;

  IF v_tier = 'basic' AND v_status = 'active' THEN
    RETURN v_monthly_count < 5;
  END IF;

  RETURN false;
END;
$$;