# Player Roku V24

Aplicativo nativo Roku que consulta a API central da Vercel e monta uma unica
lista com dashboards, avisos em tela cheia e telas do PPR. Itens desativados e
itens destinados a outra TV ou setor sao ignorados.

As telas do PPR sao geradas pela Central em 1920x1080 e publicadas como um
conjunto versionado no Supabase Storage. O Roku prioriza essas imagens e usa o
desenho nativo somente quando ainda nao existe uma geracao valida.

## Alertas temporarios nativos

- A Central permite criar, editar, ativar e encerrar alertas destinados a todas
  as TVs, a um setor ou a uma TV especifica.
- Alertas em faixa usam `Rectangle`, `Label`, `ScrollingLabel`, `Animation` e
  `Timer` nativos do SceneGraph.
- A fila exibe um alerta por vez, na ordem: critico, atencao e informativo.
- Enquanto a faixa aparece, o conteudo atual e reduzido para 80%, mas o
  temporizador e a rotacao do carrossel continuam funcionando normalmente.
- Textos curtos ficam fixos; textos longos podem rolar automaticamente.
- Duracao e repeticoes sao configuradas na Central.
- O historico de exibicao e enviado de forma assincrona. Falhas nesse envio nao
  param nem reiniciam dashboards, imagens, videos ou PPR.

## Recuperacao e diagnostico

- A consulta da Central e assincrona e possui timeout de 15 segundos.
- A ultima programacao valida fica salva no cache da TV.
- Se a rede falhar, o player usa o cache e continua a rotacao.
- Um watchdog de 20 segundos libera uma consulta que tenha travado.
- Imagens possuem timeout, uma nova tentativa com quebra de cache e tela de
  contingencia. Uma imagem com erro nao interrompe as proximas telas.
- O video de abertura termina por evento, por posicao, por controle remoto ou
  pelo limite de 12 segundos.
- O console de desenvolvimento registra eventos com o prefixo `[central-tv]`.

## Controles

- `OK`, `*` ou seta para baixo: escolher a TV ou setor.
- Setas esquerda/direita: navegar entre as telas.
- `Play/Pause`: pausar ou continuar.
- Seta para cima: mostrar/ocultar o painel de diagnostico.
- Durante a abertura, `OK` ou `Back`: pular o video.

Na primeira instalacao, o aplicativo inicia a programacao padrao diretamente.
O seletor nao abre sozinho; ele aparece apenas quando o usuario pressiona
`OK`, `*` ou a seta para baixo.

O painel de diagnostico mostra build, sessao, origem dos dados (rede ou cache),
revisao, trace ID, TV selecionada, total de telas, tela atual e ultimo erro.

## Gerar e instalar

```powershell
npm.cmd install
npm.cmd test
npm.cmd run roku:check
npm.cmd run roku:package
```

O V24 e gerado como:

```text
dist/Central_Dashboard_TVs_Roku_V_26.zip
```

O gerador recusa substituir um ZIP existente. Para uma nova entrega, incremente
`build_version` no manifesto. Instale o arquivo pela pagina de desenvolvimento
da TV usando `Install with zip`. Somente um aplicativo sideload pode permanecer
instalado por vez.

## Teste de ponta a ponta

Depois que a Vercel publicar a mesma versao do repositorio:

```powershell
npm.cmd run audit:e2e -- https://central-dashboards-t-vs.vercel.app
```

O teste valida o estado central, a lista calculada por TV e todas as imagens,
incluindo resposta HTTP, tipo, dimensoes 1920x1080 e quantidade dinamica.
