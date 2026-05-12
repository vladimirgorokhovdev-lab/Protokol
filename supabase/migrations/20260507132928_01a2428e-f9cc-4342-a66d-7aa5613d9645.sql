
-- Blocked disposable email domains
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  domain text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blocked domains"
  ON public.blocked_email_domains FOR SELECT
  USING (true);

CREATE POLICY "Admins manage blocked domains"
  ON public.blocked_email_domains FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.blocked_email_domains (domain) VALUES
  ('mailinator.com'), ('tempmail.com'), ('temp-mail.org'), ('temp-mail.io'),
  ('10minutemail.com'), ('10minutemail.net'), ('guerrillamail.com'), ('guerrillamail.info'),
  ('guerrillamail.biz'), ('guerrillamail.de'), ('guerrillamail.net'), ('guerrillamail.org'),
  ('sharklasers.com'), ('grr.la'), ('yopmail.com'), ('yopmail.net'), ('yopmail.fr'),
  ('throwawaymail.com'), ('maildrop.cc'), ('getnada.com'), ('nada.email'),
  ('dispostable.com'), ('mailnesia.com'), ('mintemail.com'), ('mohmal.com'),
  ('trashmail.com'), ('trashmail.de'), ('trashmail.net'), ('trbvm.com'),
  ('fakeinbox.com'), ('fakemailgenerator.com'), ('emailondeck.com'),
  ('inboxbear.com'), ('mailcatch.com'), ('moakt.com'), ('tempinbox.com'),
  ('temporarymail.com'), ('tmail.io'), ('tmail.ws'), ('tmpmail.org'), ('tmpeml.com'),
  ('inboxkitten.com'), ('luxusmail.org'), ('mvrht.net'), ('emailtemp.org'),
  ('disposablemail.com'), ('mailtothis.com'), ('mailpoof.com'), ('spambox.us'),
  ('mailhole.de'), ('mail-temporaire.fr'), ('email-temp.com'), ('mintmail.email')
ON CONFLICT (domain) DO NOTHING;

-- Email normalization (Gmail dot/plus aliasing)
CREATE OR REPLACE FUNCTION public.normalize_email(_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_local text;
  v_domain text;
BEGIN
  IF _email IS NULL THEN RETURN NULL; END IF;
  v_email := lower(trim(_email));
  v_local := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);
  IF v_domain IN ('gmail.com', 'googlemail.com') THEN
    v_local := replace(v_local, '.', '');
    v_local := split_part(v_local, '+', 1);
    v_domain := 'gmail.com';
  ELSE
    v_local := split_part(v_local, '+', 1);
  END IF;
  RETURN v_local || '@' || v_domain;
END;
$$;

-- Updated signup handler: block disposable + dedupe normalized emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(NEW.email);
  v_domain text := split_part(v_email, '@', 2);
  v_norm text := public.normalize_email(NEW.email);
BEGIN
  IF v_domain <> '' AND EXISTS (
    SELECT 1 FROM public.blocked_email_domains WHERE domain = v_domain
  ) THEN
    RAISE EXCEPTION 'Регистрация с одноразовых email-адресов запрещена. Используйте постоянный email.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id <> NEW.id
      AND u.email IS NOT NULL
      AND public.normalize_email(u.email) = v_norm
  ) THEN
    RAISE EXCEPTION 'Аккаунт с этим email уже существует. Войдите в существующий аккаунт.'
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.profiles (user_id, approval_status, approved_at)
  VALUES (NEW.id, 'approved', now())
  ON CONFLICT (user_id) DO UPDATE
    SET approval_status = 'approved',
        approved_at = COALESCE(public.profiles.approved_at, now()),
        rejected_reason = NULL;
  RETURN NEW;
END;
$$;

-- Reduce free tier limit: 3 -> 1
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
    RETURN v_monthly_count < 10;
  END IF;

  RETURN false;
END;
$$;
