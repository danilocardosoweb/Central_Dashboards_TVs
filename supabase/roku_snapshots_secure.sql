-- Endurecimento do bucket para produção.
--
-- Depois de executar este arquivo:
--   * as imagens continuam públicas para o Roku;
--   * chaves publishable/anon não podem mais enviar ou substituir arquivos;
--   * o capturador precisa usar SUPABASE_RENDERER_KEY no ambiente do servidor.
--
-- Nunca coloque a chave secreta no HTML, no aplicativo Roku ou no Git.

drop policy if exists "roku_snapshots_test_insert" on storage.objects;
drop policy if exists "roku_snapshots_test_update" on storage.objects;

-- A política SELECT é mantida para facilitar inspeções pela API.
-- Como o bucket é público, as URLs públicas continuam funcionando.
