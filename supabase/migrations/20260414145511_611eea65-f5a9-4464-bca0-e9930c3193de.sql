
DROP POLICY "Users can view their own feedback" ON public.feedback;

CREATE POLICY "Authenticated users can view all feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (true);
