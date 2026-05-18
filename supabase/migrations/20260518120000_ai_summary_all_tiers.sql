-- AI summary (краткое резюме) for all authenticated tiers.
CREATE OR REPLACE FUNCTION public.can_use_ai_summary(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN auth.uid() IS NOT NULL;
END;
$$;
