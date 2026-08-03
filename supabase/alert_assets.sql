-- Armazenamento das imagens publicadas na Central de Avisos.
-- Execute este arquivo uma única vez no SQL Editor do projeto Supabase.
--
-- IMPORTANTE: esta política acompanha o modelo atual do aplicativo, sem login.
-- Qualquer pessoa que conheça a chave pública e o endpoint poderá enviar imagens
-- para a pasta alerts/. Para disponibilizar a Central na internet, proteja a
-- administração com Supabase Auth e substitua esta política por uma autenticada.

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'alert-assets',
    'alert-assets',
    true,
    2097152,
    array['image/webp', 'image/png', 'image/jpeg']::text[]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "alert_assets_internal_insert" on storage.objects;

create policy "alert_assets_internal_insert"
on storage.objects
for insert
to anon, authenticated
with check (
    bucket_id = 'alert-assets'
    and name like 'alerts/%'
);
