-- Deixa a captura dos dashboards exclusivamente sob o botao "Atualizar agora".
-- Execute uma vez no SQL Editor do projeto Supabase usado pela Central.

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname = 'central-dashboards-cloud-capture'
       or command ilike '%/api/capture%'
       or command ilike '%central_dashboards_capture_url%'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end $$;

drop trigger if exists tv_app_state_capture_request on public.tv_app_state;
drop function if exists private.trigger_dashboard_capture_request();

select
  count(*) as capturas_agendadas_restantes
from cron.job
where jobname = 'central-dashboards-cloud-capture'
   or command ilike '%/api/capture%'
   or command ilike '%central_dashboards_capture_url%';

select
  count(*) as gatilhos_automaticos_restantes
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'tv_app_state'
  and trigger_name = 'tv_app_state_capture_request';
