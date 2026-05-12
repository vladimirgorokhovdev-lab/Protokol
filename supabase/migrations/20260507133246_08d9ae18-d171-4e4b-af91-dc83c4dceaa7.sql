
CREATE OR REPLACE FUNCTION public.can_user_transcribe(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier subscription_tier;
  v_status subscription_status;
  v_total_count INTEGER;
  v_monthly_count INTEGER;
  v_month_start DATE;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT tier, status INTO v_tier, v_status
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  IF v_tier = 'pro' AND v_status = 'active' THEN
    RETURN true;
  END IF;

  SELECT total_count, monthly_count, month_start INTO v_total_count, v_monthly_count, v_month_start
  FROM public.transcription_usage
  WHERE user_id = p_user_id;

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
