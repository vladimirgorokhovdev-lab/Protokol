CREATE OR REPLACE FUNCTION public.prevent_owner_removal()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    RAISE EXCEPTION 'Владельца команды нельзя удалить';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_owner_removal_trg ON public.team_members;
CREATE TRIGGER prevent_owner_removal_trg
BEFORE DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_removal();