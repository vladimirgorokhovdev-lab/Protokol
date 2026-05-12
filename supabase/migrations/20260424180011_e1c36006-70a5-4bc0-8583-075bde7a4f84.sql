
-- 1. Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Approval status enum + column on profiles
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE public.profiles
  ADD COLUMN approval_status approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN approved_by uuid,
  ADD COLUMN rejected_reason text;

-- Approve all existing users so they don't get locked out
UPDATE public.profiles SET approval_status = 'approved', approved_at = now();

-- 3. Security-definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND approval_status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- 4. RLS for user_roles: users can see own roles, admins can see all
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Admin can view all profiles (for the approvals page)
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Update handle_new_user to set pending status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, approval_status)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Make sure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Admin RPCs
CREATE OR REPLACE FUNCTION public.approve_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.profiles
     SET approval_status = 'approved',
         approved_at = now(),
         approved_by = auth.uid(),
         rejected_reason = NULL
   WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_user(_user_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.profiles
     SET approval_status = 'rejected',
         approved_by = auth.uid(),
         rejected_reason = _reason
   WHERE user_id = _user_id;
END;
$$;

-- 8. Admin view of approval requests with email
CREATE OR REPLACE FUNCTION public.list_approval_requests(_filter text DEFAULT 'pending')
RETURNS TABLE (
  user_id uuid,
  email text,
  approval_status approval_status,
  created_at timestamptz,
  approved_at timestamptz,
  rejected_reason text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, u.email::text, p.approval_status, p.created_at, p.approved_at, p.rejected_reason
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE public.has_role(auth.uid(), 'admin')
    AND (_filter = 'all' OR p.approval_status::text = _filter)
  ORDER BY p.created_at DESC;
$$;

-- 9. RPC for current user to check own status
CREATE OR REPLACE FUNCTION public.get_my_approval_status()
RETURNS approval_status
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin') THEN 'approved'::approval_status
    ELSE COALESCE((SELECT approval_status FROM public.profiles WHERE user_id = auth.uid()), 'pending'::approval_status)
  END;
$$;

-- 10. Make demasiado126621@gmail.com an admin (if registered) and approve them
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'demasiado126621@gmail.com'
ON CONFLICT DO NOTHING;

UPDATE public.profiles
   SET approval_status = 'approved', approved_at = now()
 WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'demasiado126621@gmail.com');
