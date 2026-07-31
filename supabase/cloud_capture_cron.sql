-- Agendamento totalmente em nuvem: Supabase Cron -> Vercel -> Chromium -> Storage.
--
-- Antes de executar:
-- 1. Troque a URL abaixo pelo domínio de produção da Central na Vercel.
-- 2. Troque a senha pelo MESMO valor de CAPTURE_API_SECRET configurado na Vercel.
-- 3. Execute este arquivo apenas uma vez no SQL Editor do Supabase.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  'https://SEU-PROJETO.vercel.app/api/capture',
  'central_dashboards_capture_url',
  'Endpoint privado do capturador Chromium'
);

select vault.create_secret(
  'SUBSTITUA_PELA_MESMA_SENHA_DE_CAPTURE_API_SECRET',
  'central_dashboards_capture_secret',
  'Autorização do capturador Chromium'
);

select cron.schedule(
  'central-dashboards-cloud-capture',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'central_dashboards_capture_url'
      limit 1
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'central_dashboards_capture_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 280000
  ) as request_id;
  $$
);
