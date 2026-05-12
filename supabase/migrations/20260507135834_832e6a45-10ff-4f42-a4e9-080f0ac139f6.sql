CREATE OR REPLACE FUNCTION public.prevent_duplicate_team_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_user_id uuid;
BEGIN
  -- Активное приглашение уже существует в этой команде
  IF EXISTS (
    SELECT 1 FROM public.team_invitations
    WHERE team_id = NEW.team_id
      AND email_normalized = NEW.email_normalized
      AND accepted_at IS NULL
      AND expires_at > now()
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Активное приглашение для этого email уже существует';
  END IF;

  -- Пользователь с этим email уже в команде
  SELECT u.id INTO v_existing_user_id
  FROM auth.users u
  WHERE public.normalize_email(u.email) = NEW.email_normalized
  LIMIT 1;

  IF v_existing_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = NEW.team_id AND user_id = v_existing_user_id
  ) THEN
    RAISE EXCEPTION 'Этот пользователь уже состоит в команде';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_team_invitation_trg ON public.team_invitations;
CREATE TRIGGER prevent_duplicate_team_invitation_trg
BEFORE INSERT ON public.team_invitations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_team_invitation();