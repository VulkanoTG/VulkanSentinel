import { exec } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  renderChaosAlertOverlayPage,
  renderControlsInvertOverlayPage,
  renderMouseAxesInvertOverlayPage,
  renderSentinelCalloutOverlayPage,
  renderVulkanTerminalOverlayPage,
} from "../web/pages/overlays/index.js";

type ChatOverlayRole = "default" | "subscriber" | "moderator";
type ChatOverlayBadge = "V-LINK" | "SENTINELA";
type ChatOverlayTone = "chat" | "engagement" | "reward" | "event";
type SentinelCalloutTone = "info" | "reward" | "event";

type ChatOverlayMessagePayload = {
  id: string;
  username: string;
  message: string;
  role: ChatOverlayRole;
  badge: ChatOverlayBadge | null;
  icon: string;
  tone: ChatOverlayTone;
  timestamp: number;
};

type OverlayClient = {
  response: ServerResponse;
  keepAlive: NodeJS.Timeout;
};

const host = process.env.OVERLAY_HOST ?? "127.0.0.1";
const port = Number(process.env.OVERLAY_PORT ?? 3010);
const clients = new Set<OverlayClient>();
const calloutClients = new Set<OverlayClient>();
const controlsInvertClients = new Set<OverlayClient>();
const mouseAxesInvertClients = new Set<OverlayClient>();
let latestControlsInvertPayload: Record<string, unknown> | null = null;
let latestMouseAxesInvertPayload: Record<string, unknown> | null = null;

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function getStaticContentType(filePath: string) {
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

async function handleStaticFile(response: ServerResponse, pathname: string) {
  const baseRoot = path.resolve(process.cwd(), "public");
  const relativePath = pathname.replace(/^\/+/, "");
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
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    request.on("error", reject);
  });
}

function serializeSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function broadcast(event: string, payload: unknown) {
  const body = serializeSseEvent(event, payload);

  for (const client of clients) {
    client.response.write(body);
  }
}

function broadcastCallout(event: string, payload: unknown) {
  const body = serializeSseEvent(event, payload);

  for (const client of calloutClients) {
    client.response.write(body);
  }
}

function broadcastControlsInvert(event: string, payload: unknown) {
  const body = serializeSseEvent(event, payload);

  for (const client of controlsInvertClients) {
    client.response.write(body);
  }
}

function broadcastMouseAxesInvert(event: string, payload: unknown) {
  const body = serializeSseEvent(event, payload);

  for (const client of mouseAxesInvertClients) {
    client.response.write(body);
  }
}

function resolveIcon(role: ChatOverlayRole) {
  switch (role) {
    case "moderator":
      return "THERM";
    case "subscriber":
      return "SUB";
    default:
      return "USR";
  }
}

function publishMockChatOverlayMessage(input: {
  username: string;
  message: string;
  role?: ChatOverlayRole;
  badge?: ChatOverlayBadge | null;
  icon?: string;
  tone?: ChatOverlayTone;
}) {
  const role = input.role ?? "default";

  const payload: ChatOverlayMessagePayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    username: input.username,
    message: input.message,
    role,
    badge: input.badge ?? null,
    icon: input.icon ?? resolveIcon(role),
    tone: input.tone ?? "chat",
    timestamp: Date.now(),
  };

  broadcast("chat-message", payload);
}

function publishMockSentinelCallout(input: {
  title: string;
  message: string;
  detail?: string;
  visibleForMs?: number | null;
  tone?: SentinelCalloutTone;
}) {
  broadcastCallout("sentinel-callout", {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    title: input.title,
    message: input.message,
    detail: input.detail ?? "",
    visibleForMs: typeof input.visibleForMs === "number" && input.visibleForMs >= 0
      ? input.visibleForMs
      : null,
    tone: input.tone ?? "info",
    timestamp: Date.now(),
  });
}

function publishMockControlsInvert(input: {
  active: boolean;
  requesterName?: string | null;
  startedAt?: string | null;
  expiresAt?: string | null;
}) {
  latestControlsInvertPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    active: input.active,
    requesterName: input.requesterName ?? null,
    startedAt: input.startedAt ?? null,
    expiresAt: input.expiresAt ?? null,
    timestamp: Date.now(),
  };

  broadcastControlsInvert("controls-invert", latestControlsInvertPayload);
}

function publishMockMouseAxesInvert(input: {
  active: boolean;
  requesterName?: string | null;
  startedAt?: string | null;
  expiresAt?: string | null;
}) {
  latestMouseAxesInvertPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    active: input.active,
    requesterName: input.requesterName ?? null,
    startedAt: input.startedAt ?? null,
    expiresAt: input.expiresAt ?? null,
    timestamp: Date.now(),
  };

  broadcastMouseAxesInvert("mouse-axes-invert", latestMouseAxesInvertPayload);
}

