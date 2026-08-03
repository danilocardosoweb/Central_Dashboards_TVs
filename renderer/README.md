# Capturador Chromium

O capturador transforma os links públicos do Power BI em imagens PNG
1920×1080 consumidas pelo aplicativo Roku.

## Fluxo

O estado principal fica em `central-state/state/central.json`. A tabela
`tv_app_state` é usada apenas como compatibilidade opcional.

1. Lê `tv_app_state.payload.urls`.
2. Abre o campo `combined` de cada dashboard no Chromium.
3. Aguarda a superfície do relatório e um tempo adicional de estabilização.
4. Aplica zoom de 89% e captura somente a área real do relatório, sem barras.
5. Salva uma cópia em `renderer/output`.
6. Envia para `roku-snapshots/dashboards/<dashboard-id>.png`.
7. Atualiza `rokuImageUrl`, `rokuCapturedAt` e `rokuCaptureStatus`.
8. O player Roku recebe a nova URL na próxima sincronização.

Se uma captura falhar, a imagem anterior é preservada.

## Preparar o Supabase para o teste sem login

Abra o SQL Editor do projeto `ypwpumtzbdraldccctfd` e execute:

```text
supabase/roku_snapshots.sql
```

Esse arquivo cria um bucket público para leitura e permite somente inclusão e
atualização de arquivos PNG na pasta `dashboards`. Não permite exclusão.

## Instalar

```powershell
npm.cmd install
npm.cmd run capture:install-browser
```

## Teste local sem upload

```powershell
npm.cmd run capture:once -- --local-only
```

As imagens serão gravadas em `renderer/output`.

Para capturar somente um dashboard:

```powershell
$env:CAPTURE_ONLY_IDS="dashboard-123"
npm.cmd run capture:once -- --local-only
```

## Capturar e enviar ao Roku

O atalho `Capturar_e_Enviar_para_TV.cmd` oferece o mesmo fluxo por duplo
clique. Na primeira execução ele cria o `.env`; preencha a chave secreta e
execute novamente. Todos os dashboards cadastrados são processados, sem limite
fixo, e enviados ao Storage.

Depois de executar o SQL:

```powershell
npm.cmd run capture:once
```

Para manter a atualização a cada cinco minutos:

```powershell
npm.cmd run capture:watch
```

O intervalo pode ser alterado em `.env`:

```text
CAPTURE_INTERVAL_MS=300000
```

Copie `renderer/.env.example` para `.env` somente quando precisar alterar os
valores padrão. O arquivo `.env` não é enviado ao Git.

## Produção

O modo sem login é apenas para validação. Para produção:

1. Execute `supabase/roku_snapshots_secure.sql`.
2. Coloque uma chave secreta em `SUPABASE_RENDERER_KEY` somente no servidor.
3. Nunca copie essa chave para o site ou para o pacote Roku.

## Ajustes de imagem

- `CAPTURE_SETTLE_MS`: espera depois que o relatório aparece.
- `CAPTURE_CHROME_BOTTOM`: reserva de altura para os controles do Power BI (90 px por padrão), mantendo a área útil do relatório em 1920×1080.
- `CAPTURE_POWERBI_ZOOM`: zoom aplicado ao relatório antes da imagem.
- `CAPTURE_TRIM_WHITESPACE`: remove margens e amplia o relatório para a TV.
- `CAPTURE_WIDTH` e `CAPTURE_HEIGHT`: resolução final.
- `CAPTURE_DEBUG=true`: salva uma imagem quando ocorre erro.

Se o Power BI ainda estiver incompleto, aumente `CAPTURE_SETTLE_MS`. Se restar
uma faixa inferior, ajuste `CAPTURE_CHROME_BOTTOM`.
