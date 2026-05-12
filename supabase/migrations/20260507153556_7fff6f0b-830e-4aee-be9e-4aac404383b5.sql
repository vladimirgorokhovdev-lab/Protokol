
-- 1. Добавить секунды в transcription_usage
ALTER TABLE public.transcription_usage
  ADD COLUMN IF NOT EXISTS monthly_seconds bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_seconds bigint NOT NULL DEFAULT 0;

-- 2. Обновить increment_transcription_usage с поддержкой секунд
CREATE OR REPLACE FUNCTION public.increment_transcription_usage(p_user_id uuid, p_seconds integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secs bigint := GREATEST(COALESCE(p_seconds, 0), 0);
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.transcription_usage (user_id, total_count, monthly_count, month_start, monthly_seconds, total_seconds)
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

-- 3. user_events — журнал ключевых событий
CREATE TABLE IF NOT EXISTS public.user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user ON public.user_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_type_date ON public.user_events(event_type, created_at DESC);

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own events"
  ON public.user_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own events"
  ON public.user_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all events"
  ON public.user_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. subscription_cancellations — причины отмены
CREATE TABLE IF NOT EXISTS public.subscription_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier subscription_tier NOT NULL,
  reason text NOT NULL,
  comment text,
  contact_consent boolean NOT NULL DEFAULT false,
  outreach_email_sent_at timestamptz,
  outreach_called_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancel_user ON public.subscription_cancellations(user_id, created_at DESC);

ALTER TABLE public.subscription_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own cancellation"
  ON public.subscription_cancellations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own cancellation"
  ON public.subscription_cancellations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage cancellations"
  ON public.subscription_cancellations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Триггер на subscriptions для авто-логирования событий
CREATE OR REPLACE FUNCTION public.log_subscription_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_events (user_id, event_type, metadata)
    VALUES (v_user, 'subscription_created',
      jsonb_build_object('tier', NEW.tier, 'status', NEW.status));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.tier IS DISTINCT FROM OLD.tier THEN
      INSERT INTO public.user_events (user_id, event_type, metadata)
      VALUES (v_user, 'subscription_tier_changed',
        jsonb_build_object('from', OLD.tier, 'to', NEW.tier));
    END IF;
    IF NEW.auto_renew IS DISTINCT FROM OLD.auto_renew THEN
      INSERT INTO public.user_events (user_id, event_type, metadata)
      VALUES (v_user,
        CASE WHEN NEW.auto_renew THEN 'auto_renew_enabled' ELSE 'auto_renew_disabled' END,
        jsonb_build_object('tier', NEW.tier));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.user_events (user_id, event_type, metadata)
      VALUES (v_user, 'subscription_status_changed',
        jsonb_build_object('from', OLD.status, 'to', NEW.status, 'tier', NEW.tier));
    END IF;
    IF NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
       AND OLD.current_period_end IS NOT NULL
       AND NEW.current_period_end > OLD.current_period_end THEN
      INSERT INTO public.user_events (user_id, event_type, metadata)
      VALUES (v_user, 'subscription_renewed',
        jsonb_build_object('tier', NEW.tier, 'period_end', NEW.current_period_end));
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_log_change ON public.subscriptions;
CREATE TRIGGER subscriptions_log_change
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.log_subscription_change();

-- Триггер на payments — фиксируем неуспешные платежи
CREATE OR REPLACE FUNCTION public.log_payment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'succeeded' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'succeeded') THEN
    INSERT INTO public.user_events (user_id, event_type, metadata)
    VALUES (NEW.user_id, 'payment_succeeded',
      jsonb_build_object('tier', NEW.tier, 'amount', NEW.amount, 'currency', NEW.currency));
  ELSIF NEW.status = 'failed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'failed') THEN
    INSERT INTO public.user_events (user_id, event_type, metadata)
    VALUES (NEW.user_id, 'payment_failed',
      jsonb_build_object('tier', NEW.tier, 'amount', NEW.amount));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_log_event ON public.payments;
CREATE TRIGGER payments_log_event
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_event();

