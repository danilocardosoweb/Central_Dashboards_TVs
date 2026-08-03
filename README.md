# Central de Dashboards para TVs

Aplicação web para exibir dashboards do Power BI, avisos internos, imagens e
programações por área em TVs conectadas a Raspberry Pi.

## Funcionalidades

- Rotação automática de dashboards com transições configuráveis.
- Áreas separadas para Comercial, PCP, Produção, Embalagem, Usinagem,
  Expedição e outros setores.
- Perfis de estação para identificar cada TV ou Raspberry Pi.
- Dashboard compartilhado com uma área específica ou com toda a empresa.
- Central de avisos com prioridade, agendamento, imagens e layout livre.
- Publicação direta de artes prontas como avisos de imagem em tela cheia.
- Avisos direcionados por área.
- Importação por planilha e exportação das configurações.
- Links específicos para cada estação usando a mesma página hospedada.
- Persistência compartilhada no Supabase.
- Cópia local para manter as TVs funcionando quando a internet cair.
- Atualização automática entre dispositivos a cada 10 segundos.
- Player nativo experimental para TVs com sistema Roku.

## Executar

Abra o arquivo `index.html` em um navegador baseado em Chromium.

Para uma TV, cadastre uma estação no painel, escolha a área e use a opção
**Copiar link desta estação**.

Exemplo após a hospedagem:

```text
https://seu-dominio.com/?station=station-123
```

## Formato da planilha

| Coluna | Conteúdo |
| --- | --- |
| A | Nome do dashboard |
| B | Link público do Power BI |
| C | Link de serviço do Power BI |
| D | Área, opcional |

## Hospedagem

O arquivo `index.html` pode ser publicado diretamente no GitHub Pages ou em
outro serviço de hospedagem estática.

## Configurar a base compartilhada

1. Abra o projeto no painel do Supabase.
2. Entre em **SQL Editor**.
3. Copie e execute o conteúdo de [`supabase/setup.sql`](supabase/setup.sql).
4. Abra ou recarregue o `index.html`.

Na primeira conexão, a configuração existente no navegador é enviada para a
base central. Depois disso, qualquer dispositivo que abrir o mesmo endereço
recebe os dashboards, áreas, estações e avisos salvos.

O perfil selecionado em cada TV continua sendo uma preferência local. Assim,
alterar a estação de um Raspberry não troca a estação dos demais.

## Avisos somente por imagem

Na seção **Avisos**, use **Postar imagem** para publicar uma arte pronta sem
preencher título, mensagem ou ação. A Central aceita PNG, JPEG e WebP de até
10 MB, reduz automaticamente para até 1920×1080 e permite escolher entre
mostrar a imagem inteira ou preencher a tela.

Para que a mesma imagem funcione no navegador e no aplicativo Roku, execute
uma vez [`supabase/alert_assets.sql`](supabase/alert_assets.sql) no SQL Editor
do Supabase. O arquivo cria o bucket público `alert-assets` e libera o envio
pela Central sem login, de acordo com o modelo interno atual do aplicativo.

Depois disso:

1. abra **Avisos** e escolha **Postar imagem**;
2. selecione o setor, período e duração;
3. escolha a imagem e aguarde a confirmação de envio;
4. salve o aviso.

Se o bucket ainda não estiver configurado, a Central mantém uma cópia local
para teste no navegador, mas o Roku precisa da URL HTTPS criada no Storage.

## Acompanhamento do PPR

A seção **PPR** da Central Web administra resultados manuais de 0% a 150%.
Ela começa desativada e já oferece seis modelos baseados no comunicado oficial:
produtividade de ligas normais, produtividade de ligas especiais, eficiência
líquida, índice de devoluções, lucratividade e auditorias de qualidade.

O administrador pode:

- ativar o módulo inteiro ou indicadores individualmente;
- editar nome, descrição, resultado decimal, referência, observação e ordem;
- registrar o valor realizado e a unidade exibida no gráfico;
- configurar faixas esperadas para 0%, 50%, 75%, 100%, 125% e 150%;
- calcular automaticamente o percentual ao informar somente o valor realizado;
- escolher tema claro ou escuro para as telas do PPR;
- configurar mensagens e cores das faixas de desempenho;
- identificar resultados pendentes ou desatualizados;
- escolher resumo, indicadores individuais ou painel geral;
- direcionar o conteúdo para setores e TVs específicas;
- definir posição e duração dentro da rotação;
- conferir a tela 16:9 antes de colocá-la no ar.

Os dados são salvos no campo `ppr` do mesmo `payload` central já existente.
Portanto, esta evolução não exige uma nova tabela nem altera os registros de
dashboards, avisos, setores ou estações.

O player Roku lê a mesma configuração. Depois de publicar a Central Web e
instalar o ZIP atualizado, as mudanças do PPR chegam automaticamente à TV na
próxima sincronização.

