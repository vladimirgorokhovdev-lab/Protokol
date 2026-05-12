
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, approval_status, approved_at)
  VALUES (NEW.id, 'approved', now())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

UPDATE public.profiles
SET approval_status = 'approved', approved_at = COALESCE(approved_at, now())
WHERE approval_status <> 'approved';
