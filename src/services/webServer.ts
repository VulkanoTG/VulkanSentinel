import { appConfig, env } from "#config";
import { prisma } from "#database";
import type { GuildMember } from "discord.js";
import { createReadStream, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  attachAgentHub,
  dispatchAgentJob,
  getConnectedAgentsSnapshot,
  syncAgentRedeems,
  syncVoicemodCatalogsForReadyAgents,
} from "./agentHub.js";
import { getDiscordClient } from "./discord.js";
import { getLiveStatusSnapshot } from "./liveStatus.js";
import { readDiscordLinkState } from "./privacyService.js";
import {
  getModuleSettings,
  moduleDefinitions,
  updateModuleEnabled,
  type ModuleKey,
} from "./moduleSettings.js";
import {
  getRewardSettings,
  rewardSettingDefinitions,
  updateRewardSetting,
  type RewardSettingKey,
} from "./rewardSettings.js";
import {
  getSpotifyModerationSnapshot,
  searchSpotifyTracks,
  skipSpotifyTrack,
  toggleSpotifyPlaybackPause,
} from "../spotify/service.js";
import { requestSpotifyTrackReward } from "../spotify/reward.js";
import {
  clearVoicemodPendingQueue,
  getVoicemodModerationSnapshot,
  requestVoicemodSoundAlertReward,
  requestVoicemodVoiceReward,
  skipVoicemodActiveReward,
  testVoicemodSoundAlert,
  toggleVoicemodQueuePause,
} from "./voicemodRewards.js";
import { requestControlsInvertReward } from "./controlsInvertReward.js";
import { requestMouseAxesInvertReward } from "./mouseAxesInvertReward.js";
import {
  handleEventSubNotification,
  parseEventSubMessageType,
  verifyEventSubSignature,
} from "./twitchEventSub.js";
import { getCurrentSubscriptionStatus } from "../web/profile.js";
import {
  buildTwitchAuthUrl,
  createWebSessionCookie,
  parseCookies,
  readWebSessionFromCookieHeader,
  serializeCookie,
  serializeExpiredCookie,
  WEB_OAUTH_STATE_COOKIE_NAME,
  WEB_SESSION_COOKIE_NAME,
  WEB_SESSION_DURATION_MS,
} from "../web/session.js";
import type { TwitchTokenResponse, TwitchUserResponse, WebSessionPayload } from "../web/types.js";
import { loadWebProfilePayload } from "../web/profile.js";
import {
  renderChaosAlertOverlayPage,
  renderHomePage,
  renderLinkSuccessPage,
  renderMouseAxesInvertOverlayPage,
  renderPrivacyPage,
  renderControlsInvertOverlayPage,
  renderProfilePage,
  renderSentinelCalloutOverlayPage,
  renderVulkanTerminalOverlayPage,
} from "../web/pages.js";
import crypto from "node:crypto";
import { attachChatOverlayStream, publishMockChatOverlayMessage } from "./chatOverlay.js";
import {
  attachSentinelCalloutOverlayStream,
  publishSentinelCalloutOverlay,
} from "./sentinelCalloutOverlay.js";
import {
  attachControlsInvertOverlayStream,
  publishControlsInvertOverlayState,
} from "./controlsInvertOverlay.js";
import {
  attachMouseAxesInvertOverlayStream,
  publishMouseAxesInvertOverlayState,
} from "./mouseAxesInvertOverlay.js";

let webServerStarted = false;

function shouldEmbedWebServer() {
  const entrypoint = process.argv[1] ?? "";
  return (
    entrypoint.endsWith(path.join("build", "index.js")) ||
    entrypoint.endsWith(path.join("src", "index.ts"))
  );
}

type ResponseHeaders = Record<string, string | string[]>;

function sendHtml(response: ServerResponse, status: number, html: string, headers?: ResponseHeaders) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    ...headers,
  });
  response.end(html);
}

function sendJson(response: ServerResponse, status: number, payload: unknown, headers?: ResponseHeaders) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function redirect(response: ServerResponse, location: string, status = 307, headers?: ResponseHeaders) {
  response.writeHead(status, {
    location,
    ...headers,
  });
  response.end();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function getRequestUrl(request: IncomingMessage) {
  const host = request.headers.host ?? `127.0.0.1:${appConfig.server.port}`;
  return new URL(request.url ?? "/", `http://${host}`);
}

async function findLinkedViewer(cookieHeader: string | undefined) {
  const viewer = readWebSessionFromCookieHeader(cookieHeader);
  if (!viewer?.twitchId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { twitchId: viewer.twitchId },
    select: {
      twitchId: true,
      balance: true,
    },
  });

  return user ? { viewer, user } : null;
}

