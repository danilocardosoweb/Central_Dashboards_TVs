-- Central de Dashboards para TVs
-- Estado compartilhado entre o painel administrativo e os Raspberry Pi.
--
-- Modelo de acesso solicitado:
--   * leitura sem login;
--   * inclusão e atualização sem login;
--   * a linha central não pode ser excluída pela API.
--
-- IMPORTANTE: mantenha o endereço do app restrito à rede interna.

create table if not exists public.tv_app_state (
    id text primary key,
    payload jsonb not null default '{}'::jsonb,
    revision bigint not null default 0,
    updated_at timestamptz not null default now(),
    constraint tv_app_state_single_row check (id = 'central')
);

alter table public.tv_app_state enable row level security;

revoke all on table public.tv_app_state from anon, authenticated;
grant select, insert, update on table public.tv_app_state to anon, authenticated;

drop policy if exists "tv_app_state_read_internal" on public.tv_app_state;
create policy "tv_app_state_read_internal"
on public.tv_app_state
for select
to anon, authenticated
using (id = 'central');

drop policy if exists "tv_app_state_create_internal" on public.tv_app_state;
create policy "tv_app_state_create_internal"
on public.tv_app_state
for insert
to anon, authenticated
with check (id = 'central');

drop policy if exists "tv_app_state_update_internal" on public.tv_app_state;
create policy "tv_app_state_update_internal"
on public.tv_app_state
for update
to anon, authenticated
using (id = 'central')
with check (id = 'central');

insert into public.tv_app_state (id, payload, revision)
values ('central', '{}'::jsonb, 0)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
