CREATE OR REPLACE FUNCTION public.admin_metric_details(p_metric text, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_from timestamptz := now() - (p_days || ' days')::interval;
  v_items jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_items := CASE p_metric
    WHEN 'total_users' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'registered_at', u.created_at,
        'tier', COALESCE(s.tier::text, 'free'), 'status', s.status::text
      ) ORDER BY u.created_at DESC), '[]'::jsonb)
      FROM (SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 500) u
      LEFT JOIN public.subscriptions s ON s.user_id = u.id
    )
    WHEN 'new_users' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'registered_at', u.created_at,
        'tier', COALESCE(s.tier::text, 'free')
      ) ORDER BY u.created_at DESC), '[]'::jsonb)
      FROM auth.users u
      LEFT JOIN public.subscriptions s ON s.user_id = u.id
      WHERE u.created_at >= v_from
    )
    WHEN 'active_paid' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'tier', s.tier::text, 'status', s.status::text,
        'auto_renew', s.auto_renew, 'period_end', s.current_period_end
      ) ORDER BY s.current_period_end DESC NULLS LAST), '[]'::jsonb)
      FROM public.subscriptions s
      JOIN auth.users u ON u.id = s.user_id
      WHERE s.tier <> 'free' AND s.status = 'active'
    )
    WHEN 'auto_renew_off' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'tier', s.tier::text, 'period_end', s.current_period_end
      ) ORDER BY s.current_period_end ASC), '[]'::jsonb)
      FROM public.subscriptions s
      JOIN auth.users u ON u.id = s.user_id
      WHERE s.tier <> 'free' AND s.status = 'active' AND s.auto_renew = false
    )
    WHEN 'revenue_period' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'amount', p.amount, 'currency', p.currency,
        'tier', p.tier::text, 'created_at', p.created_at
      ) ORDER BY p.created_at DESC), '[]'::jsonb)
      FROM public.payments p
      JOIN auth.users u ON u.id = p.user_id
      WHERE p.status = 'succeeded' AND p.created_at >= v_from
    )
    WHEN 'transcriptions_period' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'file_name', t.file_name,
        'duration', t.duration, 'created_at', t.created_at
      ) ORDER BY t.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.transcriptions WHERE created_at >= v_from ORDER BY created_at DESC LIMIT 500) t
      JOIN auth.users u ON u.id = t.user_id
    )
    WHEN 'seconds_period' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'file_name', t.file_name,
        'duration', t.duration, 'created_at', t.created_at
      ) ORDER BY t.duration DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.transcriptions WHERE created_at >= v_from ORDER BY duration DESC LIMIT 500) t
      JOIN auth.users u ON u.id = t.user_id
    )
    WHEN 'dau' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'last_login', x.last_login
      ) ORDER BY x.last_login DESC), '[]'::jsonb)
      FROM (
        SELECT user_id, max(created_at) AS last_login
        FROM public.user_events
        WHERE event_type = 'login' AND created_at >= now() - interval '1 day'
        GROUP BY user_id
      ) x
      JOIN auth.users u ON u.id = x.user_id
    )
    WHEN 'mau' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'last_login', x.last_login, 'logins', x.cnt
      ) ORDER BY x.last_login DESC), '[]'::jsonb)
      FROM (
        SELECT user_id, max(created_at) AS last_login, count(*) cnt
        FROM public.user_events
        WHERE event_type = 'login' AND created_at >= now() - interval '30 days'
        GROUP BY user_id
      ) x
      JOIN auth.users u ON u.id = x.user_id
    )
    WHEN 'cancellations_period' THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'email', u.email, 'reason', c.reason, 'comment', c.comment,
        'tier', c.tier::text, 'created_at', c.created_at, 'contact_consent', c.contact_consent
      ) ORDER BY c.created_at DESC), '[]'::jsonb)
      FROM public.subscription_cancellations c
      JOIN auth.users u ON u.id = c.user_id
      WHERE c.created_at >= v_from
    )
    ELSE '[]'::jsonb
  END;

  RETURN jsonb_build_object('metric', p_metric, 'period_days', p_days, 'items', v_items);
END;
$$;