ALTER TABLE public.profiles
  ALTER COLUMN approval_status SET DEFAULT 'approved'::approval_status;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, approval_status, approved_at)
  VALUES (NEW.id, 'approved', now())
  ON CONFLICT (user_id) DO UPDATE
    SET approval_status = 'approved',
        approved_at = COALESCE(public.profiles.approved_at, now()),
        rejected_reason = NULL;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_approval_status()
RETURNS approval_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 'approved'::approval_status;
$function$;

CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT true;
$function$;