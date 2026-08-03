-- Protege a Central contra capturadores/abas antigas e aponta o Cron para producao.
-- Execute uma vez no SQL Editor do mesmo projeto Supabase da Central.

create or replace function public.guard_tv_app_state_revision()
returns trigger
language plpgsql
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

  -- Um capturador antigo pode concluir depois de o PPR ter sido editado.
  -- Nesse caso, mantém sempre a versão mais recente da seção PPR.
  if old.payload ? 'ppr' and (
    not (new.payload ? 'ppr')
    or coalesce(new.payload->'ppr'->>'updatedAt', '')
       < coalesce(old.payload->'ppr'->>'updatedAt', '')
  ) then
    new.payload := jsonb_set(
      coalesce(new.payload, '{}'::jsonb),
      '{ppr}',
      old.payload->'ppr',
      true
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
      'Endpoint de producao do capturador Chromium flow-v4'
    );
  else
    perform vault.update_secret(
      url_secret_id,
      'https://central-dashboards-t-vs.vercel.app/api/capture',
      'central_dashboards_capture_url',
      'Endpoint de producao do capturador Chromium flow-v4'
    );
  end if;
end $$;

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

-- Dispara imediatamente apenas quando a Central cria uma nova solicitacao.
-- A funcao fica fora do schema exposto e o segredo nunca chega ao navegador.
create schema if not exists private;

create or replace function private.trigger_dashboard_capture_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.payload #>> '{capture,status}') = 'pending'
     and (
       (new.payload #>> '{capture,requestId}') is distinct from
         (old.payload #>> '{capture,requestId}')
       or (
         nullif(old.payload #>> '{capture,activeDashboardId}', '') is not null
         and nullif(new.payload #>> '{capture,activeDashboardId}', '') is null
       )
     ) then
    perform net.http_post(
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
      body := jsonb_build_object('source', 'central-trigger', 'flow', 'v4'),
      timeout_milliseconds := 280000
    );
  end if;
  return new;
end;
$$;

revoke all on function private.trigger_dashboard_capture_request() from public;
revoke all on function private.trigger_dashboard_capture_request() from anon;
revoke all on function private.trigger_dashboard_capture_request() from authenticated;

drop trigger if exists tv_app_state_capture_request on public.tv_app_state;
create trigger tv_app_state_capture_request
after update of payload on public.tv_app_state
for each row
execute function private.trigger_dashboard_capture_request();

select cron.schedule(
  'central-dashboards-cloud-capture',
  '*/5 * * * *',
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
    -- Worker de seguranca: sem fila pendente, retorna em milissegundos e nao
    -- abre o Chromium. Se o gatilho imediato falhar, continua a fila.
    body := jsonb_build_object('source', 'supabase-worker', 'flow', 'v4'),
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

select
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'tv_app_state'
  and trigger_name = 'tv_app_state_revision_guard';