function attachOverlayStream(response: ServerResponse) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  response.write(": connected\n\n");

  const client: OverlayClient = {
    response,
    keepAlive: setInterval(() => {
      response.write(": keep-alive\n\n");
    }, 15000),
  };

  clients.add(client);

  const close = () => {
    clearInterval(client.keepAlive);
    clients.delete(client);
  };

  response.on("close", close);
  response.on("error", close);
}

function attachCalloutOverlayStream(response: ServerResponse) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  response.write(": connected\n\n");

  const client: OverlayClient = {
    response,
    keepAlive: setInterval(() => {
      response.write(": keep-alive\n\n");
    }, 15000),
  };

  calloutClients.add(client);

  const close = () => {
    clearInterval(client.keepAlive);
    calloutClients.delete(client);
  };

  response.on("close", close);
  response.on("error", close);
}

function attachControlsInvertOverlayStream(response: ServerResponse) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  response.write(": connected\n\n");

  const client: OverlayClient = {
    response,
    keepAlive: setInterval(() => {
      response.write(": keep-alive\n\n");
    }, 15000),
  };

  controlsInvertClients.add(client);

  if (latestControlsInvertPayload) {
    response.write(serializeSseEvent("controls-invert", latestControlsInvertPayload));
  }

  const close = () => {
    clearInterval(client.keepAlive);
    controlsInvertClients.delete(client);
  };

  response.on("close", close);
  response.on("error", close);
}

function attachMouseAxesInvertOverlayStream(response: ServerResponse) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  response.write(": connected\n\n");

  const client: OverlayClient = {
    response,
    keepAlive: setInterval(() => {
      response.write(": keep-alive\n\n");
    }, 15000),
  };

  mouseAxesInvertClients.add(client);

  if (latestMouseAxesInvertPayload) {
    response.write(serializeSseEvent("mouse-axes-invert", latestMouseAxesInvertPayload));
  }

  const close = () => {
    clearInterval(client.keepAlive);
    mouseAxesInvertClients.delete(client);
  };

  response.on("close", close);
  response.on("error", close);
}

function startMockLoop() {
  const samples: Array<{
    username: string;
    message: string;
    role: ChatOverlayRole;
    badge: ChatOverlayBadge | null;
    icon?: string;
    tone: ChatOverlayTone;
  }> = [
    {
      username: "vulkan_core",
      message: "Sistema de forja online. Fluxo termico estabilizado.",
      role: "default",
      badge: "V-LINK",
      tone: "chat",
    },
    {
      username: "ember_sub",
      message: "acabou de assinar o canal. Energia roxa detectada.",
      role: "subscriber",
      badge: null,
      icon: "SUB",
      tone: "engagement",
    },
    {
      username: "sentinela_mod",
      message: "Canal monitorado. Integridade do chat em 99.4%.",
      role: "moderator",
      badge: "SENTINELA",
      tone: "chat",
    },
    {
      username: "forge_unit",
      message: "Reator secundario aquecido. Interface pronta para OBS.",
      role: "default",
      badge: null,
      tone: "chat",
    },
    {
      username: "amber_link",
      message: "resgatou musica: Bury the Light",
      role: "subscriber",
      badge: null,
      icon: "SFX",
      tone: "reward",
    },
    {
      username: "nova_follower",
      message: "obrigado por seguir a live!",
      role: "default",
      badge: null,
      icon: "FOL",
      tone: "engagement",
    },
    {
      username: "heat_echo",
      message: "entrou na fila da voz Inferno Core",
      role: "subscriber",
      badge: null,
      icon: "VOX",
      tone: "reward",
    },
    {
      username: "Vulkan Sentinel x2",
      message: "evento Dobro de Firecoins iniciado por 30m",
      role: "default",
      badge: null,
      icon: "EVT",
      tone: "event",
    },
  ];

  let index = 0;
  return setInterval(() => {
    const sample = samples[index % samples.length];
    publishMockChatOverlayMessage(sample);
    index += 1;
  }, 2200);
}

function openBrowser(url: string) {
  const platform = process.platform;
  const escapedUrl = `"${url}"`;

  if (platform === "win32") {
    exec(`start "" ${escapedUrl}`);
    return;
  }

  if (platform === "darwin") {
    exec(`open ${escapedUrl}`);
    return;
  }

  exec(`xdg-open ${escapedUrl}`);
}

async function handleMockMessage(request: IncomingMessage, response: ServerResponse) {
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
  const tone = body?.tone === "chat" || body?.tone === "engagement" || body?.tone === "reward" || body?.tone === "event"
    ? body.tone
    : "chat";

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
    tone,
  });

  sendJson(response, 200, { ok: true });
}

async function handleCalloutMockMessage(request: IncomingMessage, response: ServerResponse) {
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
      message: "Informe a message para o mock do callout.",
    });
    return;
  }

  publishMockSentinelCallout({
    title: title || "TERMINAL DA SENTINELA",
    message,
    detail,
    visibleForMs,
    tone,
  });

  sendJson(response, 200, { ok: true });
}

