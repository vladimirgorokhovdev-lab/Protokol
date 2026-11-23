-- После создания команды суда: поднять лимит мест до 30 (КП «Суд — все залы»).
-- Подставь id команды или email владельца.

-- По email владельца:
UPDATE public.teams t
SET max_members = 30, updated_at = now()
FROM public.team_members tm
JOIN auth.users u ON u.id = tm.user_id
WHERE t.id = tm.team_id
  AND tm.role = 'owner'
  AND lower(u.email) = lower('OWNER@EXAMPLE.COM');

-- Или напрямую по team_id:
-- UPDATE public.teams SET max_members = 30, updated_at = now() WHERE id = '...';
