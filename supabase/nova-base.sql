-- Banco novo da Central de Dashboards para TVs
-- Projeto: fmxjvbwjnttamfnlghev
-- Execute todo este arquivo uma vez no SQL Editor do novo projeto.
--
-- A chave sb_publishable pode ser usada no navegador. A API de estado e o
-- capturador devem usar uma chave secreta sb_secret_ somente na Vercel/PC.

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
on public.tv_app_state for select to anon, authenticated
using (id = 'central');

drop policy if exists "tv_app_state_create_internal" on public.tv_app_state;
create policy "tv_app_state_create_internal"
on public.tv_app_state for insert to anon, authenticated
with check (id = 'central');

drop policy if exists "tv_app_state_update_internal" on public.tv_app_state;
create policy "tv_app_state_update_internal"
on public.tv_app_state for update to anon, authenticated
using (id = 'central')
with check (id = 'central');

insert into public.tv_app_state (id, payload, revision)
values ('central', '{}'::jsonb, 0)
on conflict (id) do nothing;

-- Imagens capturadas dos dashboards. Leitura pública é necessária para o Roku;
-- escrita fica somente com a chave secreta do capturador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'roku-snapshots', 'roku-snapshots', true, 10485760,
    array['image/png']::text[]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "roku_snapshots_test_read" on storage.objects;
drop policy if exists "roku_snapshots_test_insert" on storage.objects;
drop policy if exists "roku_snapshots_test_update" on storage.objects;
drop policy if exists "roku_snapshots_public_read" on storage.objects;
create policy "roku_snapshots_public_read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'roku-snapshots' and name like 'dashboards/%.png');

-- Estado central resiliente. A API usa a chave secreta para ler/escrever este
-- bucket; ele não fica exposto para anon/authenticated.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'central-state', 'central-state', false, 8388608,
    array['application/json']::text[]
)
on conflict (id) do update set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "central_state_anon_read" on storage.objects;
drop policy if exists "central_state_anon_insert" on storage.objects;
drop policy if exists "central_state_anon_update" on storage.objects;
drop policy if exists "central_state_authenticated_read" on storage.objects;
drop policy if exists "central_state_authenticated_insert" on storage.objects;
drop policy if exists "central_state_authenticated_update" on storage.objects;

-- Anexos de Avisos, incluindo MP4. O navegador envia usando a chave pública;
-- somente arquivos dentro de alerts/ podem ser enviados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'alert-assets', 'alert-assets', true, 52428800,
    array[
        'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp',
        'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf'
    ]::text[]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "alert_assets_internal_insert" on storage.objects;
create policy "alert_assets_internal_insert"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'alert-assets' and name like 'alerts/%');

drop policy if exists "alert_assets_public_read" on storage.objects;
create policy "alert_assets_public_read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'alert-assets');

notify pgrst, 'reload schema';

-- A aba Usinagem usa outro projeto/configuração e as tabelas abaixo não são
-- criadas por este arquivo. Configure VITE_USINAGEM_SUPABASE_URL e
-- VITE_USINAGEM_SUPABASE_ANON_KEY apontando para a base que contém:
-- apontamentos, paradas, pedidos e maquinas.
