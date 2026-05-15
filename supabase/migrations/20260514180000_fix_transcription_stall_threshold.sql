
CREATE OR REPLACE FUNCTION public.mark_stalled_transcription_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.transcription_jobs
  SET
    status = 'error'::transcription_job_status,
    error = 'Слишком долго нет прогресса по задаче (сервис расшифровки не ответил в отведённое время). Попробуйте «Повторить», разбейте длинную запись на части или загрузите более сжатый MP3.',
    status_message = 'Прервано (ожидание)',
    updated_at = now()
  WHERE status IN ('queued'::transcription_job_status, 'processing'::transcription_job_status)
    AND updated_at < now() - INTERVAL '90 minutes';
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('mark-stalled-transcription-jobs');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'mark-stalled-transcription-jobs',
  '* * * * *',
  $$SELECT public.mark_stalled_transcription_jobs();$$
);
