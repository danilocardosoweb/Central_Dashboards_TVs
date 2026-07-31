# Player Roku — protótipo

Aplicativo nativo Roku para exibir a programação criada na Central de
Dashboards. Esta primeira versão não usa login e lê a linha `central` da tabela
`tv_app_state` no Supabase.

## O que já funciona

- Leitura automática do Supabase a cada 10 segundos.
- Seleção da estação com o controle remoto.
- Persistência da estação escolhida na própria TV.
- Filtro de dashboards e avisos pela área da estação.
- Rotação automática, pausa e navegação manual.
- Avisos em tela cheia e avisos em faixa inferior.
- Imagens remotas em HTTPS para dashboards.
- Interface adaptada para televisores HD e Full HD.
- Continuidade da programação em memória quando uma sincronização falha.

## Controles

- `*`: escolher a estação.
- `←` e `→`: trocar a tela.
- `OK` ou `Play/Pause`: pausar ou continuar.

## Limitação do Power BI

O Roku não renderiza o `iframe` do Power BI. Para testar um dashboard real,
abra a Central Web, clique no botão de TV ao lado do dashboard e informe um
link direto HTTPS para uma imagem PNG, JPEG ou WebP.

Se não houver uma imagem, o player mostra um cartão com o nome do dashboard e
informa que a captura ainda está pendente.

## Gerar o pacote

Na raiz do repositório:

```powershell
npm.cmd install
npm.cmd run roku:check
npm.cmd run roku:package
```

O arquivo para instalar será criado em:

```text
dist/Central_Dashboards_TVs_Roku.zip
```

## Instalar na TV

1. Ative o modo desenvolvedor da TV Roku.
2. Abra no navegador o endereço IP mostrado pela TV.
3. Entre com o usuário `rokudev` e a senha configurada.
4. Envie o ZIP da pasta `dist`.
5. Pressione **Install**.

Somente um aplicativo instalado por sideload pode permanecer na TV de cada
vez.
