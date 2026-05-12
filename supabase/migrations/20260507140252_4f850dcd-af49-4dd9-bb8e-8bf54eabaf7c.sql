CREATE OR REPLACE FUNCTION public.prevent_owner_removal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    RAISE EXCEPTION 'Владельца команды нельзя удалить';
  END IF;
  RETURN OLD;
END;
$$;