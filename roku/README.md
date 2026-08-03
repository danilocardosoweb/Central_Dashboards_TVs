# Player Roku V18

Aplicativo nativo Roku que consulta a API central da Vercel e monta uma unica
lista com dashboards, avisos em tela cheia e telas do PPR. Itens desativados e
itens destinados a outra TV ou setor sao ignorados.

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

O painel de diagnostico mostra build, sessao, origem dos dados (rede ou cache),
revisao, trace ID, TV selecionada, total de telas, tela atual e ultimo erro.

## Gerar e instalar

```powershell
npm.cmd install
npm.cmd test
npm.cmd run roku:check
npm.cmd run roku:package
```

O V18 e gerado como:

```text
dist/Central_Dashboard_TVs_Roku_V_18.zip
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
