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
- Avisos direcionados por área.
- Importação por planilha e exportação das configurações.
- Links específicos para cada estação usando a mesma página hospedada.
- Persistência compartilhada no Supabase.
- Cópia local para manter as TVs funcionando quando a internet cair.
- Atualização automática entre dispositivos a cada 10 segundos.

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

## Segurança

Evite usar a opção **Publicar na Web** do Power BI para dados confidenciais.
Utilize somente links e métodos de acesso compatíveis com as políticas da
empresa.

O modelo atual permite leitura e alteração sem login, conforme o uso interno
previsto. Por esse motivo, restrinja o endereço do app à rede interna. Se o
site ficar público na internet, qualquer pessoa que descobrir o endereço poderá
alterar a programação.
