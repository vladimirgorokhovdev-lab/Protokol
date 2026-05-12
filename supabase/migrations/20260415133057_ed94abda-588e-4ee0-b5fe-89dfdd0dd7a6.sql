
CREATE POLICY "Authenticated users can delete feedback"
ON public.feedback
FOR DELETE
TO authenticated
USING (true);