function renderSimpleHomePage(input: {
  viewerLabel?: string | null;
  isLinked: boolean;
  balance?: number | null;
}) {
  const spotifyPanel = input.isLinked
    ? `
      <section class="card">
        <h2>Spotify</h2>
        <p class="muted">Conta vinculada${typeof input.balance === "number" ? ` • Saldo atual: <strong>${input.balance} Firecoins</strong>` : ""}</p>
        <form id="spotify-form" class="form">
          <input id="title" name="title" type="text" placeholder="Nome da musica" required />
          <input id="artist" name="artist" type="text" placeholder="Artista (opcional)" />
          <div class="actions">
            <button type="button" id="search">Pesquisar</button>
            <button type="submit">Pedir musica</button>
          </div>
        </form>
        <div id="feedback" class="feedback hidden"></div>
        <div id="results" class="results"></div>
      </section>
    `
    : `
      <section class="card">
        <h2>Spotify</h2>
        <p class="muted">Para usar o pedido de musica pelo site, faca login com a Twitch e vincule sua conta ao bot.</p>
        <div class="actions">
          <a class="button" href="/auth/twitch/login">Entrar com Twitch</a>
        </div>
      </section>
    `;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vulkan Sentinel</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0a0d12;
      --panel: #121821;
      --panel-2: #182130;
      --line: rgba(255,255,255,0.08);
      --text: #f6f7fb;
      --muted: #9aa7bd;
      --accent: #ff7a18;
      --accent-2: #ffb347;
      --ok: #41d18a;
      --err: #ff6b6b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Segoe UI, system-ui, sans-serif;
      background:
        radial-gradient(50rem 24rem at 10% -10%, rgba(255,122,24,0.26), transparent 60%),
        radial-gradient(42rem 22rem at 100% 0%, rgba(255,179,71,0.12), transparent 58%),
        linear-gradient(180deg, #0c1118 0%, #090c11 100%);
      color: var(--text);
      padding: 32px 16px;
    }
    main {
      width: 100%;
      max-width: 880px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }
    .hero, .card {
      border: 1px solid var(--line);
      border-radius: 24px;
      background: rgba(18, 24, 33, 0.9);
      box-shadow: 0 20px 60px rgba(0,0,0,0.35);
      padding: 24px;
    }
    h1, h2 {
      margin: 0 0 8px;
      letter-spacing: -0.03em;
    }
    p { margin: 0; line-height: 1.6; }
    .muted { color: var(--muted); }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .button, button {
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      cursor: pointer;
      font-weight: 700;
      color: #16120d;
      background: linear-gradient(135deg, var(--accent-2), var(--accent));
      text-decoration: none;
    }
    .secondary {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--line);
    }
    .form {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }
    input {
      width: 100%;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--panel-2);
      color: var(--text);
      padding: 14px 16px;
      outline: none;
    }
    .feedback {
      margin-top: 16px;
      border-radius: 14px;
      padding: 12px 14px;
      border: 1px solid var(--line);
    }
    .feedback.ok { border-color: rgba(65,209,138,0.35); color: #b6f0d1; background: rgba(65,209,138,0.08); }
    .feedback.err { border-color: rgba(255,107,107,0.35); color: #ffd1d1; background: rgba(255,107,107,0.08); }
    .hidden { display: none; }
    .results {
      margin-top: 18px;
      display: grid;
      gap: 10px;
    }
    .result {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px 16px;
      background: rgba(255,255,255,0.02);
    }
    .result strong { display: block; }
    .topline {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="topline">
        <div>
          <h1>Vulkan Sentinel</h1>
          <p class="muted">Versao simplificada do site: login Twitch + pedido de musica no Spotify.</p>
        </div>
        ${input.viewerLabel ? `<a class="button secondary" href="/auth/logout">Sair (${escapeHtml(input.viewerLabel)})</a>` : ""}
      </div>
    </section>
    ${spotifyPanel}
  </main>
  <script>
    (() => {
      const form = document.getElementById("spotify-form");
      if (!form) return;

      const titleInput = document.getElementById("title");
      const artistInput = document.getElementById("artist");
      const feedback = document.getElementById("feedback");
      const results = document.getElementById("results");
      const searchButton = document.getElementById("search");

      function setFeedback(message, ok) {
        feedback.textContent = message;
        feedback.className = "feedback " + (ok ? "ok" : "err");
      }

      function clearFeedback() {
        feedback.textContent = "";
        feedback.className = "feedback hidden";
      }

      function renderTracks(tracks) {
        results.innerHTML = tracks.map((track) => {
          const artist = track.artist ? " • " + track.artist : "";
          return '<article class="result"><strong>' + track.name + '</strong><span class="muted">' + track.album + artist + '</span></article>';
        }).join("");
      }

      searchButton.addEventListener("click", async () => {
        clearFeedback();
        results.innerHTML = "";
        const title = titleInput.value.trim();
        const artist = artistInput.value.trim();
        if (!title) {
          setFeedback("Informe o nome da musica.", false);
          return;
        }

        try {
          const params = new URLSearchParams({ title });
          if (artist) params.set("artist", artist);
          const response = await fetch("/api/spotify/search?" + params.toString());
          const payload = await response.json();
          if (!response.ok) {
            setFeedback(payload.message || "Falha ao pesquisar.", false);
            return;
          }
          if (!payload.tracks.length) {
            setFeedback("Nenhuma musica encontrada.", false);
            return;
          }
          renderTracks(payload.tracks);
        } catch {
          setFeedback("Falha ao pesquisar.", false);
        }
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearFeedback();
        const title = titleInput.value.trim();
        const artist = artistInput.value.trim();
        if (!title) {
          setFeedback("Informe o nome da musica.", false);
          return;
        }

        try {
          const response = await fetch("/api/spotify/request", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title, artist })
          });
          const payload = await response.json();
          if (!response.ok) {
            setFeedback(payload.message || "Falha ao pedir musica.", false);
            return;
          }
          setFeedback("Musica adicionada: " + payload.track.name + " • saldo restante: " + payload.balanceAfter, true);
        } catch {
          setFeedback("Falha ao pedir musica.", false);
        }
      });
    })();
  </script>