### Publicação e validação

1. Publique o `index.html` atualizado no repositório ligado à Vercel.
2. Aguarde o deploy de produção e abra a Central Web.
3. Entre em **PPR**, preencha os resultados e use **Visualizar em 16:9**.
4. Ative o módulo apenas depois de revisar os setores e TVs selecionados.
5. Para Roku, gere e reinstale `dist/Central_Dashboards_TVs_Roku.zip`.

Antes de publicar, execute:

```powershell
npm.cmd run capture:test
npm.cmd run ppr:test
npm.cmd run roku:check
npm.cmd run roku:package
```

## Aplicativo Roku

O protótipo do player nativo está na pasta [`roku`](roku). Ele usa o mesmo
Supabase da Central Web, mas funciona somente como visualizador:

- a Central Web continua sendo usada para cadastrar e atualizar o conteúdo;
- a TV escolhe uma estação usando o controle remoto;
- o Roku recebe a programação e filtra dashboards e avisos por área;
- a estação escolhida fica salva localmente na TV;
- alterações da Central são consultadas automaticamente a cada 10 segundos.

Como o Roku não possui o navegador usado pelo player web, cada dashboard pode
receber uma **Imagem para o aplicativo Roku**. O campo fica no formulário de
cadastro e também pode ser alterado pelo botão de TV na lista de dashboards.
A imagem deve estar publicada em HTTPS nos formatos PNG, JPEG ou WebP.

Para validar e gerar o arquivo instalável:

```powershell
npm.cmd install
npm.cmd run roku:check
npm.cmd run roku:package
```

O pacote será criado em `dist/Central_Dashboards_TVs_Roku.zip`. As instruções
de instalação por modo desenvolvedor estão em [`roku/README.md`](roku/README.md).

## Capturas automáticas para o Roku

O serviço em [`renderer`](renderer) abre os dashboards públicos do Power BI
em um Chromium automatizado, gera imagens 1920×1080 e atualiza o
`rokuImageUrl` usado pelo player Roku.

### Operação final, totalmente em nuvem

A função [`api/capture.mjs`](api/capture.mjs) executa o Chromium dentro da
Vercel. O Supabase Cron chama essa função a cada cinco minutos. Nenhum PC ou
Raspberry precisa permanecer ligado.

Fluxo:

```text
Power BI -> Chromium na Vercel -> Supabase Storage -> aplicativo Roku
```

Configuração:

1. Execute [`supabase/roku_snapshots.sql`](supabase/roku_snapshots.sql) e,
   depois, [`supabase/roku_snapshots_secure.sql`](supabase/roku_snapshots_secure.sql).
2. Na Vercel, adicione as variáveis descritas em
   [`.env.vercel.example`](.env.vercel.example). A chave
   `SUPABASE_RENDERER_KEY` deve ser uma chave secreta do Supabase e nunca uma
   chave pública.
3. Faça o deploy de produção e confirme que `/api/capture` existe.
4. Edite e execute [`supabase/cloud_capture_cron.sql`](supabase/cloud_capture_cron.sql)
   para recriar um único agendamento a cada dois minutos. A função processa
   no máximo dois dashboards por chamada, prioriza os mais antigos e salva
   cada resultado imediatamente, evitando perder o ciclo inteiro por timeout.
5. Use [`supabase/cloud_capture_diagnostics.sql`](supabase/cloud_capture_diagnostics.sql)
   para conferir as execuções do Cron, respostas HTTP e idade das imagens.

O endpoint aceita somente `POST` autenticado por
`Authorization: Bearer CAPTURE_API_SECRET`. A chave secreta do Supabase fica
somente nas variáveis protegidas da Vercel. O ZIP do Roku não contém essas
credenciais.

### Teste local opcional

O teste local abaixo é útil apenas durante o desenvolvimento; não faz parte da
operação final:

1. Execute [`supabase/roku_snapshots.sql`](supabase/roku_snapshots.sql) no SQL
   Editor do projeto.
2. Instale o Chromium do capturador:

```powershell
npm.cmd install
npm.cmd run capture:install-browser
```

3. Valide localmente:

```powershell
npm.cmd run capture:once -- --local-only
```

4. Se quiser testar repetição local temporariamente:

```powershell
npm.cmd run capture:watch
```

Consulte [`renderer/README.md`](renderer/README.md) para intervalos, recorte,
diagnóstico e endurecimento de segurança para produção.

## Segurança

Evite usar a opção **Publicar na Web** do Power BI para dados confidenciais.
Utilize somente links e métodos de acesso compatíveis com as políticas da
empresa.

O modelo atual permite leitura e alteração sem login, conforme o uso interno
previsto. Por esse motivo, restrinja o endereço do app à rede interna. Se o
site ficar público na internet, qualquer pessoa que descobrir o endereço poderá
alterar a programação.
