-- Protege a revisao do estado central e mantem a captura em modo manual.
-- Execute no SQL Editor do projeto Supabase usado pela Central.

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
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'tv_app_state';
