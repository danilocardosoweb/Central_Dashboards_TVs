# Monitoramento das TVs Roku

## Como funciona

O aplicativo Roku V_27 envia um sinal leve para `/api/tv-status` a cada 60 segundos. O sinal é executado por uma `Task` separada do carrossel e informa somente dados operacionais: estação, versão do aplicativo, revisão da Central, posição e tipo do conteúdo atual e último erro.

O endpoint valida se a estação existe na configuração central e salva o sinal em `central-state/presence/<station-id>.json` no Supabase Storage. Ele não altera `state/central.json`, não incrementa a revisão da apresentação e não usa o Postgres.

A Central consulta o resumo a cada 30 segundos e classifica cada TV:

- **Online:** sinal recebido há no máximo 150 segundos;
- **Instável:** entre 151 e 300 segundos;
- **Offline:** mais de 300 segundos ou nenhum sinal recebido.

O endereço IP informado no perfil serve para identificação e suporte local. O estado online é confirmado pelo próprio aplicativo Roku, portanto uma TV ligada no menu inicial não aparece como online.

## Configuração inicial

1. Na Central, abra **TVs e setores**.
2. Crie um perfil para cada TV e informe o IP local correspondente.
3. Sincronize a configuração central.
4. Instale `Central_Dashboard_TVs_Roku_V_27.zip` em cada TV.
5. Em cada TV, abra a seleção de setor pelo controle e escolha o perfil correto.
6. Aguarde até 90 segundos e use **Atualizar status** no Monitor das TVs.

## Diagnóstico

Se uma TV aparecer offline:

1. confirme que o aplicativo está aberto na TV;
2. confira se o perfil selecionado na TV ainda existe na Central;
3. valide a conexão da TV com a internet;
4. abra o diagnóstico do player pelo controle para conferir o último erro;
5. confira os logs da função `/api/tv-status` na Vercel.

Uma falha no heartbeat não pausa, reinicia nem troca o carrossel. A reprodução continua com a última configuração armazenada em cache.
