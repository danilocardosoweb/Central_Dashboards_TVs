-- Armazenamento dos anexos publicados na Central de Avisos.
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
    52428800,
    array[
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'image/bmp',
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'application/pdf'
    ]::text[]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "alert_assets_internal_insert" on storage.objects;
drop policy if exists "alert_assets_public_read" on storage.objects;

create policy "alert_assets_internal_insert"
on storage.objects
for insert
to anon, authenticated
with check (
    bucket_id = 'alert-assets'
    and name like 'alerts/%'
);

-- Permite que a Central e o aplicativo Roku carreguem os arquivos publicados
-- por URL HTTPS, sem acesso a dados internos da tabela de configuração.
create policy "alert_assets_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'alert-assets');
