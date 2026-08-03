-- Diagnóstico do capturador em nuvem. Este arquivo não altera dados.

select jobid, jobname, schedule, active
from cron.job
where jobname = 'central-dashboards-cloud-capture';

select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (
  select jobid from cron.job
  where jobname = 'central-dashboards-cloud-capture'
)
order by start_time desc
limit 20;

select id, status_code, timed_out, error_msg, created
from net._http_response
order by created desc
limit 20;

select
  revision,
  updated_at,
  jsonb_array_length(coalesce(payload->'urls', '[]'::jsonb)) as dashboards,
  (
    select count(*)
    from jsonb_array_elements(coalesce(payload->'urls', '[]'::jsonb)) item
    where nullif(item->>'rokuImageUrl', '') is not null
  ) as dashboards_com_imagem,
  (
    select min((item->>'rokuCapturedAt')::timestamptz)
    from jsonb_array_elements(coalesce(payload->'urls', '[]'::jsonb)) item
    where nullif(item->>'rokuCapturedAt', '') is not null
  ) as captura_mais_antiga,
  (
    select max((item->>'rokuCapturedAt')::timestamptz)
    from jsonb_array_elements(coalesce(payload->'urls', '[]'::jsonb)) item
    where nullif(item->>'rokuCapturedAt', '') is not null
  ) as captura_mais_recente
from public.tv_app_state
where id = 'central';
