-- Protege a Central contra capturadores/abas antigas e aponta o Cron para producao.
-- Execute uma vez no SQL Editor do mesmo projeto Supabase da Central.

create or replace function public.guard_tv_app_state_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.revision <= old.revision then
    raise exception using
      errcode = '40001',
      message = format(
        'Revisao antiga rejeitada: recebida %s, atual %s.',
        new.revision,
        old.revision
      );
  end if;
  new.updated_at := greatest(
    coalesce(new.updated_at, now()),
    coalesce(old.updated_at, '-infinity'::timestamptz)
  );
  return new;
end;
$$;

drop trigger if exists tv_app_state_revision_guard on public.tv_app_state;
create trigger tv_app_state_revision_guard
before update on public.tv_app_state
for each row
execute function public.guard_tv_app_state_revision();

do $$
declare
  url_secret_id uuid;
  capture_secret text;
begin
  select decrypted_secret into capture_secret
  from vault.decrypted_secrets
  where name = 'central_dashboards_capture_secret'
  order by created_at desc
  limit 1;

  if nullif(capture_secret, '') is null
     or capture_secret = 'CAPTURE_API_SECRET_AQUI' then
    raise exception 'O segredo central_dashboards_capture_secret nao esta configurado no Vault.';
  end if;

  select id into url_secret_id
  from vault.decrypted_secrets
  where name = 'central_dashboards_capture_url'
  order by created_at desc
  limit 1;

  if url_secret_id is null then
    perform vault.create_secret(
      'https://central-dashboards-t-vs.vercel.app/api/capture',
      'central_dashboards_capture_url',
      'Endpoint de producao do capturador Chromium flow-v2'
    );
  else
    perform vault.update_secret(
      url_secret_id,
      'https://central-dashboards-t-vs.vercel.app/api/capture',
      'central_dashboards_capture_url',
      'Endpoint de producao do capturador Chromium flow-v2'
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
    body := jsonb_build_object('source', 'supabase-cron', 'flow', 'v2'),
    timeout_milliseconds := 280000
  ) as request_id;
  $$
);

select
  jobid,
  jobname,
  schedule,
  active,
  'https://central-dashboards-t-vs.vercel.app/api/capture' as endpoint_esperado
from cron.job
where jobname = 'central-dashboards-cloud-capture';
