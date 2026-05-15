-- Run once in Supabase Dashboard → SQL → New query (if migrations were not pushed).
-- Fixes false error: "Воркер был остановлен (вероятно, нехватка памяти...)".

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

-- Optional: clear old misleading errors so UI does not show stale text
UPDATE public.transcription_jobs
SET
  status = 'error'::transcription_job_status,
  error = 'Задача прервана старым правилом (8 мин). Нажмите «Повторить» — после обновления сервера длинные файлы обрабатываются дольше.',
  status_message = 'Прервано (ожидание)'
WHERE error LIKE '%Воркер был остановлен%'
  AND status = 'error'::transcription_job_status;
