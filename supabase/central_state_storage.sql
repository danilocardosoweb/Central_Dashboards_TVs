-- Estado privado compartilhado entre Central Web, capturador e Roku.
-- A leitura e a escrita acontecem somente pela API da Vercel com uma chave
-- secreta. Nao crie politicas para anon ou authenticated neste bucket.

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'central-state',
    'central-state',
    false,
    8388608,
    array['application/json']::text[]
)
on conflict (id) do update
set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Remove eventuais politicas publicas criadas durante testes anteriores.
drop policy if exists "central_state_anon_read" on storage.objects;
drop policy if exists "central_state_anon_insert" on storage.objects;
drop policy if exists "central_state_anon_update" on storage.objects;
drop policy if exists "central_state_authenticated_read" on storage.objects;
drop policy if exists "central_state_authenticated_insert" on storage.objects;
drop policy if exists "central_state_authenticated_update" on storage.objects;
