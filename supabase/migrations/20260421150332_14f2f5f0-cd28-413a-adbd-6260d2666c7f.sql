CREATE EXTENSION IF NOT EXISTS pg_cron;

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
    error = 'Воркер был остановлен (вероятно, нехватка памяти на крупном файле). Попробуйте «Повторить» или сожмите аудио в MP3.',
    status_message = 'Прервано системой',
    updated_at = now()
  WHERE status IN ('queued'::transcription_job_status, 'processing'::transcription_job_status)
    AND updated_at < now() - INTERVAL '8 minutes';
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