# Estabilidade do player Roku 24x7

## Diagnóstico comprovado

Nos consoles das TVs do ambiente foram registrados `EXIT_IDLE_AUTO_EXIT` e
`AppExitInitiate` por volta de 7,8 milhões de milissegundos (aproximadamente
2h10). Esse código é definido pela Roku como encerramento automático por
inatividade, conforme política do sistema e/ou configurações do usuário.

Os demais motivos precisam ser lidos no próximo lançamento pelo parâmetro
`lastExitOrTerminationReason`: `EXIT_OUT_OF_MEMORY`,
`EXIT_BRIGHTSCRIPT_CRASH`, `EXIT_BRIGHTSCRIPT_TIMEOUT`, `EXIT_POWER_MODE`,
`EXIT_USER_KILL` e outros. A partir da V37, esse valor segue no heartbeat e
fica armazenado no monitor central da TV.

## Proteções da V37

- reprodução local contínua e quase inaudível para que o Roku OS reconheça
  atividade de mídia;
- `disableScreenSaver=true` e `enableScreenSaverWhilePlaying=false`;
- verificação e retomada da mídia de proteção;
- `backExitsScene=false`, evitando que um toque acidental em Voltar encerre
  a cena (Home sempre encerra por regra do Roku OS);
- watchdog do carrossel independente da internet;
- cache do último estado válido para perda temporária de conexão;
- liberação explícita de `Task` e de seus observadores após consultas,
  heartbeats e eventos de alertas;
- descarte da textura anterior após cada transição;
- decodificação das imagens na resolução real da saída. Em HD, cada textura
  cai de aproximadamente 8,3 MB para 3,7 MB;
- poda dos marcadores de versões antigas de alertas;
- telemetria com versão real do pacote, tempo de sessão, idade do slide,
  recuperações, erro atual e motivo do encerramento anterior.

## Configuração obrigatória da TV/dispositivo

1. Em **Configurações > Sistema > Energia > Economia automática**, desmarcar
   **Após 20 minutos sem interação**, quando essa opção existir.
2. Em **Configurações > Rede > Economia de largura de banda**, selecionar
   **Desativado**. Caso contrário, o Roku pode interromper streaming após
   quatro horas sem comando do controle e voltar à tela inicial.
3. Em **Configurações > Sistema > Hora > Temporizador**, confirmar que não há
   temporizador de desligamento ativo.
4. Desativar agendamento de desligamento, modo Eco e temporizador também nas
   configurações do fabricante da TV.
5. Alimentar um Roku externo por fonte de tomada, não por uma USB da TV que
   desliga ou limita energia.
6. Evitar pressionar Home: por regra do sistema, Home sempre encerra o app e
   nenhum código interno consegue impedir ou relançar um processo já morto.

## Teste contínuo de 24 horas

Com o computador na mesma rede, execute na raiz do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/roku-soak-test.ps1
```

O script consulta a API ECP das três TVs a cada 30 segundos e grava CSV e
resumo em `dist/soak-test`. Para um ensaio de recuperação externa, que exige
deixar o computador ligado:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/roku-soak-test.ps1 -AutoRelaunch
```

O modo `AutoRelaunch` tenta abrir o app de desenvolvimento (`dev`) quando
detecta outro aplicativo. Ele é contingência externa, não substitui a correção
da causa raiz.

Durante o ensaio, use o Resource Monitor oficial da Roku em modo de coleta e
acompanhe `system_memory`, `graphics_memory`, `total_nodes`, FPS e rendezvous.
Também podem ser usados no console SceneGraph da porta 8080:

```text
loaded_textures
sgnodes all
```

Uma falha por memória apresenta tendência crescente em texturas/nós e, no
próximo lançamento, `EXIT_OUT_OF_MEMORY`. Uma falha do render thread aparece
como `EXIT_BRIGHTSCRIPT_TIMEOUT`. Uma exceção aparece como
`EXIT_BRIGHTSCRIPT_CRASH`, `EXIT_BRIGHTSCRIPT_STOP` ou
`EXIT_BRIGHTSCRIPT_UNK_FUNC`.

## Critério de aprovação

- 24 horas sem sair do app;
- 100% das amostras com `DashboardActive=true` (exceto reinicialização
  planejada);
- carrossel avança durante falhas simuladas de internet;
- após reconectar, estado e heartbeat se recuperam sem reiniciar o app;
- memória gráfica e quantidade de nós atingem um platô, sem crescimento
  contínuo;
- nenhum alerta, PPR, vídeo ou imagem deixa objetos acumulados após a troca;
- o motivo de uma eventual saída aparece no heartbeat do lançamento seguinte.

## Fontes oficiais

- Exit codes e `lastExitOrTerminationReason`:
  https://developer.roku.com/dev/docs/dev-environment
- Memória e custo de texturas:
  https://developer.roku.com/dev/docs/memory-management
- Garbage collector e referências circulares:
  https://developer.roku.com/dev/docs/data-management
- Resource Monitor:
  https://developer.roku.com/dev/docs/resource-monitor
- Debug de texturas e nós:
  https://developer.roku.com/dev/docs/debugging
- Video e controle de screensaver:
  https://developer.roku.com/dev/docs/video
- Timer e callbacks no render thread:
  https://developer.roku.com/docs/references/scenegraph/control-nodes/timer.md
- Economia de energia:
  https://support.roku.com/en-ca/article/disable-auto-power-savings
- Economia de largura de banda:
  https://support.roku.com/en-ca/article/bandwidth-saver

