# Vulkan Sentinel

Vulkan Sentinel is a TypeScript bot that connects Discord and Twitch into a single operational layer. It handles account linking, Twitch chat automation, Discord moderation tooling, Firecoins point management, scheduled bonus events, ticket support flows, live notifications, and audit logging.

## Overview

The project is built around two runtime fronts:

- Discord, powered by `discord.js`
- Twitch chat, powered by `tmi.js`

Both fronts share the same business services for user state, Firecoins, event scheduling, transfer validation, and persistence. Prisma is used for the data layer, while Express handles Twitch OAuth and EventSub webhooks.

## Core Capabilities

- Discord <-> Twitch account linking through Twitch OAuth
- Twitch chat bridge into Discord
- Firecoins points system with stackable multipliers
- Scheduled points events synced with a Discord guild event
- Firecoins transfers with audit logs
- Discord ticket panel and ticket transfer flow
- Viewer activity tracking and periodic points rewards
- Main stream and partner live notifications
- Discord rules publishing command
- Twitch EventSub webhook support

## Tech Stack

- TypeScript
- Node.js
- discord.js
- tmi.js
- Prisma
- PostgreSQL
- Express
- zod
- @constatic/base

## Project Structure

```text
src/
  database/      Prisma client bootstrap
  discord/       Discord commands, events, responders
  server/        Express routes for OAuth and EventSub
  services/      Shared business logic and integrations
  shared/        Shared runtime utilities
  twitch/        Twitch commands, events, client bootstrap
```

Important files:

- `src/index.ts`: main app bootstrap and graceful shutdown
- `src/twitch/index.ts`: Twitch client bootstrap and chat command dispatch
- `src/server/server.ts`: HTTP server, Twitch OAuth callback, EventSub endpoint
- `src/services/channelPoints.ts`: Firecoins event state and multiplier engine
- `src/services/channelPointsAdmin.ts`: admin-facing event and multiplier controls
- `src/services/channelPointTransfers.ts`: shared transfer workflow and audit logging
- `src/services/tickets.ts`: Discord tickets workflow

## Environment Variables

Required:

- `BOT_TOKEN`
- `DATABASE_URL`
- `GUILD_BOT_CHANNEL_ID`
- `TWITCH_CHANNEL`
- `TWITCH_BROADCASTER_ID`
- `TWITCH_USERNAME`
- `TWITCH_REDIRECT_URI`

Recommended:

- `GUILD_ID`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_REFRESH_TOKEN`
- `TWITCH_BOT_ID`
- `TWITCH_EVENTSUB_CALLBACK`
- `TWITCH_EVENTSUB_SECRET`
- `INTEGRATION_LOGS_CHANNEL_ID`

## Local Setup

Install dependencies:

```bash
npm install
```

Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

Run in development:

```bash
npm run dev
```

Type-check the project:

```bash
npm run check
```

## Runtime Scripts

- `npm run dev`: run with `.env`
- `npm run dev:dev`: run with `.env.dev`
- `npm run watch`: watch mode with `.env`
- `npm run watch:dev`: watch mode with `.env.dev`
- `npm run build`: compile TypeScript and copy generated Prisma client
- `npm run start`: run compiled output
- `npm run check`: TypeScript validation

## Discord Commands

### Public / Utility

- `/ping`
- `/link`
- `/profile [user]`
- `/live`
- `/warn [usuario|alvo] motivo:<texto>`
- `/transferir <admin>`
- `/regras`

### Firecoins / Points

- `/pontos`
- `/pay usuario:<DiscordUser|DiscordID|TwitchID|TwitchNickname> valor:<int>`
- `/basemultiply valor:<number>`
- `/eventstart name:<nome> tempo:<30m|2h|1d> multiplicador:<valor> descricao:<opcional>`
- `/eventstop`
- `/pointstatus`

Administrative Discord commands are permission-gated with Discord permissions.

## Twitch Commands

### Public

- `!discord`
- `!pontos`
- `!events`
- `!warn <usuario> <motivo>`
- `!pay <DiscordUser|DiscordID|TwitchID|TwitchNickname> <valor>`
- `!test`

### Administrative

- `!basemultiply <valor>`
- `!eventstart <tempo> <multiplicador> <nome> | <descricao opcional>`
- `!eventstop`

Administrative Twitch commands are limited to moderators and the broadcaster.

## Firecoins System

Firecoins are influenced by:

- base multiplier
- Twitch subscriber bonus
- Discord booster bonus
- per-user balance multiplier
- scheduled event multiplier

Points are granted based on viewer activity while the stream is live. The active multiplier breakdown is reused across Discord and Twitch surfaces.

## Scheduled Points Events

The scheduled event flow is shared across Discord and Twitch:

1. An admin schedules an event with duration, multiplier, name, and optional description.
2. The bot creates a Discord guild scheduled event for the same window.
3. The Firecoins multiplier activates when that event window starts.
4. Twitch chat receives a start notification when the event becomes active.
5. The event ends on both the bot and the guild event side together.
6. Manual closure of the guild event syncs back to the bot.

Discord guild event details:

- event name matches the admin-provided event name
- location points to `https://twitch.tv/<channel>`
- description contains the optional admin description plus the multiplier

## Firecoins Transfers

Transfers support both Discord and Twitch entry points through one shared service.

Validation rules include:

- sender must exist in the database
- target must exist in the database
- amount must be an integer
- self-transfer is blocked
- insufficient balance is blocked

All successful transfers are logged to a Discord audit channel with:

- source platform
- sender and receiver identities
- amount
- sender balance before/after
- receiver balance before/after

## Tickets

The Discord ticket system includes:

- panel publishing
- category-based ticket creation
- metadata tracking
- responsible staff assignment
- transfer between administrators
- transcript generation and archival logging

## Twitch Integration

Twitch integration currently covers:

- chat command handling
- Twitch OAuth account linking
- Helix lookups for user resolution
- EventSub webhook processing
- viewer activity tracking
- live status checks
- partner live notifications

## Data Model

The main persisted model is `User`, which currently includes:

- `discordId`
- `twitchId`
- `currentWarns`
- `totalWarns`
- `totalPunishments`
- `isTwitchSub`
- `isDiscordBooster`
- `hoursWatched`
- `balance`
- `balancemultiplier`
- `lastSeenInChat`
- timestamps

## Operational Notes

- A Discord account can only be linked to one Twitch account.
- A Twitch account can only be linked to one Discord account.
- Relinking should be handled administratively when needed.
- Current points event runtime state is handled in memory.
- Transfer and event activity include console logging for auditability.
- Progressive moderation logs are sent to Discord instead of being stored in the database.

## Security Notes

- Do not commit real `.env` secrets.
- Keep Twitch client secrets and refresh tokens private.
- Register the exact OAuth callback and EventSub webhook URLs in the Twitch developer console.
- Use the minimum Discord permissions required for the bot.
- For Twitch moderation commands, the user token must include moderation scopes compatible with Helix bans/timeouts.

## Current Status

The project is actively evolving and already provides a strong cross-platform foundation for:

- loyalty and rewards systems
- live community operations
- moderation support
- support ticket workflows
- Discord/Twitch automation
