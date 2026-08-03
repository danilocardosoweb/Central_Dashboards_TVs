# Auditoria ponta a ponta - Roku V18

## Fluxo oficial

1. A Central grava a programacao no objeto privado
   `central-state/state/central.json` por meio de `/api/state`.
2. O botao Atualizar agora cria uma fila dinamica com todos os dashboards
   ativos. `/api/state` chama `/api/capture` uma vez para cada item.
3. O Chromium gera PNG 1920x1080 e publica em `roku-snapshots`.
4. O link versionado da imagem volta ao mesmo estado central.
5. O Roku consulta `/api/state`, filtra a programacao pela TV/setor e combina
   dashboards, PPR e avisos em uma unica lista.

## Causa raiz encontrada

- A producao e o Storage estavam saudaveis: seis dashboards, seis imagens
  distintas e validas e quatro indicadores PPR.
- A versao corrigida do player nao era a mesma versao publicada e instalada.
- A consulta do Roku usava `GetToString`, que pode bloquear por tempo
  indeterminado. Nesse caso `m.fetching` permanecia verdadeiro e nenhuma nova
  sincronizacao era iniciada.
- Nao havia telemetria na TV para distinguir falha de rede, cache, playlist,
  imagem ou video.

## Correcoes V18

- consulta assincrona com timeout de 15 segundos;
- cache local da ultima programacao valida;
- watchdog de 20 segundos e nova tentativa automatica;
- contingencia por imagem sem interromper o carrossel;
- liberacao do video por evento, posicao, controle ou limite de 12 segundos;
- logs estruturados na API, capturador e player;
- `X-Central-Trace-Id` para correlacionar Central, Vercel e TV;
- `/api/diagnostics` com contagens seguras por TV;
- painel tecnico no Roku, acionado pela seta para cima;
- gerador de pacote que preserva versoes anteriores.

## Procedimento depois de uma atualizacao

```powershell
npm.cmd test
npm.cmd run roku:check
npm.cmd run audit:e2e -- https://central-dashboards-t-vs.vercel.app
```

O ultimo teste deve terminar com `ok: true`. Na TV, abra o V18, espere o video
ou pressione OK para pula-lo e use a seta para cima. Confirme: Build V18,
Fonte network, revisao igual a API, total de telas maior que zero e mudanca do
indice atual. Se houver falha, use o trace ID exibido para localizar a mesma
requisicao nos Runtime Logs da Vercel.

## Riscos restantes

- Aplicativos instalados por sideload nao se atualizam sozinhos; cada TV deve
  receber o novo ZIP.
- O endpoint de escrita da Central continua sem login, conforme a decisao de
  teste. Um site publico precisa de autenticacao administrativa antes do uso
  definitivo.
- A captura depende de links Power BI acessiveis pelo Chromium da Vercel.
- A validacao fisica final exige uma TV alcancavel na mesma rede.
