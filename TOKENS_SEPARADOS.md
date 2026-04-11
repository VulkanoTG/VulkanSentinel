# Separacao de Tokens e Credenciais

Este arquivo serve para identificar de onde vem cada credencial usada no projeto.
Nao coloque valores reais aqui.

## Discord

- `BOT_TOKEN`
  Origem: Discord Developer Portal.
  Uso: login do bot do Discord.

- `GUILD_ID`
  Origem: Discord.
  Uso: servidor principal.

- `GUILD_BOT_CHANNEL_ID`
  Origem: Discord.
  Uso: canal padrao usado pelo bot.

- `INTEGRATION_LOGS_CHANNEL_ID`
  Origem: Discord.
  Uso: canal para logs da integracao Twitch -> Discord.

## Twitch App - dev.twitch.tv

Esses dados vem do app criado no painel de desenvolvedor da Twitch.

- `TWITCH_CLIENT_ID`
  Origem: `dev.twitch.tv/console/apps`
  Uso: chamadas Helix, OAuth e EventSub.

- `TWITCH_CLIENT_SECRET`
  Origem: `dev.twitch.tv/console/apps`
  Uso: trocar `code` por token no callback OAuth e renovar token com refresh token.

- `TWITCH_REDIRECT_URI`
  Origem: URL cadastrada no app da Twitch.
  Uso: callback OAuth em `/auth/twitch/callback`.

- `TWITCH_EVENTSUB_CALLBACK`
  Origem: URL publica do app hospedado.
  Uso: webhook EventSub em `/webhook/twitch/eventsub`.

- `TWITCH_EVENTSUB_SECRET`
  Origem: definido por voce.
  Uso: validar assinatura HMAC do EventSub.
  Observacao: nao vem da Twitch; e um segredo proprio do projeto.

## Twitch - identificadores

- `TWITCH_CHANNEL`
  Origem: Twitch.
  Uso: canal onde o bot conecta no chat.

- `TWITCH_BROADCASTER_ID`
  Origem: Twitch Helix / painel / consulta manual.
  Uso: consultar stream, seguidores e EventSub.

- `TWITCH_USERNAME`
  Origem: conta Twitch usada pelo bot de chat.
  Uso: login do `tmi.js`.

- `TWITCH_BOT_ID`
  Origem: ID numerico da conta Twitch usada pelo bot.
  Uso: whisper e endpoints que exigem moderator/user id.

## Twitch - tokens de usuario

Aqui esta a parte que costuma confundir.

- `TWITCH_REFRESH_TOKEN`
  Origem: fluxo OAuth da Twitch.
  Como obter: normalmente ao autorizar a conta via OAuth. Muitas pessoas usam um gerador para facilitar, mas o token em si continua sendo um token OAuth da Twitch.
  Uso: renovar automaticamente o access token.

- `TWITCH_USER_TOKEN`
  Origem: access token de usuario da Twitch.
  Como obter: pode vir de um gerador como Twitch Token Generator ou de um fluxo OAuth proprio.
  Uso: fallback quando `TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET + TWITCH_REFRESH_TOKEN` nao estao configurados.
  Observacao: e temporario e pode expirar; por isso o projeto prefere refresh token.

## O que o projeto usa hoje

Pelo codigo:

- Se existir `TWITCH_REFRESH_TOKEN` junto com `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET`, o projeto renova o token automaticamente.
- Se esse trio nao existir, ele cai para `TWITCH_USER_TOKEN`.

Arquivos principais:

- `src/services/twitchAuth.ts`
- `src/twitch/index.ts`
- `src/server/server.ts`

## Estado atual do seu `.env`

As chaves encontradas no `.env` mostram que hoje voce esta usando:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_REFRESH_TOKEN`
- `TWITCH_BOT_ID`
- `TWITCH_REDIRECT_URI`
- `TWITCH_EVENTSUB_CALLBACK`
- `TWITCH_EVENTSUB_SECRET`

E nao foi encontrado:

- `TWITCH_USER_TOKEN`

Ou seja: no estado atual, seu projeto esta configurado para usar o fluxo de refresh token, nao o token fixo de gerador.

## Mapeamento rapido

- `dev.twitch.tv`: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, configuracao de `TWITCH_REDIRECT_URI`
- OAuth/Twitch Token Generator: `TWITCH_REFRESH_TOKEN`, `TWITCH_USER_TOKEN`
- Definido por voce: `TWITCH_EVENTSUB_SECRET`
- Dados da conta/canal Twitch: `TWITCH_CHANNEL`, `TWITCH_USERNAME`, `TWITCH_BROADCASTER_ID`, `TWITCH_BOT_ID`

## Importante

Se o Copilot realmente misturou ou expôs credenciais, o mais seguro e:

1. Regenerar `BOT_TOKEN` no Discord.
2. Regenerar `TWITCH_CLIENT_SECRET` no app da Twitch.
3. Gerar um novo `TWITCH_REFRESH_TOKEN`.
4. Atualizar `TWITCH_EVENTSUB_SECRET`.
5. Trocar a `DATABASE_URL` se ela tambem foi exposta.
