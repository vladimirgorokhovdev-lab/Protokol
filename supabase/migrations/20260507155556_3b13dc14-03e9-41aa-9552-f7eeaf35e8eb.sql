CREATE OR REPLACE FUNCTION public.admin_list_teams()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'created_at', t.created_at,
      'owner_id', t.owner_id,
      'owner_email', (SELECT email FROM auth.users WHERE id = t.owner_id),
      'members_count', (SELECT count(*) FROM public.team_members WHERE team_id = t.id),
      'invitations_count', (SELECT count(*) FROM public.team_invitations WHERE team_id = t.id AND accepted_at IS NULL AND expires_at > now()),
      'tier', (SELECT tier::text FROM public.subscriptions WHERE team_id = t.id LIMIT 1),
      'sub_status', (SELECT status::text FROM public.subscriptions WHERE team_id = t.id LIMIT 1),
      'period_end', (SELECT current_period_end FROM public.subscriptions WHERE team_id = t.id LIMIT 1),
      'monthly_seconds', (SELECT monthly_seconds FROM public.team_usage WHERE team_id = t.id LIMIT 1),
      'total_seconds', (SELECT total_seconds FROM public.team_usage WHERE team_id = t.id LIMIT 1)
    ) ORDER BY t.created_at DESC)
    FROM public.teams t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_team_detail(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'team', (SELECT to_jsonb(t) FROM public.teams t WHERE id = p_team_id),
    'owner_email', (SELECT u.email FROM auth.users u JOIN public.teams t ON t.owner_id = u.id WHERE t.id = p_team_id),
    'subscription', (SELECT to_jsonb(s) FROM public.subscriptions s WHERE team_id = p_team_id LIMIT 1),
    'usage', (SELECT to_jsonb(u) FROM public.team_usage u WHERE team_id = p_team_id LIMIT 1),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'role', m.role, 'joined_at', m.joined_at,
        'email', (SELECT email FROM auth.users WHERE id = m.user_id)
      ) ORDER BY m.joined_at)
      FROM public.team_members m WHERE team_id = p_team_id
    ), '[]'::jsonb),
    'invitations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'created_at', i.created_at,
        'expires_at', i.expires_at, 'accepted_at', i.accepted_at
      ) ORDER BY i.created_at DESC)
      FROM public.team_invitations i WHERE team_id = p_team_id
    ), '[]'::jsonb),
    'activity', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC)
      FROM (SELECT * FROM public.team_activity_log WHERE team_id = p_team_id ORDER BY created_at DESC LIMIT 100) a
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;