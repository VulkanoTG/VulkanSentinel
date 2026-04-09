# Vulkan Sentinel

Vulkan Sentinel é um bot integrado de **Discord + Twitch** escrito em TypeScript. Ele unifica chat, comandos, tickets e dados de usuário entre as duas plataformas, com suporte a OAuth, EventSub, sistema de pontos e notificações.

---

## 📌 Funcionalidades principais

- ✅ Integração Discord + Twitch
- ✅ Ponte de mensagens Twitch → Discord
- ✅ Comandos de chat Twitch: `!discord`, `!test`
- ✅ Slash commands Discord: `/ping`, `/link`, `/profile`, `/live`, `/transferir`
- ✅ Vinculação de conta Discord ↔ Twitch via OAuth
- ✅ Painel de tickets Discord com abertura, aceitação e transferência
- ✅ Monitoramento de viewers ativos e recompensa de pontos
- ✅ Notificações de live de parceiros
- ✅ Suporte a Twitch EventSub via webhook
- ✅ Persistência de dados com Prisma + PostgreSQL

---

## 🚀 Requisitos

- Node.js 18+
- PostgreSQL
- App Twitch registrado
- Bot Discord criado e adicionado ao servidor
- URL pública para o callback `/auth/twitch/callback` e webhook EventSub

---

## 🧩 Tecnologias

- Node.js
- TypeScript
- Prisma
- discord.js
- tmi.js
- express
- @constatic/base
- zod

---

## ⚙️ Instalação

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar banco de dados

```bash
npx prisma generate
npx prisma migrate dev
```

### 3. Criar arquivo `.env`

Crie um arquivo `.env` na raiz do projeto com as variáveis necessárias.

---

## ✅ Variáveis de ambiente

Variáveis obrigatórias:

- `BOT_TOKEN` — Token do bot Discord
- `GUILD_BOT_CHANNEL_ID` — Canal Discord para envios do bot
- `DATABASE_URL` — URL do banco PostgreSQL
- `TWITCH_CHANNEL` — Canal do streamer monitorado
- `TWITCH_BROADCASTER_ID` — ID numérico do broadcaster Twitch
- `TWITCH_USERNAME` — Nome de usuário do bot Twitch
- `TWITCH_REDIRECT_URI` — Callback URL do OAuth Twitch

Variáveis opcionais:

- `TWITCH_CLIENT_ID` — Client ID do app Twitch
- `TWITCH_CLIENT_SECRET` — Secret do app Twitch
- `TWITCH_REFRESH_TOKEN` — Refresh token para renovar o access token Twitch
- `TWITCH_USER_TOKEN` — Token fixo do bot Twitch (fallback)
- `TWITCH_BOT_ID` — ID numérico do bot Twitch
- `TWITCH_EVENTSUB_CALLBACK` — URL pública do webhook EventSub
- `TWITCH_EVENTSUB_SECRET` — Segredo HMAC do EventSub
- `INTEGRATION_LOGS_CHANNEL_ID` — Canal Discord para logs de mensagens Twitch
- `GUILD_ID` — Guild principal (uso para verificar boosters)

> Para renovar tokens automaticamente, use `TWITCH_REFRESH_TOKEN` com `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET`. Caso contrário, o bot usa `TWITCH_USER_TOKEN` como fallback.

---

## ▶️ Scripts disponíveis

- `npm run dev` — executa em desenvolvimento usando `tsx` e `.env`
- `npm run dev:dev` — executa com `.env.dev`
- `npm run watch` — watch mode com `.env`
- `npm run watch:dev` — watch mode com `.env.dev`
- `npm run build` — compila TypeScript
- `npm run start` — executa a versão compilada
- `npm run check` — valida o TypeScript

---

## 🧠 Arquitetura do projeto

- `src/index.ts` — boot do Discord e inicialização geral
- `src/twitch/index.ts` — cliente Twitch, bot, comandos e listeners
- `src/server/server.ts` — servidor Express para OAuth Twitch e EventSub
- `src/services/discord.ts` — helpers para envio de mensagens/embeds no Discord
- `src/services/twitchAuth.ts` — token management e refresh da Twitch
- `src/services/twitchHelix.ts` — chamadas à API Helix Twitch
- `src/services/tickets.ts` — painel e fluxo de tickets Discord
- `src/services/channelPoints.ts` — cálculo de pontos e bônus do usuário
- `src/twitch/events/` — notificações de live, parceiros e tracker de viewership
- `src/discord/commands/public/` — comandos públicos do Discord
- `src/twitch/commands/` — comandos de chat Twitch

---

## 💬 Comandos disponíveis

### Discord

- `/ping` — resposta de teste com botão interativo
- `/link` — gera link OAuth para vincular Twitch ao Discord
- `/profile [user]` — mostra perfil com saldo, horas assistidas e bônus
- `/live` — verifica se a live está online
- `/transferir <admin>` — transfere o ticket atual para outro administrador

### Twitch

- `!discord` — envia convite/link do Discord no chat Twitch
- `!test` — comando de teste que também publica embed no Discord

---

## 🔌 Fluxos e integrações

- Twitch chat → Discord: mensagens do chat Twitch são enviadas para `INTEGRATION_LOGS_CHANNEL_ID`
- EventSub: processado em `/webhook/twitch/eventsub`
- OAuth Twitch: callback em `/auth/twitch/callback` vincula a conta
- Viewer tracker: atualiza atividade de chat e recompensa pontos periodicamente
- Ticket panel: botão em Discord cria ticket com modal e ações de aceitação/fechamento
- Parceiros: o bot notifica quando canais parceiros entram em live

---

## 🗄️ Banco de dados

O modelo principal `User` em `prisma/schema.prisma` contém:

- `discordId`
- `twitchId`
- `isTwitchSub`
- `isDiscordBooster`
- `hoursWatched`
- `balance`
- `lastSeenInChat`

---

## 🔒 Segurança

- Não versionar `.env` reais
- Use permissões mínimas para bot Discord e app Twitch
- Regenerar `TWITCH_CLIENT_SECRET`/`TWITCH_REFRESH_TOKEN` se expostos
- Verifique se a callback Twitch está registrada corretamente no app Twitch

---

## 📌 Personalização rápida

- Adicione comandos Twitch em `src/twitch/commands/`
- Adapte comandos Discord em `src/discord/commands/public/`
- Configure parceiros em `src/twitch/events/partnerNotifier.ts`
- Personalize o painel de tickets em `src/services/tickets.ts`

---

## 💡 Observações finais

Este projeto já suporta integrações multiplataforma e pode servir como base para:

- sistema de fidelidade/recompensas
- atendimento via tickets
- notificações de live e parceiros
- automações entre Discord e Twitch


- Um Discord só pode ter uma Twitch vinculada  
- Uma Twitch só pode estar vinculada a um Discord  
- Relink só pode ser feito manualmente por administrador  

---

## 📂 Estrutura Simplificada

```
src/
 ├── discord/
 ├── twitch/
 ├── modules/
 ├── services/
 └── prisma/
```

---

🚧 Projeto em desenvolvimento.