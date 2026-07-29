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
- Persistência local das configurações no navegador.

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

As áreas, estações e configurações atualmente são armazenadas no navegador de
cada dispositivo. Sincronização remota em tempo real exige uma base central em
nuvem, prevista para uma próxima etapa.

## Segurança

Evite usar a opção **Publicar na Web** do Power BI para dados confidenciais.
Utilize somente links e métodos de acesso compatíveis com as políticas da
empresa.
