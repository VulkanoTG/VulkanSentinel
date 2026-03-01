# Vulkan Sentinel

Vulkan Sentinel é um bot integrado para **Discord** e **Twitch**, escrito em TypeScript, que conecta o chat da Twitch ao seu servidor Discord, além de oferecer uma base para comandos e integrações adicionais.

### Funcionalidades

- **Bot de Discord** usando `discord.js` e `@constatic/base`.
- **Bot de Twitch (tmi.js)** com:
  - Conexão via OAuth.
  - Sistema de comandos via chat (ex.: `!test`).
  - Encaminhamento de mensagens da Twitch para um canal de logs no Discord.
- **Integração com Twitch Helix**:
  - Envio de whispers (`sendTwitchWhisper`).
  - Resolução de usuários da Twitch via API Helix.
- **Renovação automática de token da Twitch**:
  - Utiliza `TWITCH_REFRESH_TOKEN` + `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` para obter novos access tokens.
  - Fallback para `TWITCH_USER_TOKEN` quando o refresh não estiver configurado.

---

## Requisitos

- Node.js 18+.
- Conta de desenvolvedor na **Twitch** com um aplicativo registrado.
- Bot de **Discord** criado e adicionado ao seu servidor.

---

## Instalação

```bash
pnpm install  # ou npm install / yarn install
```

---

## Configuração de ambiente

O projeto usa um arquivo `.env` (baseado em `.env.example`). Campos principais:

```env
BOT_TOKEN=                # Token do bot do Discord
GUILD_ID=                 # (opcional) ID da guild principal
GUILD_BOT_CHANNEL_ID=     # Canal padrão do bot no Discord

INTEGRATION_LOGS_CHANNEL_ID= # Canal de logs de integrações no Discord

TWITCH_CHANNEL=           # Nome do canal do streamer que o bot vai monitorar
TWITCH_USERNAME=          # Nome de usuário do bot da Twitch
TWITCH_CLIENT_ID=         # Client ID do app Twitch
TWITCH_USER_TOKEN=        # (opcional) Token fixo do bot (oauth sem prefixo)
TWITCH_BOT_ID=            # ID numérico do bot na Twitch
TWITCH_CLIENT_SECRET=     # Secret do app Twitch (para refresh)
TWITCH_REFRESH_TOKEN=     # Refresh token da Twitch
TWITCH_REDIRECT_URI=      # twitch bot redirectURL
DATABASE_URL=             # Database URL
```

### Como funciona o refresh do token da Twitch

- Arquivo `src/services/twitchAuth.ts`:
  - Tenta usar um token em cache.
  - Se não houver, faz `POST https://id.twitch.tv/oauth2/token` com `grant_type=refresh_token`.
  - Armazena o `access_token` em memória e o reutiliza.
  - Se algo falhar, volta a usar `TWITCH_USER_TOKEN`.
- Esse token é usado:
  - No **login do bot de Twitch** (`src/twitch/index.ts`), convertido para o formato `oauth:<token>` exigido pelo `tmi.js`.
  - Nas chamadas da **API Helix** em `src/services/twitchHelix.ts`.

> Importante: para que o refresh funcione, o `TWITCH_REFRESH_TOKEN` precisa ter sido obtido com os escopos corretos (por exemplo `chat:read`, `chat:edit`, `user:manage:whispers`, etc., conforme o que você usa).

---

## Scripts

Definidos em `package.json`:

- **`pnpm dev`**: roda o bot em modo desenvolvimento usando `tsx` e `.env`.
- **`pnpm dev:dev`**: roda usando `.env.dev`.
- **`pnpm watch`**: watch em desenvolvimento com `.env`.
- **`pnpm watch:dev`**: watch com `.env.dev`.
- **`pnpm build`**: compila TypeScript para `build/`.
- **`pnpm start`**: executa a versão compilada (`node --env-file=.env .`).

Adapte os comandos para `npm`/`yarn` se não estiver usando `pnpm`.

---

## Estrutura principal

- `src/index.ts`: ponto de entrada; faz o `bootstrap` do Discord (`@constatic/base`) e carrega o módulo da Twitch.
- `src/services/discord.ts`: gerenciamento do cliente do Discord + helpers para enviar mensagens/embeds.
- `src/twitch/index.ts`: inicializa o cliente `tmi.js`, conecta ao chat e registra o listener de mensagens/comandos.
- `src/twitch/events/listener.ts`: trata mensagens comuns do chat (por exemplo, repassa para o Discord).
- `src/twitch/commands/`: comandos de chat da Twitch (ex.: `test`).
- `src/services/twitchHelix.ts`: integração com a API Helix (whispers, resolução de usuários).
- `src/services/twitchAuth.ts`: lógica de obtenção/refresh de token da Twitch.

---

## Desenvolvimento

```bash
pnpm dev
```

Isso irá:
- Carregar o `.env`.
- Subir o bot de Discord.
- Conectar o bot da Twitch ao canal configurado.

Durante o desenvolvimento, use:
- **`pnpm watch`** para recarregar automaticamente em mudanças.

---

## Observações de segurança

- Nunca faça commit do seu `.env` real (ele contém tokens e secrets).
- Limite as permissões do bot da Twitch e do Discord apenas ao necessário.
- Gere um novo `TWITCH_REFRESH_TOKEN`/`TWITCH_CLIENT_SECRET` se suspeitar que foram expostos.

# Vulkan Sentinel

Bot integrado **Discord + Twitch** com sistema de bridge de mensagens e vinculação de contas.

---

## 📌 Funcionalidades

- 🔁 Bridge de mensagens da Twitch → Discord  
- 💬 Sistema modular de comandos para Twitch  
- 🔐 Vinculação segura de conta Discord ↔ Twitch  
- 🗄️ Persistência de dados com Prisma  
- 🧱 Estrutura modular e escalável  

---

## 🛠️ Tecnologias

- Node.js  
- TypeScript  
- Prisma  
- tmi.js  
- discord.js  
- Constatic  

---

## ⚙️ Instalação

### 1️⃣ Instalar dependências

```bash
npm install
```

### 2️⃣ Criar arquivo `.env`

```env
BOT_TOKEN=
GUILD_ID=
INTEGRATION_LOGS_CHANNEL_ID=
TWITCH_CHANNEL=
TWITCH_USERNAME=
TWITCH_CLIENT_ID=
TWITCH_USER_TOKEN=
TWITCH_BOT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_REFRESH_TOKEN=
TWITCH_REDIRECT_URI=

DATABASE_URL=
```

### 3️⃣ Configurar o banco de dados

```bash
npx prisma generate
npx prisma migrate dev
```

---

## ▶️ Executar

### Desenvolvimento

```bash
npx tsx src/index.ts
```

### Produção

```bash
tsc
node build/index.js
```

---

## 🔐 Sistema de Link

Comando:

```
/link <twitchNick>
```

Fluxo:

1. Gera token único  
2. Envia via sussurro na Twitch  
3. Usuário confirma no Discord  
4. Conta é vinculada permanentemente  

Regras:

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