async function handleControlsInvertMockMessage(request: IncomingMessage, response: ServerResponse) {
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

  publishMockControlsInvert({
    active,
    requesterName,
    startedAt: active ? startedAt.toISOString() : null,
    expiresAt: active ? expiresAt.toISOString() : null,
  });

  sendJson(response, 200, { ok: true });
}

async function handleMouseAxesInvertMockMessage(request: IncomingMessage, response: ServerResponse) {
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

  publishMockMouseAxesInvert({
    active,
    requesterName,
    startedAt: active ? startedAt.toISOString() : null,
    expiresAt: active ? expiresAt.toISOString() : null,
  });

  sendJson(response, 200, { ok: true });
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
  const method = request.method ?? "GET";

  if (method === "GET" && url.pathname === "/") {
    response.writeHead(302, {
      location: "/overlays/chat/vulkan-terminal",
    });
    response.end();
    return;
  }

  if (method === "GET" && url.pathname.startsWith("/assets/")) {
    void handleStaticFile(response, url.pathname);
    return;
  }

  if (method === "GET" && url.pathname === "/overlays/chat/vulkan-terminal") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(renderVulkanTerminalOverlayPage());
    return;
  }

  if (method === "GET" && url.pathname === "/overlays/sentinel/callout") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(renderSentinelCalloutOverlayPage());
    return;
  }

  if (method === "GET" && url.pathname === "/overlays/chaos/controls-invert") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(renderControlsInvertOverlayPage());
    return;
  }

  if (method === "GET" && url.pathname === "/overlays/chaos/alert") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(renderChaosAlertOverlayPage());
    return;
  }

  if (method === "GET" && url.pathname === "/overlays/chaos/mouse-axes-invert") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(renderMouseAxesInvertOverlayPage());
    return;
  }

  if (method === "GET" && url.pathname === "/api/overlays/chat/stream") {
    attachOverlayStream(response);
    return;
  }

  if (method === "GET" && url.pathname === "/api/overlays/sentinel/callout/stream") {
    attachCalloutOverlayStream(response);
    return;
  }

  if (method === "GET" && url.pathname === "/api/overlays/controls-invert/stream") {
    attachControlsInvertOverlayStream(response);
    return;
  }

  if (method === "GET" && url.pathname === "/api/overlays/mouse-axes-invert/stream") {
    attachMouseAxesInvertOverlayStream(response);
    return;
  }

  if (method === "POST" && url.pathname === "/api/overlays/chat/mock") {
    void handleMockMessage(request, response);
    return;
  }

  if (method === "POST" && url.pathname === "/api/overlays/sentinel/callout/mock") {
    void handleCalloutMockMessage(request, response);
    return;
  }

  if (method === "POST" && url.pathname === "/api/overlays/controls-invert/mock") {
    void handleControlsInvertMockMessage(request, response);
    return;
  }

  if (method === "POST" && url.pathname === "/api/overlays/mouse-axes-invert/mock") {
    void handleMouseAxesInvertMockMessage(request, response);
    return;
  }

  sendJson(response, 404, {
    error: "NOT_FOUND",
    message: "Rota nao encontrada.",
  });
});

server.listen(port, host, () => {
  const overlayUrl = `http://${host}:${port}/overlays/chat/vulkan-terminal`;
  const calloutUrl = `http://${host}:${port}/overlays/sentinel/callout`;
  const controlsInvertUrl = `http://${host}:${port}/overlays/chaos/controls-invert`;
  const chaosAlertUrl = `http://${host}:${port}/overlays/chaos/alert`;
  console.log(`[overlay:dev] Preview local em ${overlayUrl}`);
  console.log(`[overlay:dev] Callout local em ${calloutUrl}`);
  console.log(`[overlay:dev] Controls invert em ${controlsInvertUrl}`);
  console.log(`[overlay:dev] Chaos alert em ${chaosAlertUrl}`);
  console.log("[overlay:dev] Chat mocks automaticos ativos.");

  if (process.env.OVERLAY_OPEN_BROWSER !== "0") {
    openBrowser(chaosAlertUrl);
  }
});

const loop = startMockLoop();

function shutdown() {
  clearInterval(loop);
  for (const client of clients) {
    clearInterval(client.keepAlive);
    client.response.end();
  }
  clients.clear();
  for (const client of calloutClients) {
    clearInterval(client.keepAlive);
    client.response.end();
  }
  calloutClients.clear();
  for (const client of controlsInvertClients) {
    clearInterval(client.keepAlive);
    client.response.end();
  }
  controlsInvertClients.clear();
  for (const client of mouseAxesInvertClients) {
    clearInterval(client.keepAlive);
    client.response.end();
  }
  mouseAxesInvertClients.clear();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
