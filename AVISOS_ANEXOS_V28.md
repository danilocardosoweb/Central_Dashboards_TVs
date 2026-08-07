# Avisos com anexos — V_28

## Fluxo confiável para a TV

1. A Central envia o arquivo ao bucket público `alert-assets` do Supabase.
2. O aviso salva somente a URL HTTPS retornada pelo Storage.
3. A configuração do aviso é enviada imediatamente para a base central.
4. O Roku consulta a configuração e carrega a mesma URL HTTPS.

Imagens que não possuírem URL HTTPS não são mais tratadas como prontas para a TV. Isso evita avisos que funcionam apenas no navegador da Central por usarem dados locais (`data:`), que o Roku não consegue acessar.

## Formatos aceitos

| Tipo | Central | TV Roku |
| --- | --- | --- |
| PNG, JPG, JPEG, WEBP, BMP | Convertido para PNG Full HD e exibido | Sim |
| GIF | Primeiro quadro convertido para PNG | Sim, como imagem estática |
| PDF | Armazenado como anexo | Não diretamente; publique cada página como PNG/JPG |
| MP4, WEBM, MOV | Armazenado como anexo | Não entra no carrossel atual para evitar tela preta |

Para vídeo na TV, a evolução recomendada é receber **MP4 H.264 + áudio AAC**, com uma imagem de capa. O player SceneGraph pode usar um nó `Video`, mas isso é uma etapa separada do carrossel de imagens e deve ser validada com cada modelo de Roku.

## Configuração obrigatória do Supabase

Execute `supabase/alert_assets.sql` no SQL Editor uma vez. Ele cria/atualiza o bucket `alert-assets`, permite envio para a pasta `alerts/` e leitura pública das URLs HTTPS consumidas pelo Roku.

## Diagnóstico

No menu **Avisos**, um aviso somente com imagem mostra **Pronto para TV** somente quando possui URL HTTPS. Caso apareça **Pendente para TV**, envie o arquivo novamente e confirme se o bucket `alert-assets` foi configurado.
