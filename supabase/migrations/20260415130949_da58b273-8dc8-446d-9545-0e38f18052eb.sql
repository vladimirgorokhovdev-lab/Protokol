
CREATE OR REPLACE FUNCTION public.get_feedback_with_email(p_filter text DEFAULT 'all')
RETURNS TABLE (
  id uuid,
  user_id uuid,
  category text,
  message text,
  page_url text,
  created_at timestamptz,
  user_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.user_id,
    f.category,
    f.message,
    f.page_url,
    f.created_at,
    u.email::text AS user_email
  FROM public.feedback f
  LEFT JOIN auth.users u ON u.id = f.user_id
  WHERE (p_filter = 'all' OR f.category = p_filter)
  ORDER BY f.created_at DESC;
$$;