</body>
</html>`;
}

async function resolveDiscordMember(discordId: string) {
  if (!env.GUILD_ID) {
    return null;
  }

  try {
    const guild = await getDiscordClient().guilds.fetch(env.GUILD_ID);
    return await guild.members.fetch(discordId).catch(() => null);
  } catch {
    return null;
  }
}

function headersToRecord(headers: IncomingMessage["headers"]) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  ) as Record<string, string | string[] | undefined>;
}

function parseRewardSettingKey(value: unknown): RewardSettingKey | null {
  return typeof value === "string" && value in rewardSettingDefinitions
    ? (value as RewardSettingKey)
    : null;
}

function parseModuleKey(value: unknown): ModuleKey | null {
  return typeof value === "string" && value in moduleDefinitions
    ? (value as ModuleKey)
    : null;
}

async function loadModeratorFromCookieHeader(cookieHeader: string | undefined) {
  const viewer = readWebSessionFromCookieHeader(cookieHeader);

  if (!viewer?.twitchId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { twitchId: viewer.twitchId },
    select: {
      id: true,
      isModerator: true,
    },
  } as any) as Promise<{
    id: number;
    isModerator: boolean;
  } | null>;
}

async function requireModerator(request: IncomingMessage, response: ServerResponse) {
  const user = await loadModeratorFromCookieHeader(request.headers.cookie);

  if (!user) {
    sendJson(response, 401, {
      error: "AUTH_REQUIRED",
      message: "Faca login para acessar as configuracoes.",
    });
    return null;
  }

  if (!user.isModerator) {
    sendJson(response, 403, {
      error: "FORBIDDEN",
      message: "Apenas moderadores podem acessar esta configuracao.",
    });
    return null;
  }

  return user;
}

function getStaticContentType(filePath: string) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function handleStaticFile(
  pathname: string,
  response: ServerResponse,
  rootDir: string,
  prefixToTrim = "/",
  cacheControl = "public, max-age=3600"
) {
  const relativePath = pathname.slice(prefixToTrim.length).replace(/^\/+/, "");
  const baseRoot = path.resolve(process.cwd(), rootDir);
  const filePath = path.resolve(baseRoot, relativePath);

  if (!filePath.startsWith(baseRoot) || !existsSync(filePath)) {
    sendJson(response, 404, {
      error: "NOT_FOUND",
      message: "Arquivo nao encontrado.",
    });
    return;
  }

  const fileStat = await stat(filePath);
  response.writeHead(200, {
    "content-type": getStaticContentType(filePath),
    "content-length": String(fileStat.size),
    "cache-control": cacheControl,
  });
  createReadStream(filePath).pipe(response);
}

async function handleHome(request: IncomingMessage, response: ServerResponse) {
  const viewer = readWebSessionFromCookieHeader(request.headers.cookie);
  const linked = await findLinkedViewer(request.headers.cookie);
  const live = getLiveStatusSnapshot();
  const isAgentConnected = getConnectedAgentsSnapshot().length > 0;
  sendHtml(
    response,
    200,
    renderHomePage ? renderHomePage({
      viewerLabel: viewer?.twitchDisplayName ?? null,
      isLinked: Boolean(linked),
      isAgentConnected,
      live: {
        isLive: live.isLive,
        title: live.stream?.title ?? null,
        category: live.stream?.game_name ?? null,
        viewerCount: live.stream?.viewer_count ?? null,
      },
    }) : renderSimpleHomePage({
      viewerLabel: viewer?.twitchDisplayName ?? null,
      isLinked: Boolean(linked),
      balance: linked?.user.balance ?? null,
    })
  );
}

async function handleProfilePage(request: IncomingMessage, response: ServerResponse) {
  const viewer = readWebSessionFromCookieHeader(request.headers.cookie);
  const payload = await loadWebProfilePayload({ viewer });
  sendHtml(response, 200, renderProfilePage(payload));
}

async function handlePrivacyPage(response: ServerResponse) {
  sendHtml(response, 200, renderPrivacyPage());
}

async function handleVulkanTerminalOverlayPage(response: ServerResponse) {
  sendHtml(response, 200, renderVulkanTerminalOverlayPage(), {
    "cache-control": "no-store",
  });
}

async function handleSentinelCalloutOverlayPage(response: ServerResponse) {
  sendHtml(response, 200, renderSentinelCalloutOverlayPage(), {
    "cache-control": "no-store",
  });
}

async function handleControlsInvertOverlayPage(response: ServerResponse) {
  sendHtml(response, 200, renderControlsInvertOverlayPage(), {
    "cache-control": "no-store",
  });
}

async function handleChaosAlertOverlayPage(response: ServerResponse) {
  sendHtml(response, 200, renderChaosAlertOverlayPage(), {
    "cache-control": "no-store",
  });
}

async function handleMouseAxesInvertOverlayPage(response: ServerResponse) {
  sendHtml(response, 200, renderMouseAxesInvertOverlayPage(), {
    "cache-control": "no-store",
  });
}

async function handleChatOverlayStream(response: ServerResponse) {
  attachChatOverlayStream(response);
}

async function handleSentinelCalloutOverlayStream(response: ServerResponse) {
  attachSentinelCalloutOverlayStream(response);
}

async function handleControlsInvertOverlayStream(response: ServerResponse) {
  attachControlsInvertOverlayStream(response);
}

async function handleMouseAxesInvertOverlayStream(response: ServerResponse) {
  attachMouseAxesInvertOverlayStream(response);
}

function isLocalRequest(request: IncomingMessage) {
  const remoteAddress = request.socket.remoteAddress ?? "";
  return (
    remoteAddress === "127.0.0.1" ||
    remoteAddress === "::1" ||
    remoteAddress === "::ffff:127.0.0.1"
  );
}

async function handleChatOverlayMock(request: IncomingMessage, response: ServerResponse) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, {
      error: "FORBIDDEN",
      message: "Mock local do overlay disponivel apenas via localhost.",
    });
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const role = body?.role === "default" || body?.role === "subscriber" || body?.role === "moderator"
    ? body.role
    : "default";
  const badge = body?.badge === "V-LINK" || body?.badge === "SENTINELA"
    ? body.badge
    : null;
  const icon = typeof body?.icon === "string" ? body.icon.trim().slice(0, 6) : undefined;

  if (!username || !message) {
    sendJson(response, 400, {
      error: "INVALID_INPUT",
      message: "Informe username e message para o mock do overlay.",
    });
    return;
  }

  publishMockChatOverlayMessage({
    username,
    message,
    role,
    badge,
    icon,
  });

  sendJson(response, 200, {
    ok: true,
  });
}

async function handleSentinelCalloutOverlayMock(request: IncomingMessage, response: ServerResponse) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, {
      error: "FORBIDDEN",
      message: "Mock local do callout disponivel apenas via localhost.",
    });
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const detail = typeof body?.detail === "string" ? body.detail.trim() : "";
  const visibleForMs = typeof body?.visibleForMs === "number" && body.visibleForMs >= 0
    ? body.visibleForMs
    : null;
  const tone = body?.tone === "info" || body?.tone === "reward" || body?.tone === "event"
    ? body.tone
    : "info";

  if (!message) {
    sendJson(response, 400, {
      error: "INVALID_INPUT",
      message: "Informe ao menos a message para o mock do callout.",
    });
    return;
  }

  publishSentinelCalloutOverlay({
    title: title || "TERMINAL DA SENTINELA",
    message,
    detail,
    visibleForMs,
    tone,
  });

  sendJson(response, 200, {
    ok: true,
  });
}

async function handleControlsInvertOverlayMock(request: IncomingMessage, response: ServerResponse) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, {
      error: "FORBIDDEN",
      message: "Mock local do overlay de inversao disponivel apenas via localhost.",
    });
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const active = body?.active !== false;
  const requesterName = typeof body?.requesterName === "string" ? body.requesterName.trim() : null;
  const durationMs = typeof body?.durationMs === "number" && body.durationMs >= 0
    ? body.durationMs
    : 5 * 60 * 1000;
  const startedAtCandidate = typeof body?.startedAt === "string" && body.startedAt.trim()
    ? new Date(body.startedAt)
    : new Date();
  const startedAt = Number.isNaN(startedAtCandidate.getTime()) ? new Date() : startedAtCandidate;
  const expiresAt = new Date(startedAt.getTime() + durationMs);

  publishControlsInvertOverlayState({
    active,
    requesterName,
    startedAt: active ? startedAt.toISOString() : null,
    expiresAt: active ? expiresAt.toISOString() : null,
  });

  sendJson(response, 200, {
    ok: true,
    active,
    startedAt: active ? startedAt.toISOString() : null,
    expiresAt: active ? expiresAt.toISOString() : null,
  });
}

async function handleMouseAxesInvertOverlayMock(request: IncomingMessage, response: ServerResponse) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, {
      error: "FORBIDDEN",
      message: "Mock local do overlay de mouse disponivel apenas via localhost.",
    });
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const active = body?.active !== false;
  const requesterName = typeof body?.requesterName === "string" ? body.requesterName.trim() : null;
  const durationMs = typeof body?.durationMs === "number" && body.durationMs >= 0
    ? body.durationMs
    : 5 * 60 * 1000;
  const startedAtCandidate = typeof body?.startedAt === "string" && body.startedAt.trim()
    ? new Date(body.startedAt)
    : new Date();
  const startedAt = Number.isNaN(startedAtCandidate.getTime()) ? new Date() : startedAtCandidate;
  const expiresAt = new Date(startedAt.getTime() + durationMs);

  publishMouseAxesInvertOverlayState({
    active,
    requesterName,
    startedAt: active ? startedAt.toISOString() : null,
    expiresAt: active ? expiresAt.toISOString() : null,
  });

  sendJson(response, 200, {
    ok: true,
    active,
    startedAt: active ? startedAt.toISOString() : null,
    expiresAt: active ? expiresAt.toISOString() : null,
  });
}

async function handleProfileApi(request: IncomingMessage, response: ServerResponse) {
  const viewer = readWebSessionFromCookieHeader(request.headers.cookie);

  if (!viewer) {
    sendJson(response, 401, {
      error: "AUTH_REQUIRED",
      message: "Faca login com a Twitch para acessar o perfil.",
    });
    return;
  }

  const payload = await loadWebProfilePayload({ viewer });
  sendJson(response, 200, payload);
}

async function handleVoicemodSoundAlertTest(request: IncomingMessage, response: ServerResponse) {
  const linked = await findLinkedViewer(request.headers.cookie);
  if (!linked) {
    sendJson(response, 401, {
      error: "AUTH_REQUIRED",
      message: "Faca login e vincule sua conta para testar sound alerts.",
    });
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const rewardId = typeof body?.rewardId === "string" ? body.rewardId.trim() : "";
  if (!rewardId) {
    sendJson(response, 400, {
      error: "INVALID_REWARD",
      message: "Informe um sound alert valido.",
    });
    return;
  }

  const result = await testVoicemodSoundAlert({
    technicalId: rewardId,
  });

  if (!result.ok) {
    const status =
      result.code === "REWARD_NOT_FOUND"
        ? 404
        : result.code === "AGENT_OFFLINE"
          ? 503
          : 500;

    sendJson(response, status, {
      error: result.code,
      message: result.message,
    });
    return;
  }

  sendJson(response, 200, {
    soundAlert: result.soundAlert,
    requester: linked.viewer.twitchDisplayName,
  });
}

async function handleVoicemodCatalogSync(request: IncomingMessage, response: ServerResponse) {
  const linked = await findLinkedViewer(request.headers.cookie);
  if (!linked) {
    sendJson(response, 401, {
      error: "AUTH_REQUIRED",
      message: "Faca login e vincule sua conta para sincronizar o catalogo do Voicemod.",
    });
    return;
  }

  await syncVoicemodCatalogsForReadyAgents();

  sendJson(response, 200, {
    ok: true,
  });
}

async function handleRewardSettings(request: IncomingMessage, response: ServerResponse) {
  const user = await requireModerator(request, response);
  if (!user) {
    return;
  }

  if ((request.method ?? "GET") === "GET") {
    const settings = await getRewardSettings();
    sendJson(response, 200, { settings });
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const key = parseRewardSettingKey(body?.key);
  const cost = typeof body?.cost === "number" ? body.cost : Number(body?.cost);
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;

  if (!key) {
    sendJson(response, 400, {
      error: "INVALID_KEY",
      message: "Recompensa invalida.",
    });
    return;
  }

  if (!Number.isInteger(cost) || cost < 0) {
    sendJson(response, 400, {
      error: "INVALID_COST",
      message: "Informe um valor inteiro maior ou igual a zero.",
    });
    return;
  }

  const setting = await updateRewardSetting(key, {
    cost,
    enabled: enabled === null ? undefined : enabled,
  });
  sendJson(response, 200, { setting });
}

async function handleModuleSettings(request: IncomingMessage, response: ServerResponse) {
  const user = await requireModerator(request, response);
  if (!user) {
    return;
  }

  if ((request.method ?? "GET") === "GET") {
    const settings = await getModuleSettings();
    sendJson(response, 200, { settings });
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const key = parseModuleKey(body?.key);
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;

  if (!key) {
    sendJson(response, 400, {
      error: "INVALID_KEY",
      message: "Modulo invalido.",
    });
    return;
  }

  if (enabled === null) {
    sendJson(response, 400, {
      error: "INVALID_ENABLED",
      message: "Informe se o modulo deve ficar ativo ou inativo.",
    });
    return;
  }

  const setting = await updateModuleEnabled(key, enabled);
  sendJson(response, 200, { setting });
}

async function handleAgentsStatus(request: IncomingMessage, response: ServerResponse) {
  const user = await requireModerator(request, response);
  if (!user) {
    return;
  }

  sendJson(response, 200, {
    agents: getConnectedAgentsSnapshot(),
    wsPath: appConfig.server.agent.wsPath,
  });
}

async function handleAgentPresence(response: ServerResponse) {
  sendJson(response, 200, {
    connected: getConnectedAgentsSnapshot().length > 0,
  }, {
    "cache-control": "no-store",
  });
}

async function handleAgentJobDispatch(request: IncomingMessage, response: ServerResponse) {
  const user = await requireModerator(request, response);
  if (!user) {
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const agentId = typeof body?.agentId === "string" ? body.agentId.trim() : "";
  const action = typeof body?.action === "string" ? body.action.trim() : "";
  const timeoutMs = typeof body?.timeoutMs === "number" ? body.timeoutMs : Number(body?.timeoutMs);

  if (!agentId || !action) {
    sendJson(response, 400, {
      error: "INVALID_JOB",
      message: "Informe agentId e action para despachar o job.",
    });
    return;
  }

  try {
    const result = await dispatchAgentJob({
      agentId,
      action,
      payload: body?.payload,
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
    });

    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 400, {
      error: "AGENT_JOB_FAILED",
      message: error instanceof Error ? error.message : "Falha ao despachar job para o agent.",
    });
  }
}

async function handleAgentSync(request: IncomingMessage, response: ServerResponse) {
  const user = await requireModerator(request, response);
  if (!user) {
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const connectedAgents = getConnectedAgentsSnapshot().filter((agent) => agent.isReady);
  const requestedAgentId = typeof body?.agentId === "string" ? body.agentId.trim() : "";
  const agentId = requestedAgentId || connectedAgents[0]?.agentId || "";

  if (!agentId) {
    sendJson(response, 400, {
      error: "AGENT_NOT_FOUND",
      message: "Nenhum agent pronto foi encontrado para sincronizar.",
    });
    return;
  }

  try {
    await syncAgentRedeems(agentId);
    sendJson(response, 200, {
      ok: true,
      agentId,
    });
  } catch (error) {
    sendJson(response, 400, {
      error: "AGENT_SYNC_FAILED",
      message: error instanceof Error ? error.message : "Falha ao sincronizar resgates do agent.",
    });
  }
}

async function handleSpotifySearch(request: IncomingMessage, response: ServerResponse) {
  const linked = await findLinkedViewer(request.headers.cookie);
  if (!linked?.user.twitchId) {
    sendJson(response, 401, {
      error: "AUTH_REQUIRED",
      message: "Faca login e vincule sua conta para pesquisar musicas.",
    });
    return;
  }

  const requestUrl = getRequestUrl(request);
  const title = requestUrl.searchParams.get("title")?.trim() ?? "";
  const artist = requestUrl.searchParams.get("artist")?.trim() ?? "";

  if (!title) {
    sendJson(response, 400, {
      error: "INVALID_TITLE",
      message: "Informe o nome da musica para pesquisar.",
    });
    return;
  }

  const tracks = await searchSpotifyTracks({
    title,
    artist,
    limit: 5,
  });

  sendJson(response, 200, { tracks });
}

async function handleSpotifyRequest(request: IncomingMessage, response: ServerResponse) {
  const linked = await findLinkedViewer(request.headers.cookie);
  if (!linked?.user.twitchId) {
    sendJson(response, 401, {
      error: "AUTH_REQUIRED",
      message: "Faca login e vincule sua conta para pedir musica.",
    });
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const artist = typeof body?.artist === "string" ? body.artist.trim() : "";

  if (!title) {
    sendJson(response, 400, {
      error: "INVALID_TITLE",
      message: "Informe o nome da musica.",
    });
    return;
  }

  const result = await requestSpotifyTrackReward({
    twitchId: linked.user.twitchId,
    requesterName: linked.viewer.twitchDisplayName,
    title,
    artist: artist || null,
  });

  if (!result.ok) {
    const status =
      result.code === "USER_NOT_FOUND" || result.code === "TRACK_NOT_FOUND"
        ? 404
        : result.code === "REWARD_DISABLED"
          ? 403
        : result.code === "SPOTIFY_UNAVAILABLE"
          ? 503
        : result.code === "INSUFFICIENT_BALANCE"
          ? 400
          : 500;

    sendJson(response, status, {
      error: result.code,
      message: result.message,
    });
    return;
  }

  sendJson(response, 200, {
    track: result.track,
    chargedAmount: result.chargedAmount,
    balanceAfter: result.balanceAfter,
  });
}

async function handleModeratorVoicemodControl(request: IncomingMessage, response: ServerResponse) {
  const user = await requireModerator(request, response);
  if (!user) {
    return;
  }

  if ((request.method ?? "GET") === "GET") {
    sendJson(response, 200, await getVoicemodModerationSnapshot());
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const action = typeof body?.action === "string" ? body.action.trim() : "";

  try {
    if (action === "skip") {
      const result = await skipVoicemodActiveReward();
      if (!result.ok) {
        sendJson(response, 400, { error: result.code, message: result.message });
        return;
      }
    } else if (action === "clear") {
      await clearVoicemodPendingQueue();
    } else if (action === "pause-toggle") {
      const result = await toggleVoicemodQueuePause();
      if (!result.ok) {
        sendJson(response, 400, { error: result.code, message: result.message });
        return;
      }
    } else {
      sendJson(response, 400, {
        error: "INVALID_ACTION",
        message: "Acao de Voicemod invalida.",
      });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      snapshot: await getVoicemodModerationSnapshot(),
    });
  } catch (error) {
    sendJson(response, 500, {
      error: "VOICEMOD_CONTROL_FAILED",
      message: error instanceof Error ? error.message : "Falha ao controlar a fila do Voicemod.",
    });
  }
}

async function handleModeratorSpotifyControl(request: IncomingMessage, response: ServerResponse) {
  const user = await requireModerator(request, response);
  if (!user) {
    return;
  }

  if ((request.method ?? "GET") === "GET") {
    sendJson(response, 200, await getSpotifyModerationSnapshot());
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const action = typeof body?.action === "string" ? body.action.trim() : "";

  try {
    if (action === "skip") {
      await skipSpotifyTrack();
    } else if (action === "pause-toggle") {
      await toggleSpotifyPlaybackPause();
    } else if (action === "clear") {
      sendJson(response, 501, {
        error: "UNSUPPORTED_ACTION",
        message: "A API atual do Spotify nao oferece limpar fila remotamente.",
      });
      return;
    } else {
      sendJson(response, 400, {
        error: "INVALID_ACTION",
        message: "Acao de Spotify invalida.",
      });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      snapshot: await getSpotifyModerationSnapshot(),
    });
  } catch (error) {
    sendJson(response, 500, {
      error: "SPOTIFY_CONTROL_FAILED",
      message: error instanceof Error ? error.message : "Falha ao controlar o Spotify.",
    });
  }
}

async function handleRewardRedeem(request: IncomingMessage, response: ServerResponse) {
  const linked = await findLinkedViewer(request.headers.cookie);
  if (!linked?.user.twitchId) {
    sendJson(response, 401, {
      error: "AUTH_REQUIRED",
      message: "Faca login e vincule sua conta para resgatar recompensas.",
    });
    return;
  }

  const rawBody = await readRequestBody(request);
  let body: Record<string, unknown> | null = null;

  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    sendJson(response, 400, {
      error: "INVALID_JSON",
      message: "Body JSON invalido.",
    });
    return;
  }

  const rewardId = typeof body?.rewardId === "string" ? body.rewardId.trim() : "";
  const rewardType = typeof body?.rewardType === "string" ? body.rewardType.trim() : "";

  if (rewardType === "voicemod_voice") {
    if (!rewardId) {
      sendJson(response, 400, {
        error: "INVALID_REWARD",
        message: "Informe um resgate de voz valido.",
      });
      return;
    }

    const result = await requestVoicemodVoiceReward({
      technicalId: rewardId,
      twitchId: linked.user.twitchId,
      requesterName: linked.viewer.twitchDisplayName,
    });

    if (!result.ok) {
      const status =
        result.code === "USER_NOT_FOUND" || result.code === "REWARD_NOT_FOUND"
          ? 404
          : result.code === "REWARD_DISABLED"
            ? 403
          : result.code === "AGENT_OFFLINE"
            ? 503
          : result.code === "INSUFFICIENT_BALANCE"
            ? 400
            : 500;

      sendJson(response, status, {
        error: result.code,
        message: result.message,
      });
      return;
    }

    sendJson(response, 200, {
      redeem: result.redeem,
      chargedAmount: result.chargedAmount,
      balanceAfter: result.balanceAfter,
    });
    return;
  }

  if (rewardType === "voicemod_sounds") {
    if (!rewardId) {
      sendJson(response, 400, {
        error: "INVALID_REWARD",
        message: "Informe um sound alert valido.",
      });
      return;
    }

    const result = await requestVoicemodSoundAlertReward({
      technicalId: rewardId,
      twitchId: linked.user.twitchId,
      requesterName: linked.viewer.twitchDisplayName,
    });

    if (!result.ok) {
      const status =
        result.code === "USER_NOT_FOUND" || result.code === "REWARD_NOT_FOUND"
          ? 404
          : result.code === "REWARD_DISABLED"
            ? 403
          : result.code === "AGENT_OFFLINE"
            ? 503
          : result.code === "INSUFFICIENT_BALANCE"
            ? 400
            : 500;

      sendJson(response, status, {
        error: result.code,
        message: result.message,
      });
      return;
    }

    sendJson(response, 200, {
      soundAlert: result.soundAlert,
      chargedAmount: result.chargedAmount,
      balanceAfter: result.balanceAfter,
      queueStatus: result.soundAlert.status,
      queuePosition: result.soundAlert.queuePosition,
    });
    return;
  }

  if (rewardType === "chaos_controls_invert" && rewardId === "controls.invert") {
    const result = await requestControlsInvertReward({
      twitchId: linked.user.twitchId,
      requesterName: linked.viewer.twitchDisplayName,
    });

    if (!result.ok) {
      const status =
        result.code === "USER_NOT_FOUND"
          ? 404
          : result.code === "REWARD_DISABLED"
            ? 403
          : result.code === "COOLDOWN_ACTIVE"
            ? 429
          : result.code === "AGENT_OFFLINE"
            ? 503
          : result.code === "INSUFFICIENT_BALANCE"
            ? 400
            : 500;

      sendJson(response, status, {
        error: result.code,
        message: result.message,
      });
      return;
    }

    sendJson(response, 200, {
      effect: result.effect,
      chargedAmount: result.chargedAmount,
      balanceAfter: result.balanceAfter,
    });
    return;
  }

  if (rewardType === "mouse_axes_invert" && rewardId === "mouse.axes.invert.xy") {
    const result = await requestMouseAxesInvertReward({
      twitchId: linked.user.twitchId,
      requesterName: linked.viewer.twitchDisplayName,
    });

    if (!result.ok) {
      const status =
        result.code === "USER_NOT_FOUND"
          ? 404
          : result.code === "REWARD_DISABLED"
            ? 403
          : result.code === "COOLDOWN_ACTIVE"
            ? 429
          : result.code === "AGENT_OFFLINE"
            ? 503
          : result.code === "INSUFFICIENT_BALANCE"
            ? 400
            : 500;

      sendJson(response, status, {
        error: result.code,
        message: result.message,
      });
      return;
    }

    sendJson(response, 200, {
      effect: result.effect,
      chargedAmount: result.chargedAmount,
      balanceAfter: result.balanceAfter,
    });
    return;
  }

  sendJson(response, 400, {
    error: "INVALID_REWARD",
    message: "Informe um resgate valido.",
  });
}

async function handleTwitchLogin(response: ServerResponse) {
  const state = `web:${crypto.randomBytes(24).toString("hex")}`;
  redirect(response, buildTwitchAuthUrl(state), 307, {
    "Set-Cookie": serializeCookie(WEB_OAUTH_STATE_COOKIE_NAME, state, 10 * 60),
  });
}

async function handleTwitchCallback(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = getRequestUrl(request);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");

  if (!code || !state) {
    sendHtml(response, 400, "Codigo ou state ausente.");
    return;
  }

  const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID!,
      client_secret: env.TWITCH_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: env.TWITCH_REDIRECT_URI,
    }),
  });

  const tokenData = (await tokenResponse.json()) as TwitchTokenResponse;
  if (!tokenData.access_token) {
    sendHtml(response, 400, "Erro ao obter access token.");
    return;
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
    sendHtml(response, 400, "Usuario da Twitch nao encontrado.");
    return;
  }

  const twitchId = twitchUser.id;
  const isTwitchSub = await getCurrentSubscriptionStatus(accessToken, twitchId).catch((error) => {
    console.error("Erro ao verificar status atual de sub no callback:", error);
    return false;
  });

  const cookieState = parseCookies(request.headers.cookie).get(WEB_OAUTH_STATE_COOKIE_NAME);
  const isWebLogin = state.startsWith("web:");
  const discordLinkState = readDiscordLinkState(state);
  const discordId = discordLinkState?.discordId;
  let isDiscordBooster = false;
  let linkedMember: GuildMember | null = null;

  if (isWebLogin) {
    if (!cookieState || cookieState !== state) {
      sendHtml(response, 400, "State invalido para login web da Twitch.");
      return;
    }

    const sessionPayload: WebSessionPayload = {
      twitchId,
      twitchLogin: twitchUser.login,
      twitchDisplayName: twitchUser.display_name,
      expiresAt: Date.now() + WEB_SESSION_DURATION_MS,
    };

    redirect(response, "/?login=ok", 307, {
      "Set-Cookie": [
        serializeCookie(
          WEB_SESSION_COOKIE_NAME,
          createWebSessionCookie(sessionPayload),
          Math.floor(WEB_SESSION_DURATION_MS / 1000)
        ),
        serializeExpiredCookie(WEB_OAUTH_STATE_COOKIE_NAME),
      ],
    });
    return;
  }

  if (!discordId) {
    sendHtml(response, 400, "State invalido para vinculacao Discord/Twitch.");
    return;
  }

  linkedMember = await resolveDiscordMember(discordId);
  isDiscordBooster = linkedMember?.premiumSince !== null;

  await prisma.user.upsert({
    where: { discordId },
    update: {
      twitchId,
      isTwitchSub,
      isDiscordBooster,
      updatedAt: new Date(),
    },
    create: {
      discordId,
      twitchId,
      isTwitchSub,
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

  const sessionPayload: WebSessionPayload = {
    twitchId,
    twitchLogin: twitchUser.login,
    twitchDisplayName: twitchUser.display_name,
    expiresAt: Date.now() + WEB_SESSION_DURATION_MS,
  };

  sendHtml(response, 200, renderLinkSuccessPage(twitchUser.display_name || twitchUser.login || "usuario"), {
    "Set-Cookie": serializeCookie(
      WEB_SESSION_COOKIE_NAME,
      createWebSessionCookie(sessionPayload),
      Math.floor(WEB_SESSION_DURATION_MS / 1000)
    ),
  });
}

async function handleLogout(response: ServerResponse) {
  redirect(response, "/", 307, {
    "Set-Cookie": serializeExpiredCookie(WEB_SESSION_COOKIE_NAME),
  });
}

async function handleEventSub(request: IncomingMessage, response: ServerResponse) {
  const rawBody = await readRequestBody(request);
  const headers = headersToRecord(request.headers);
  const messageType = parseEventSubMessageType(headers);

  if (!messageType) {
    response.writeHead(400);
    response.end("Tipo de mensagem EventSub invalido.");
    return;
  }

  const isValid = verifyEventSubSignature(headers, rawBody);
  if (!isValid) {
    response.writeHead(403);
    response.end("Assinatura EventSub invalida.");
    return;
  }

  let body: { challenge?: string } & Record<string, unknown>;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    response.writeHead(400);
    response.end("Payload JSON invalido.");
    return;
  }

  if (messageType === "webhook_callback_verification") {
    if (!body.challenge) {
      response.writeHead(400);
      response.end("Challenge ausente.");
      return;
    }

    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end(body.challenge);
    return;
  }

  if (messageType === "revocation") {
    console.warn("[EventSub] Subscription revogada:", body);
    response.writeHead(204);
    response.end();
    return;
  }

  await handleEventSubNotification(body as never);
  response.writeHead(204);
  response.end();
}

async function routeRequest(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = getRequestUrl(request);
  const pathname = requestUrl.pathname;
  const method = request.method ?? "GET";

  try {
    if (method === "GET" && pathname.startsWith("/assets/")) {
      await handleStaticFile(pathname, response, "public", "/");
      return;
    }

    if (method === "GET" && pathname === "/") {
      await handleHome(request, response);
      return;
    }

    if (method === "GET" && pathname === "/perfil") {
      await handleProfilePage(request, response);
      return;
    }

    if (method === "GET" && pathname === "/privacidade") {
      await handlePrivacyPage(response);
      return;
    }

    if (method === "GET" && pathname === "/overlays/chat/vulkan-terminal") {
      await handleVulkanTerminalOverlayPage(response);
      return;
    }

    if (method === "GET" && pathname === "/overlays/sentinel/callout") {
      await handleSentinelCalloutOverlayPage(response);
      return;
    }

    if (method === "GET" && pathname === "/overlays/chaos/controls-invert") {
      await handleControlsInvertOverlayPage(response);
      return;
    }

    if (method === "GET" && pathname === "/overlays/chaos/alert") {
      await handleChaosAlertOverlayPage(response);
      return;
    }

    if (method === "GET" && pathname === "/overlays/chaos/mouse-axes-invert") {
      await handleMouseAxesInvertOverlayPage(response);
      return;
    }

    if (method === "GET" && pathname === "/api/overlays/chat/stream") {
      await handleChatOverlayStream(response);
      return;
    }

    if (method === "GET" && pathname === "/api/overlays/sentinel/callout/stream") {
      await handleSentinelCalloutOverlayStream(response);
      return;
    }

    if (method === "GET" && pathname === "/api/overlays/controls-invert/stream") {
      await handleControlsInvertOverlayStream(response);
      return;
    }

    if (method === "GET" && pathname === "/api/overlays/mouse-axes-invert/stream") {
      await handleMouseAxesInvertOverlayStream(response);
      return;
    }

    if (method === "POST" && pathname === "/api/overlays/chat/mock") {
      await handleChatOverlayMock(request, response);
      return;
    }

    if (method === "POST" && pathname === "/api/overlays/sentinel/callout/mock") {
      await handleSentinelCalloutOverlayMock(request, response);
      return;
    }

    if (method === "POST" && pathname === "/api/overlays/controls-invert/mock") {
      await handleControlsInvertOverlayMock(request, response);
      return;
    }

    if (method === "POST" && pathname === "/api/overlays/mouse-axes-invert/mock") {
      await handleMouseAxesInvertOverlayMock(request, response);
      return;
    }

    if (method === "GET" && pathname === "/api/profile") {
      await handleProfileApi(request, response);
      return;
    }

    if ((method === "GET" || method === "POST") && pathname === "/api/reward-settings") {
      await handleRewardSettings(request, response);
      return;
    }

    if ((method === "GET" || method === "POST") && pathname === "/api/module-settings") {
      await handleModuleSettings(request, response);
      return;
    }

    if ((method === "GET" || method === "POST") && pathname === "/api/moderation/voicemod") {
      await handleModeratorVoicemodControl(request, response);
      return;
    }

    if ((method === "GET" || method === "POST") && pathname === "/api/moderation/spotify") {
      await handleModeratorSpotifyControl(request, response);
      return;
    }

    if (method === "POST" && pathname === "/api/voicemod/sound-alerts/test") {
      await handleVoicemodSoundAlertTest(request, response);
      return;
    }

    if (method === "POST" && pathname === "/api/voicemod/catalog/sync") {
      await handleVoicemodCatalogSync(request, response);
      return;
    }

    if (method === "GET" && pathname === "/api/agents/status") {
      await handleAgentsStatus(request, response);
      return;
    }

    if (method === "GET" && pathname === "/api/agents/presence") {
      await handleAgentPresence(response);
      return;
    }

    if (method === "POST" && pathname === "/api/agents/jobs") {
      await handleAgentJobDispatch(request, response);
      return;
    }

    if (method === "POST" && pathname === "/api/agents/sync") {
      await handleAgentSync(request, response);
      return;
    }

    if (method === "GET" && pathname === "/api/spotify/search") {
      await handleSpotifySearch(request, response);
      return;
    }

    if (method === "POST" && pathname === "/api/spotify/request") {
      await handleSpotifyRequest(request, response);
      return;
    }

    if (method === "POST" && pathname === "/api/rewards/redeem") {
      await handleRewardRedeem(request, response);
      return;
    }

    if (method === "GET" && pathname === "/auth/twitch/login") {
      await handleTwitchLogin(response);
      return;
    }

    if (method === "GET" && pathname === "/auth/twitch/callback") {
      await handleTwitchCallback(request, response);
      return;
    }

    if (method === "GET" && pathname === "/auth/logout") {
      await handleLogout(response);
      return;
    }

    if (method === "POST" && pathname === "/webhook/twitch/eventsub") {
      await handleEventSub(request, response);
      return;
    }

    sendJson(response, 404, {
      error: "NOT_FOUND",
      message: "Rota nao encontrada.",
    });
  } catch (error) {
    console.error("[Web] Erro ao processar requisicao:", error);
    sendJson(response, 500, {
      error: "INTERNAL_ERROR",
      message: "Erro interno do servidor.",
    });
  }
}

export async function startEmbeddedWebServer() {
  if (!shouldEmbedWebServer() || webServerStarted) {
    return;
  }

  const hostname = "0.0.0.0";
  const port = Number(process.env.PORT ?? appConfig.server.port);
  const server = createServer((request, response) => {
    void routeRequest(request, response);
  });
  attachAgentHub(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, () => {
      webServerStarted = true;
      console.log(`[Web] Servidor HTTP pronto em http://${hostname}:${port}`);
      resolve();
    });
  });
}