-- 6. Админ-функции аналитики
CREATE OR REPLACE FUNCTION public.admin_analytics_overview(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_from timestamptz := now() - (p_days || ' days')::interval;
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'period_days', p_days,
    'total_users', (SELECT count(*) FROM auth.users),
    'new_users', (SELECT count(*) FROM auth.users WHERE created_at >= v_from),
    'active_paid', (SELECT count(*) FROM public.subscriptions WHERE tier <> 'free' AND status = 'active'),
    'auto_renew_off', (SELECT count(*) FROM public.subscriptions WHERE tier <> 'free' AND status = 'active' AND auto_renew = false),
    'transcriptions_period', (SELECT count(*) FROM public.transcriptions WHERE created_at >= v_from),
    'seconds_period', (SELECT COALESCE(SUM(duration)::bigint, 0) FROM public.transcriptions WHERE created_at >= v_from),
    'logins_period', (SELECT count(*) FROM public.user_events WHERE event_type = 'login' AND created_at >= v_from),
    'dau', (SELECT count(DISTINCT user_id) FROM public.user_events WHERE event_type = 'login' AND created_at >= now() - interval '1 day'),
    'mau', (SELECT count(DISTINCT user_id) FROM public.user_events WHERE event_type = 'login' AND created_at >= now() - interval '30 days'),
    'cancellations_period', (SELECT count(*) FROM public.subscription_cancellations WHERE created_at >= v_from),
    'revenue_period', (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'succeeded' AND created_at >= v_from),
    'by_tier', (
      SELECT jsonb_object_agg(tier::text, cnt)
      FROM (SELECT tier, count(*) cnt FROM public.subscriptions GROUP BY tier) t
    ),
    'signups_by_day', (
      SELECT jsonb_agg(jsonb_build_object('date', d, 'count', c) ORDER BY d)
      FROM (
        SELECT date_trunc('day', created_at)::date d, count(*) c
        FROM auth.users
        WHERE created_at >= v_from
        GROUP BY 1
      ) s
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Карточка пользователя
CREATE OR REPLACE FUNCTION public.admin_user_card(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_created timestamptz;
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id, email, created_at INTO v_user_id, v_email, v_created
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'found', true,
    'user_id', v_user_id,
    'email', v_email,
    'registered_at', v_created,
    'subscription', (SELECT to_jsonb(s) FROM public.subscriptions s WHERE s.user_id = v_user_id LIMIT 1),
    'usage', (SELECT to_jsonb(u) FROM public.transcription_usage u WHERE u.user_id = v_user_id LIMIT 1),
    'transcriptions_count', (SELECT count(*) FROM public.transcriptions WHERE user_id = v_user_id),
    'last_transcription_at', (SELECT max(created_at) FROM public.transcriptions WHERE user_id = v_user_id),
    'payments', (
      SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC), '[]'::jsonb)
      FROM public.payments p WHERE p.user_id = v_user_id
    ),
    'cancellations', (
      SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC), '[]'::jsonb)
      FROM public.subscription_cancellations c WHERE c.user_id = v_user_id
    ),
    'recent_events', (
      SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM public.user_events
        WHERE user_id = v_user_id ORDER BY created_at DESC LIMIT 50
      ) e
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Сегменты для рассылок
CREATE OR REPLACE FUNCTION public.admin_segment_users(p_segment text)
RETURNS TABLE(user_id uuid, email text, registered_at timestamptz, tier text, monthly_count integer, total_count integer, total_seconds bigint, period_end timestamptz, last_event_at timestamptz, context jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      u.id AS uid,
      u.email::text AS em,
      u.created_at AS reg,
      COALESCE(s.tier::text, 'free') AS t,
      s.status::text AS st,
      s.auto_renew AS ar,
      s.current_period_end AS pe,
      tu.monthly_count AS mc,
      tu.total_count AS tc,
      tu.total_seconds AS ts,
      (SELECT max(created_at) FROM public.user_events WHERE public.user_events.user_id = u.id) AS le,
      (SELECT to_jsonb(c) FROM public.subscription_cancellations c WHERE c.user_id = u.id ORDER BY c.created_at DESC LIMIT 1) AS last_cancel
    FROM auth.users u
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    LEFT JOIN public.transcription_usage tu ON tu.user_id = u.id
  )
  SELECT b.uid, b.em, b.reg, b.t, b.mc, b.tc, b.ts, b.pe, b.le,
    jsonb_build_object('cancellation', b.last_cancel, 'auto_renew', b.ar, 'status', b.st)
  FROM base b
  WHERE
    CASE p_segment
      WHEN 'free_exhausted' THEN b.t = 'free' AND COALESCE(b.tc, 0) >= 1 AND b.reg < now() - interval '1 day'
      WHEN 'auto_renew_off' THEN b.t <> 'free' AND b.st = 'active' AND b.ar = false
      WHEN 'expired_not_renewed' THEN b.t <> 'free' AND b.pe IS NOT NULL AND b.pe < now() AND b.st <> 'active'
      WHEN 'heavy_users' THEN COALESCE(b.ts, 0) >= 36000
      WHEN 'inactive_paid' THEN b.t <> 'free' AND b.st = 'active' AND (b.le IS NULL OR b.le < now() - interval '14 days')
      WHEN 'all_active' THEN true
      ELSE false
    END
  ORDER BY b.reg DESC
  LIMIT 500;
END;
$$;
