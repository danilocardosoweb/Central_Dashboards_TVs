# Monitor visual das TVs Roku

Abra `Monitorar_TVs_Roku.cmd`. O painel consulta diretamente cada Roku pela rede local, sem depender da Vercel ou do Supabase.

- **Verde — Player ativo:** a TV responde e o aplicativo de dashboards esta aberto.
- **Amarelo — Outro aplicativo:** a TV responde, mas esta em outro canal ou na tela inicial.
- **Vermelho — Sem comunicacao:** a TV esta desligada, fora da rede ou bloqueando o acesso pela porta 8060.

O painel atualiza automaticamente, mostra o nome do aplicativo que esta aberto e permite iniciar o player de desenvolvimento com um clique.

Por padrao, se uma TV estiver acessivel mas deixar de informar o player como ativo, o monitor solicita a abertura automaticamente. A tentativa tem intervalo de seguranca de 60 segundos e no maximo 3 tentativas por ciclo de falha, evitando loop de comandos. O painel tambem exibe uma faixa vermelha e uma notificacao do Windows quando detecta a interrupcao. Quando a TV volta ao estado ativo, a faixa e encerrada e o contador de tentativas e zerado.

Na janela do monitor, o interruptor **Reabertura automatica** funciona como controle geral. Cada cartão de TV tambem possui **Reabrir automaticamente nesta TV**. Assim, por exemplo, e possivel deixar a TV da sala de reuniao desativada sem afetar Prensas e Usinagem. Desligar o controle geral impede qualquer reabertura, mesmo que uma TV individual esteja marcada.

As preferências ficam salvas em `scripts/roku-tv-monitor.config.json`. Tambem e possivel alterar `autoRecovery` (controle geral), `stations[].autoRecovery` (por TV), `recoveryCooldownSeconds` e `maxRecoveryAttempts` diretamente no arquivo.

O **Modo minimalista (ocultar historico)** reduz a altura da janela e esconde o painel de verificacoes. Ele tambem fica salvo no campo `ui.minimal` e pode ser reativado a qualquer momento.

Para alterar nomes, setores, IPs ou o intervalo de atualizacao, edite `scripts/roku-tv-monitor.config.json`.

## Observacao importante

O monitor confirma o estado real do dispositivo na rede local. O IP sozinho nao identifica qual estacao foi selecionada dentro do aplicativo. Para isso, o heartbeat da Central continua sendo o complemento recomendado.
