# LGPD no Vulkan Sentinel

Este projeto trata dados pessoais para operar a integracao Discord/Twitch, sistema de pontos, moderacao e tickets. Esta pagina resume os controles minimos implementados no codigo e o que precisa ser configurado em ambiente para uma operacao mais aderente a LGPD.

## Dados tratados

- `discordId` e `twitchId` para vinculacao e identificacao da conta.
- saldo, multiplicadores, horas assistidas e status de sub/booster para o sistema de recompensas.
- contadores de warns e punicoes para moderacao.
- transcripts de tickets e logs operacionais quando o fluxo de suporte e moderacao exige rastreabilidade.

## Controles implementados

- minimizacao de exibicao de identificadores tecnicos no perfil.
- exportacao dos dados do titular via comando `/lgpd` -> `Exportar meus dados`.
- abertura de solicitacoes de exclusao, correcao e revogacao via `/lgpd`.
- aviso publico em `/privacidade` e opcionalmente em `PRIVACY_POLICY_URL`.
- protecao do `state` no OAuth de vinculacao Discord/Twitch com assinatura e validade curta.
- retencao configuravel para mensagens de transcript e log final de tickets com `TICKET_TRANSCRIPT_RETENTION_DAYS`.

## Configuracao recomendada

Defina no ambiente:

- `PRIVACY_CONTACT_EMAIL`: canal publico para atender titulares.
- `PRIVACY_POLICY_URL`: URL publica do aviso, se quiser expor fora da rota interna `/privacidade`.
- `TICKET_TRANSCRIPT_RETENTION_DAYS`: prazo maximo de retencao dos transcripts e logs de ticket.
- `WEB_SESSION_SECRET`: segredo dedicado para assinar cookies e estados.

## Operacao

- revise se a base legal de cada tratamento esta documentada internamente.
- publique quem e o controlador e quem atende titulares.
- mantenha processo para responder requisicoes do art. 18.
- registre e comunique incidentes de seguranca conforme art. 48 e regulamento da ANPD.
- valide se os canais de log do Discord possuem acesso restrito ao minimo necessario.

## Limites

Este pacote melhora a aderencia tecnica, mas nao substitui avaliacao juridica do caso concreto, definicao formal de bases legais, contratos com operadores e governanca organizacional.
