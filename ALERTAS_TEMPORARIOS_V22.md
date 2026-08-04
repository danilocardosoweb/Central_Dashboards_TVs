# Alertas Temporarios Roku - V22

## Arquitetura

Os alertas temporarios sao independentes do carrossel principal. A Central
salva a configuracao no estado compartilhado. O Roku consulta esse estado,
filtra os alertas destinados a TV ou ao setor atual e monta uma fila propria.

A fila respeita esta prioridade:

1. Critico;
2. Atencao;
3. Informativo.

Somente um alerta fica visivel por vez. A faixa usa componentes nativos do
SceneGraph (`Rectangle`, `Label`, `ScrollingLabel`, `Animation` e `Timer`). O
conteudo atual e reduzido para 80% enquanto a faixa ocupa a parte inferior. O
`slideTimer` nao e parado, reiniciado nem alterado.

O historico e enviado por uma `Task` assincrona. Uma falha de rede ou de escrita
no historico gera log, mas nao interfere no dashboard, video, imagem ou PPR.
Alteracoes exclusivas no historico nao recompõem a playlist e nao reiniciam a
tela atual.

## Central de controle

Na secao Avisos e possivel:

- criar, editar, duplicar, ativar, desativar e encerrar alertas;
- escolher todas as TVs, um setor ou uma TV especifica;
- definir prioridade, inicio, encerramento, duracao e repeticoes;
- escolher texto automatico, fixo ou rolante;
- consultar o historico recebido das TVs.

Para usar a faixa temporaria, selecione `Faixa inferior` em Exibicao. Avisos em
`Tela completa` continuam participando normalmente do carrossel.

## Logs de diagnostico

O console de desenvolvimento Roku registra eventos com o prefixo
`[central-tv]`. Os eventos principais sao:

- `temporary-alert-queue`;
- `temporary-alert-show`;
- `temporary-alert-hide`;
- `temporary-alert-history-saved`;
- `temporary-alert-history-error`;
- `playlist-built` e `slide-start` para confirmar que o carrossel continuou.

A API registra `state-api/alert-event.saved`, incluindo o alerta, a TV e a
revisao do estado.

## Arquivos alterados nesta entrega

- `index.html`: formulario, destinos, ciclo de vida e historico;
- `api/state.mjs`: recebimento e persistencia dos eventos;
- `api/diagnostics.mjs`: contagem separada dos alertas temporarios;
- `roku/components/MainScene.xml`: faixa, animacoes e timers nativos;
- `roku/components/MainScene.brs`: fila, prioridade, targeting e isolamento;
- `roku/components/AlertEventTask.xml` e `.brs`: historico assincrono;
- `roku/manifest`: build 21;
- testes em `api/` e `tests/`.

## Teste manual recomendado

1. Abra um dashboard na TV e observe qual tela esta ativa.
2. Na Central, crie um aviso em `Faixa inferior`, destinado a essa TV.
3. Defina 10 segundos, uma repeticao e texto curto; ative e sincronize.
4. Em ate 60 segundos, confirme que a faixa aparece e o dashboard e reduzido.
5. Confirme que a rotacao continua durante ou depois da faixa.
6. Repita com texto longo e modo rolante.
7. Crie tres alertas, um de cada prioridade, e confirme a ordem da fila.
8. Teste os destinos Todas as TVs, Setor e Uma TV.
9. Desligue a rede durante um alerta e confirme que o carrossel continua.
10. Consulte o historico na Central e os eventos no console Roku.

## Pacote

O pacote desta entrega e `dist/Central_Dashboard_TVs_Roku_V_22.zip`. As versoes
V16 a V21 permanecem preservadas para retorno ou comparacao.
