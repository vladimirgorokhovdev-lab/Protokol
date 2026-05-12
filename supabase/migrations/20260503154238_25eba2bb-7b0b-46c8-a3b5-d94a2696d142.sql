
-- 1. STORAGE: Remove any public-role policies, ensure all audio-files policies are authenticated only
DROP POLICY IF EXISTS "Users can view own audio" ON storage.objects;

-- 2. PROFILES: Prevent self-approval privilege escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND approval_status = (SELECT approval_status FROM public.profiles WHERE user_id = auth.uid())
  AND approved_by IS NOT DISTINCT FROM (SELECT approved_by FROM public.profiles WHERE user_id = auth.uid())
  AND approved_at IS NOT DISTINCT FROM (SELECT approved_at FROM public.profiles WHERE user_id = auth.uid())
  AND rejected_reason IS NOT DISTINCT FROM (SELECT rejected_reason FROM public.profiles WHERE user_id = auth.uid())
);

-- Admins can update any profile (for approval workflow)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. SUBSCRIPTIONS: Prevent users from upgrading their own tier without payment
DROP POLICY IF EXISTS "Service can update subscriptions" ON public.subscriptions;

-- Users may only update auto_renew on their own subscription
CREATE POLICY "Users can update own auto_renew"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND tier = (SELECT tier FROM public.subscriptions WHERE user_id = auth.uid())
  AND status = (SELECT status FROM public.subscriptions WHERE user_id = auth.uid())
  AND current_period_start IS NOT DISTINCT FROM (SELECT current_period_start FROM public.subscriptions WHERE user_id = auth.uid())
  AND current_period_end IS NOT DISTINCT FROM (SELECT current_period_end FROM public.subscriptions WHERE user_id = auth.uid())
  AND yookassa_subscription_id IS NOT DISTINCT FROM (SELECT yookassa_subscription_id FROM public.subscriptions WHERE user_id = auth.uid())
  AND payment_method_id IS NOT DISTINCT FROM (SELECT payment_method_id FROM public.subscriptions WHERE user_id = auth.uid())
);

-- 4. FEEDBACK: allow users to delete their own feedback
CREATE POLICY "Users can delete own feedback"
ON public.feedback
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 5. REALTIME: Remove sensitive tables from realtime publication (payments, subscriptions, feedback)
-- Keep transcription_jobs which is needed for app UX
ALTER PUBLICATION supabase_realtime DROP TABLE public.payments;
ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.feedback;

-- Add topic-scoped policy on realtime.messages so authenticated users can only
-- subscribe to channels prefixed with their own user id
CREATE POLICY "Users can subscribe to their own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE (auth.uid()::text || ':%'))
  OR (realtime.topic() LIKE ('user:' || auth.uid()::text || '%'))
  OR (realtime.topic() = ('transcription_jobs:' || auth.uid()::text))
);
