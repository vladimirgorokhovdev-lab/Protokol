
-- 1. Добавить значение team в enum
ALTER TYPE public.subscription_tier ADD VALUE IF NOT EXISTS 'team';

-- 2. Таблица команд
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Моя команда',
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Участники
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);

-- 4. Приглашения
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_normalized text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON public.team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations(email_normalized);

-- 5. Команда у подписки
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- 6. Команда у контента
ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transcriptions_team ON public.transcriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_folders_team ON public.folders(team_id);
CREATE INDEX IF NOT EXISTS idx_tags_team ON public.tags(team_id);

-- 7. Учёт квоты
CREATE TABLE IF NOT EXISTS public.team_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  monthly_count integer NOT NULL DEFAULT 0,
  month_start date NOT NULL DEFAULT (date_trunc('month', now()))::date,
  total_count integer NOT NULL DEFAULT 0
);

-- ===== Enable RLS =====
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_usage ENABLE ROW LEVEL SECURITY;

-- ===== Helper functions =====
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id);
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner');
$$;

-- ===== RLS: teams =====
CREATE POLICY "Members can view their team" ON public.teams FOR SELECT
  USING (public.is_team_member(auth.uid(), id));
CREATE POLICY "Owner can update team" ON public.teams FOR UPDATE
  USING (public.is_team_owner(auth.uid(), id))
  WITH CHECK (public.is_team_owner(auth.uid(), id));
CREATE POLICY "Owner can delete team" ON public.teams FOR DELETE
  USING (public.is_team_owner(auth.uid(), id));
-- INSERT happens via webhook (service role) — no policy needed for users

-- ===== RLS: team_members =====
CREATE POLICY "Members can view team roster" ON public.team_members FOR SELECT
  USING (public.is_team_member(auth.uid(), team_id));
CREATE POLICY "Owner can add members" ON public.team_members FOR INSERT
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));
CREATE POLICY "Owner or self can remove" ON public.team_members FOR DELETE
  USING (public.is_team_owner(auth.uid(), team_id) OR user_id = auth.uid());

-- ===== RLS: team_invitations =====
CREATE POLICY "Owner manages invitations" ON public.team_invitations FOR ALL
  USING (public.is_team_owner(auth.uid(), team_id))
  WITH CHECK (public.is_team_owner(auth.uid(), team_id));

-- ===== RLS: team_usage =====
CREATE POLICY "Members can view team usage" ON public.team_usage FOR SELECT
  USING (public.is_team_member(auth.uid(), team_id));

-- ===== Update content RLS to allow team access =====
DROP POLICY IF EXISTS "Users can view own transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Users can update own transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Users can delete own transcriptions" ON public.transcriptions;
DROP POLICY IF EXISTS "Users can create own transcriptions" ON public.transcriptions;

CREATE POLICY "View own or team transcriptions" ON public.transcriptions FOR SELECT
  USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "Insert own or team transcriptions" ON public.transcriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "Update own or team transcriptions" ON public.transcriptions FOR UPDATE
  USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "Delete own or team transcriptions" ON public.transcriptions FOR DELETE
  USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_owner(auth.uid(), team_id)));

DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

CREATE POLICY "View own or team folders" ON public.folders FOR SELECT
  USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "Insert own or team folders" ON public.folders FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "Update own or team folders" ON public.folders FOR UPDATE
  USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "Delete own or team folders" ON public.folders FOR DELETE
  USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_owner(auth.uid(), team_id)));

DROP POLICY IF EXISTS "Users can view own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can create own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags;

CREATE POLICY "View own or team tags" ON public.tags FOR SELECT
  USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "Insert own or team tags" ON public.tags FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "Update own or team tags" ON public.tags FOR UPDATE
  USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)));
CREATE POLICY "Delete own or team tags" ON public.tags FOR DELETE
  USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_owner(auth.uid(), team_id)));

-- ===== Updated_at trigger for teams =====
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Accept invitation (security definer) =====
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv RECORD;
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_member_count int;
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

  -- Optional email match (нормализованный)
  IF v_user_email IS NOT NULL AND public.normalize_email(v_user_email) <> v_inv.email_normalized THEN
    RAISE EXCEPTION 'Это приглашение отправлено на другой email';
  END IF;

  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Вы уже состоите в команде. Выйдите из текущей команды, чтобы принять новое приглашение.';
  END IF;

  SELECT COUNT(*) INTO v_member_count FROM public.team_members WHERE team_id = v_inv.team_id;
  IF v_member_count >= 5 THEN
    RAISE EXCEPTION 'В команде достигнут лимит 5 участников';
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_inv.team_id, v_user_id, 'member');

  UPDATE public.team_invitations
     SET accepted_at = now(), accepted_by = v_user_id
   WHERE id = v_inv.id;

  RETURN v_inv.team_id;
END;
$$;

-- ===== Team usage increment =====
CREATE OR REPLACE FUNCTION public.increment_team_usage(p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_team_member(auth.uid(), p_team_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.team_usage (team_id, monthly_count, month_start, total_count)
  VALUES (p_team_id, 1, date_trunc('month', now())::date, 1)
  ON CONFLICT (team_id) DO UPDATE SET
    monthly_count = CASE
      WHEN team_usage.month_start = date_trunc('month', now())::date
      THEN team_usage.monthly_count + 1
      ELSE 1
    END,
    month_start = date_trunc('month', now())::date,
    total_count = team_usage.total_count + 1;
END;
$$;

-- ===== Updated can_user_transcribe with team support =====
CREATE OR REPLACE FUNCTION public.can_user_transcribe(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_id uuid;
  v_tier subscription_tier;
  v_status subscription_status;
  v_total_count INTEGER;
  v_monthly_count INTEGER;
  v_month_start DATE;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Если пользователь в команде — проверяем командную подписку
  v_team_id := public.get_user_team_id(p_user_id);
  IF v_team_id IS NOT NULL THEN
    SELECT tier, status INTO v_tier, v_status
    FROM public.subscriptions WHERE team_id = v_team_id;

    IF v_tier = 'team' AND v_status = 'active' THEN
      SELECT monthly_count, month_start INTO v_monthly_count, v_month_start
        FROM public.team_usage WHERE team_id = v_team_id;
      v_monthly_count := COALESCE(v_monthly_count, 0);
      IF v_month_start IS NULL OR v_month_start < date_trunc('month', now())::date THEN
        v_monthly_count := 0;
      END IF;
      RETURN v_monthly_count < 100;
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
