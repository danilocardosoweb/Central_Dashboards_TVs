-- Capturas automáticas dos dashboards para o player Roku.
--
-- MODO DE TESTE SEM LOGIN:
--   * leitura pública das imagens;
--   * upload e atualização usando a chave publicável;
--   * nenhuma exclusão pela API pública.
--
-- Este modelo acompanha o acesso anônimo já usado pela Central durante o
-- protótipo. Antes de publicar o sistema na internet, remova as políticas de
-- escrita anônima e execute o capturador com uma chave secreta no servidor.

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'roku-snapshots',
    'roku-snapshots',
    true,
    10485760,
    array['image/png']::text[]
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "roku_snapshots_test_read" on storage.objects;
create policy "roku_snapshots_test_read"
on storage.objects
for select
to anon, authenticated
using (
    bucket_id = 'roku-snapshots'
    and name like 'dashboards/%.png'
);

drop policy if exists "roku_snapshots_test_insert" on storage.objects;
create policy "roku_snapshots_test_insert"
on storage.objects
for insert
to anon, authenticated
with check (
    bucket_id = 'roku-snapshots'
    and name like 'dashboards/%.png'
);

drop policy if exists "roku_snapshots_test_update" on storage.objects;
create policy "roku_snapshots_test_update"
on storage.objects
for update
to anon, authenticated
using (
    bucket_id = 'roku-snapshots'
    and name like 'dashboards/%.png'
)
with check (
    bucket_id = 'roku-snapshots'
    and name like 'dashboards/%.png'
);
