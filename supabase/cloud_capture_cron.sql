-- Agendamento totalmente em nuvem: Supabase Cron -> Vercel -> Chromium -> Storage.
--
-- Antes de executar, substitua apenas CAPTURE_API_SECRET_AQUI pelo MESMO
-- valor de CAPTURE_API_SECRET configurado na Vercel. Este script pode ser
-- executado novamente: ele atualiza os segredos e recria um único agendamento.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  secret_id uuid;
begin
  select id into secret_id
  from vault.decrypted_secrets
  where name = 'central_dashboards_capture_url'
  order by created_at desc
  limit 1;

  if secret_id is null then
    perform vault.create_secret(
      'https://central-dashboards-t-vs.vercel.app/api/capture',
      'central_dashboards_capture_url',
      'Endpoint privado do capturador Chromium'
    );
  else
    perform vault.update_secret(
      secret_id,
      'https://central-dashboards-t-vs.vercel.app/api/capture',
      'central_dashboards_capture_url',
      'Endpoint privado do capturador Chromium'
    );
  end if;
end $$;

do $$
declare
  secret_id uuid;
begin
  select id into secret_id
  from vault.decrypted_secrets
  where name = 'central_dashboards_capture_secret'
  order by created_at desc
  limit 1;

  if secret_id is null then
    perform vault.create_secret(
      'CAPTURE_API_SECRET_AQUI',
      'central_dashboards_capture_secret',
      'Autorização do capturador Chromium'
    );
  else
    perform vault.update_secret(
      secret_id,
      'CAPTURE_API_SECRET_AQUI',
      'central_dashboards_capture_secret',
      'Autorização do capturador Chromium'
    );
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'central-dashboards-cloud-capture';

select cron.schedule(
  'central-dashboards-cloud-capture',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'central_dashboards_capture_url'
      order by created_at desc
      limit 1
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'central_dashboards_capture_secret'
        order by created_at desc
        limit 1
      )
    ),
    body := jsonb_build_object('source', 'supabase-cron'),
    timeout_milliseconds := 280000
  ) as request_id;
  $$
);

-- Confirmação segura: mostra o trabalho criado sem revelar os segredos.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'central-dashboards-cloud-capture';
