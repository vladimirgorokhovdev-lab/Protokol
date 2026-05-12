-- 1. Лог действий
CREATE TABLE IF NOT EXISTS public.team_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_activity_team ON public.team_activity_log(team_id, created_at DESC);

ALTER TABLE public.team_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view activity" ON public.team_activity_log;
CREATE POLICY "Members can view activity"
ON public.team_activity_log FOR SELECT
TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

-- INSERT происходит только из триггеров (SECURITY DEFINER); нет политики на INSERT для пользователей

-- 2. Хелпер: получить email текущего пользователя
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- 3. Триггер: переименование команды
CREATE OR REPLACE FUNCTION public.log_team_rename()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO public.team_activity_log (team_id, actor_id, actor_email, action, description, metadata)
    VALUES (
      NEW.id,
      auth.uid(),
      public.current_user_email(),
      'team_renamed',
      format('Команда переименована: «%s» → «%s»', OLD.name, NEW.name),
      jsonb_build_object('old_name', OLD.name, 'new_name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_team_rename_trg ON public.teams;
CREATE TRIGGER log_team_rename_trg
AFTER UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.log_team_rename();

-- 4. Триггер: создание приглашения
CREATE OR REPLACE FUNCTION public.log_invitation_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_activity_log (team_id, actor_id, actor_email, action, description, metadata)
  VALUES (
    NEW.team_id,
    auth.uid(),
    public.current_user_email(),
    'invitation_created',
    format('Создано приглашение для %s', NEW.email),
    jsonb_build_object('invited_email', NEW.email)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_invitation_created_trg ON public.team_invitations;
CREATE TRIGGER log_invitation_created_trg
AFTER INSERT ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.log_invitation_created();

-- 5. Триггер: отзыв приглашения (DELETE без accepted_at)
CREATE OR REPLACE FUNCTION public.log_invitation_revoked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.accepted_at IS NULL THEN
    INSERT INTO public.team_activity_log (team_id, actor_id, actor_email, action, description, metadata)
    VALUES (
      OLD.team_id,
      auth.uid(),
      public.current_user_email(),
      'invitation_revoked',
      format('Отозвано приглашение для %s', OLD.email),
      jsonb_build_object('invited_email', OLD.email)
    );
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS log_invitation_revoked_trg ON public.team_invitations;
CREATE TRIGGER log_invitation_revoked_trg
AFTER DELETE ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.log_invitation_revoked();

-- 6. Триггер: добавление участника (включая owner при создании команды и member при принятии)
CREATE OR REPLACE FUNCTION public.log_member_joined()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  INSERT INTO public.team_activity_log (team_id, actor_id, actor_email, action, description, metadata)
  VALUES (
    NEW.team_id,
    NEW.user_id,
    v_email,
    CASE WHEN NEW.role = 'owner' THEN 'team_created' ELSE 'member_joined' END,
    CASE WHEN NEW.role = 'owner'
         THEN format('Команда создана владельцем %s', COALESCE(v_email, NEW.user_id::text))
         ELSE format('%s присоединился к команде', COALESCE(v_email, NEW.user_id::text))
    END,
    jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_member_joined_trg ON public.team_members;
CREATE TRIGGER log_member_joined_trg
AFTER INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.log_member_joined();

-- 7. Триггер: удаление участника / выход
CREATE OR REPLACE FUNCTION public.log_member_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target_email text;
  v_actor_id uuid := auth.uid();
  v_actor_email text := public.current_user_email();
  v_self boolean;
BEGIN
  SELECT email INTO v_target_email FROM auth.users WHERE id = OLD.user_id;
  v_self := (v_actor_id = OLD.user_id);

  INSERT INTO public.team_activity_log (team_id, actor_id, actor_email, action, description, metadata)
  VALUES (
    OLD.team_id,
    v_actor_id,
    v_actor_email,
    CASE WHEN v_self THEN 'member_left' ELSE 'member_removed' END,
    CASE WHEN v_self
         THEN format('%s покинул команду', COALESCE(v_target_email, OLD.user_id::text))
         ELSE format('Участник %s удалён из команды', COALESCE(v_target_email, OLD.user_id::text))
    END,
    jsonb_build_object('target_user_id', OLD.user_id, 'target_email', v_target_email)
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS log_member_removed_trg ON public.team_members;
CREATE TRIGGER log_member_removed_trg
AFTER DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.log_member_removed();