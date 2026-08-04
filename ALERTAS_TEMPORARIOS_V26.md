# Alertas temporários Roku — V26

## Resultado visual

A faixa da TV usa um cartão executivo nativo do Roku: fundo azul-marinho,
sinalizador colorido por prioridade, categoria, título, mensagem, ação esperada
e identificação do público ou responsável. O texto nunca pisca; os efeitos de
destaque são aplicados somente à barra lateral e ao bloco do ícone.

## Configurações disponíveis na Central

- tamanho: compacta, padrão ou destaque;
- posição: parte inferior ou superior;
- texto: fixo, rolante ou automático;
- velocidade da rolagem: lenta, normal ou rápida;
- entrada: subir, deslizar da direita ou aparecer suavemente;
- destaque: nenhum, pulso suave ou piscar sinalizador;
- dashboard: reduzir, escurecer ou manter sem alteração;
- duração e número de repetições;
- destino: todas as TVs, um setor ou uma TV.

Configuração recomendada para uso diário: faixa padrão na parte inferior,
rolagem normal, entrada suave, pulso e dashboard reduzido. Para mensagens
críticas, use faixa grande e piscar sinalizador.

## Comportamento técnico

O alerta usa `Rectangle`, `Label`, `ScrollingLabel`, `Animation` e `Timer` do
SceneGraph. Sua fila permanece independente do carrossel, portanto a tela atual
não é recarregada e o temporizador dos dashboards não é reiniciado. Falhas no
alerta ou no histórico não interrompem o conteúdo principal.

## Teste manual

1. Crie um aviso em `Faixa inferior` e direcione para a TV em teste.
2. Escolha duração de 20 segundos e uma repetição.
3. Salve e sincronize a Central.
4. Aguarde a próxima consulta do Roku e confirme a exibição.
5. Repita com texto longo e modo rolante.
6. Teste os efeitos `Pulso suave` e `Piscar sinalizador`.
7. Confirme que o dashboard continua trocando normalmente após o alerta.

## Pacote

`dist/Central_Dashboard_TVs_Roku_V_26.zip`

As versões anteriores permanecem preservadas para retorno e comparação.
