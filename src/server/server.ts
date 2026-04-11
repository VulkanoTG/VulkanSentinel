import { prisma } from "#database";
import { appConfig, env } from "#config";
import type { GuildMember } from "discord.js";
import express from "express";
import { getDiscordClient } from "../services/discord.js";
import {
  ensureEventSubSubscriptions,
  handleEventSubNotification,
  parseEventSubMessageType,
  verifyEventSubSignature,
} from "../services/twitchEventSub.js";

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type TwitchUserResponse = {
  data: {
    id: string;
    login: string;
    display_name: string;
  }[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const app = express();

app.use(
  express.json({
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
    },
  })
);

app.get("/", (_req, res) => {
  res.send("Server running.");
});

app.post("/webhook/twitch/eventsub", async (req, res) => {
  const rawBody = (req as express.Request & { rawBody?: string }).rawBody ?? "";
  const messageType = parseEventSubMessageType(req.headers);

  if (!messageType) {
    return res.status(400).send("Tipo de mensagem EventSub invalido.");
  }

  const isValid = verifyEventSubSignature(req.headers, rawBody);
  if (!isValid) {
    return res.status(403).send("Assinatura EventSub invalida.");
  }

  const body = req.body as { challenge?: string };

  if (messageType === "webhook_callback_verification") {
    if (!body.challenge) {
      return res.status(400).send("Challenge ausente.");
    }

    return res.status(200).type("text/plain").send(body.challenge);
  }

  if (messageType === "revocation") {
    console.warn("[EventSub] Subscription revogada:", req.body);
    return res.status(204).send();
  }

  try {
    await handleEventSubNotification(req.body);
    return res.status(204).send();
  } catch (error) {
    console.error("Erro processando notification EventSub:", error);
    return res.status(500).send("Erro interno ao processar EventSub.");
  }
});

app.get("/auth/twitch/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Codigo ou state ausente.");
  }

  try {
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID!,
        client_secret: env.TWITCH_CLIENT_SECRET!,
        code: code as string,
        grant_type: "authorization_code",
        redirect_uri: env.TWITCH_REDIRECT_URI,
      }),
    });

    const tokenData = (await tokenResponse.json()) as TwitchTokenResponse;

    if (!tokenData.access_token) {
      console.error(tokenData);
      return res.status(400).send("Erro ao obter access token.");
    }

    const accessToken = tokenData.access_token;

    const userResponse = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": env.TWITCH_CLIENT_ID!,
      },
    });

    const userData = (await userResponse.json()) as TwitchUserResponse;
    const twitchUser = userData.data?.[0];

    if (!twitchUser) {
      return res.status(400).send("Usuario da Twitch nao encontrado.");
    }

    const twitchId = twitchUser.id;
    const discordId = state as string;
    let isDiscordBooster = false;
    let linkedMember: GuildMember | null = null;

    if (env.GUILD_ID) {
      try {
        const guild = await getDiscordClient().guilds.fetch(env.GUILD_ID);
        linkedMember = await guild.members.fetch(discordId);
        isDiscordBooster = linkedMember.premiumSince !== null;
      } catch (error) {
        console.error("Erro ao verificar status de booster no callback:", error);
      }
    }

    await prisma.user.upsert({
      where: { discordId },
      update: {
        twitchId,
        isDiscordBooster,
        updatedAt: new Date(),
      },
      create: {
        discordId,
        twitchId,
        isDiscordBooster,
      },
    });

    if (linkedMember && !linkedMember.roles.cache.has(appConfig.discord.verifiedRoleId)) {
      try {
        await linkedMember.roles.add(appConfig.discord.verifiedRoleId, "Conta Twitch vinculada");
      } catch (error) {
        console.error("Erro ao adicionar cargo de verificado no callback:", error);
      }
    }

    const safeDisplayName = escapeHtml(twitchUser.display_name || twitchUser.login || "usuario");

    const successHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conta vinculada</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #1b0c06;
      --card: #2a140a;
      --text: #fff2e0;
      --muted: #f3bf87;
      --ok: #ffb347;
      --ring: #ff6a00;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background:
        radial-gradient(1000px 620px at 12% -8%, rgba(255, 140, 0, 0.35) 0%, transparent 55%),
        radial-gradient(800px 520px at 100% 0%, rgba(255, 69, 0, 0.3) 0%, transparent 60%),
        linear-gradient(170deg, #2a1108 0%, var(--bg) 55%, #130702 100%);
      color: var(--text);
    }
    .card {
      width: 100%;
      max-width: 520px;
      background:
        linear-gradient(180deg, rgba(255, 166, 77, 0.08), rgba(255, 88, 0, 0.06)),
        var(--card);
      border: 1px solid rgba(255, 145, 0, 0.35);
      border-radius: 18px;
      padding: 28px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.5), 0 0 25px rgba(255, 106, 0, 0.22);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--ring), transparent 40%);
      color: var(--ring);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--ok), transparent 83%);
    }
    h1 {
      margin: 16px 0 10px;
      font-size: 28px;
      line-height: 1.2;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 15px;
    }
    strong { color: var(--text); }
    .footer {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 145, 0, 0.24);
      font-size: 13px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge"><span class="dot"></span>Integracao concluida</span>
    <h1>Conta vinculada com sucesso</h1>
    <p>A conta da Twitch <strong>${safeDisplayName}</strong> foi conectada ao seu Discord.</p>
    <p class="footer">Voce ja pode fechar esta aba e voltar ao Discord.</p>
  </main>
</body>
</html>`;

    return res.status(200).type("text/html").send(successHtml);
  } catch (error) {
    console.error("Erro no callback:", error);
    return res.status(500).send("Erro interno do servidor.");
  }
});

const port = Number(process.env.PORT) || appConfig.server.port;
const host = process.env.HOST || "0.0.0.0";

export const httpServer = app.listen(port, host, () => {
  console.log(`HTTP Server rodando em ${host}:${port}`);

  ensureEventSubSubscriptions().catch((error) => {
    console.error("[EventSub] Falha ao garantir subscriptions:", error);
  });
});
