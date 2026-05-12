
CREATE TABLE public.replacement_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  find_text TEXT NOT NULL,
  replace_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.replacement_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rules" ON public.replacement_rules
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own rules" ON public.replacement_rules
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rules" ON public.replacement_rules
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rules" ON public.replacement_rules
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
