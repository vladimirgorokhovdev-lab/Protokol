
-- Subscription plans enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'basic', 'pro');
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired', 'pending');
CREATE TYPE public.payment_status AS ENUM ('pending', 'succeeded', 'cancelled', 'refunded');

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  yookassa_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service can update subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  status payment_status NOT NULL DEFAULT 'pending',
  tier subscription_tier NOT NULL,
  yookassa_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Usage tracking table
CREATE TABLE public.transcription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  monthly_count INTEGER NOT NULL DEFAULT 0,
  month_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  UNIQUE(user_id)
);

ALTER TABLE public.transcription_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.transcription_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON public.transcription_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON public.transcription_usage
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Function to increment usage after transcription
CREATE OR REPLACE FUNCTION public.increment_transcription_usage(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Function to check if user can transcribe
CREATE OR REPLACE FUNCTION public.can_user_transcribe(p_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier subscription_tier;
  v_status subscription_status;
  v_total_count INTEGER;
  v_monthly_count INTEGER;
  v_month_start DATE;
BEGIN
  -- Get subscription tier
  SELECT tier, status INTO v_tier, v_status
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  -- Default to free if no subscription
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  -- Pro users: unlimited
  IF v_tier = 'pro' AND v_status = 'active' THEN
    RETURN true;
  END IF;

  -- Get usage
  SELECT total_count, monthly_count, month_start INTO v_total_count, v_monthly_count, v_month_start
  FROM public.transcription_usage
  WHERE user_id = p_user_id;

  v_total_count := COALESCE(v_total_count, 0);
  v_monthly_count := COALESCE(v_monthly_count, 0);
  v_month_start := COALESCE(v_month_start, date_trunc('month', now())::date);

  -- Reset monthly count if new month
  IF v_month_start < date_trunc('month', now())::date THEN
    v_monthly_count := 0;
  END IF;

  -- Free: 3 total ever
  IF v_tier = 'free' OR v_status IS NULL OR v_status != 'active' THEN
    RETURN v_total_count < 3;
  END IF;

  -- Basic: 30 per month
  IF v_tier = 'basic' AND v_status = 'active' THEN
    RETURN v_monthly_count < 30;
  END IF;

  RETURN false;
END;
$$;
