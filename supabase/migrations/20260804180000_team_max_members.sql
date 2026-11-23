-- Per-team member cap (B2C Team = 5, court/B2B can be raised e.g. to 30)
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS max_members integer NOT NULL DEFAULT 5
  CHECK (max_members >= 1 AND max_members <= 100);

COMMENT ON COLUMN public.teams.max_members IS
  'Max seats including owner. Default 5 (B2C Team); court packages use 30.';

CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_inv public.team_invitations%ROWTYPE;
  v_member_count integer;
  v_max_members integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Требуется авторизация';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_inv FROM public.team_invitations
   WHERE token = _token AND accepted_at IS NULL AND expires_at > now()
   FOR UPDATE;

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Приглашение не найдено или истекло';
  END IF;

  IF v_user_email IS NOT NULL AND public.normalize_email(v_user_email) <> v_inv.email_normalized THEN
    RAISE EXCEPTION 'Это приглашение отправлено на другой email';
  END IF;

  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Вы уже состоите в команде. Выйдите из текущей команды, чтобы принять новое приглашение.';
  END IF;

  SELECT max_members INTO v_max_members
  FROM public.teams
  WHERE id = v_inv.team_id;

  IF v_max_members IS NULL THEN
    v_max_members := 5;
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM public.team_members
  WHERE team_id = v_inv.team_id;

  IF v_member_count >= v_max_members THEN
    RAISE EXCEPTION 'В команде достигнут лимит % участников', v_max_members;
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_inv.team_id, v_user_id, 'member');

  UPDATE public.team_invitations
     SET accepted_at = now(), accepted_by = v_user_id
   WHERE id = v_inv.id;

  RETURN v_inv.team_id;
END;
$$;
