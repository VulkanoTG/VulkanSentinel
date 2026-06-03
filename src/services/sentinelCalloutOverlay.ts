import type { ServerResponse } from "node:http";
import { isModuleEnabled } from "./moduleSettings.js";

export type SentinelCalloutTone = "info" | "reward" | "event";

export type SentinelCalloutPayload = {
  id: string;
  title: string;
  message: string;
  detail: string;
  visibleForMs: number | null;
  tone: SentinelCalloutTone;
  timestamp: number;
};

type OverlayClient = {
  response: ServerResponse;
  keepAlive: NodeJS.Timeout;
};

const SENTINEL_CALLOUT_MIN_INTERVAL_MS = 3 * 60 * 1000;
const SENTINEL_CALLOUT_MAX_INTERVAL_MS = 8 * 60 * 1000;
const SENTINEL_CALLOUT_MIN_VISIBLE_MS = 45 * 1000;
const SENTINEL_CALLOUT_MAX_VISIBLE_MS = 60 * 1000;

const automatedCalloutCatalog: Array<{
  title: string;
  message: string;
  detail: string;
  tone: SentinelCalloutTone;
}> = [
  {
    title: "SENTINELA ONLINE",
    message: "Vincule-se à Sentinela para participar das interações da live.",
    detail: "Entre no Discord para saber como vincular sua conta e aproveitar o melhor da transmissão.",
    tone: "info",
  },
  {
    title: "PAINEL LIBERADO",
    message: "Abra seu painel para acompanhar Firecoins, perfil e recompensas da live.",
    detail: "A Sentinela centraliza seu progresso e os atalhos mais importantes em um só lugar.",
    tone: "event",
  },
  {
    title: "DIVERSÃO GARANTIDA",
    message: "Com a conta vinculada, você ganha acesso ao terminal para resgatar recompensas.",
    detail: "Deseja pregar uma peça? O terminal é seu palco, e as recompensas são a plateia. Aproveite a experiência completa da live!",
    tone: "reward",
  },
    {
    title: "ACESSO AO TERMINAL",
    message: "Digite !site para acessar o terminal e resgatar suas recompensas exclusivas.",
    detail: "por lá você controla a minha live!",
    tone: "reward",
  },
];

const overlayClients = new Set<OverlayClient>();
let schedulerTimer: NodeJS.Timeout | null = null;
let schedulerInitialized = false;
let lastAutomatedCalloutIndex = -1;

function serializeSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * Math.max(0, max - min));
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function pickAutomatedCallout() {
  if (automatedCalloutCatalog.length <= 1) {
    const single = automatedCalloutCatalog[0];
    lastAutomatedCalloutIndex = 0;
    return single;
  }

  let nextIndex = lastAutomatedCalloutIndex;

  while (nextIndex === lastAutomatedCalloutIndex) {
    nextIndex = Math.floor(Math.random() * automatedCalloutCatalog.length);
  }

  lastAutomatedCalloutIndex = nextIndex;
  return automatedCalloutCatalog[nextIndex];
}

function broadcast(event: string, payload: unknown) {
  const body = serializeSseEvent(event, payload);

  for (const client of overlayClients) {
    client.response.write(body);
  }
}

export function attachSentinelCalloutOverlayStream(response: ServerResponse) {
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

  overlayClients.add(client);

  const close = () => {
    clearInterval(client.keepAlive);
    overlayClients.delete(client);
  };

  response.on("close", close);
  response.on("error", close);
}

export function publishSentinelCalloutOverlay(input: {
  title: string;
  message: string;
  detail?: string;
  visibleForMs?: number | null;
  tone?: SentinelCalloutTone;
}) {
  void publishSentinelCalloutOverlayAsync(input);
}

async function publishSentinelCalloutOverlayAsync(input: {
  title: string;
  message: string;
  detail?: string;
  visibleForMs?: number | null;
  tone?: SentinelCalloutTone;
}) {
  if (!(await isModuleEnabled("sentinelCalloutOverlay"))) {
    return;
  }

  const payload: SentinelCalloutPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    title: input.title.trim(),
    message: input.message.trim(),
    detail: input.detail?.trim() || "",
    visibleForMs:
      typeof input.visibleForMs === "number" && input.visibleForMs >= 0
        ? input.visibleForMs
        : null,
    tone: input.tone ?? "info",
    timestamp: Date.now(),
  };

  broadcast("sentinel-callout", payload);
}

function scheduleNextAutomatedCallout() {
  if (!schedulerInitialized) {
    return;
  }

  const nextDelayMs = randomBetween(
    SENTINEL_CALLOUT_MIN_INTERVAL_MS,
    SENTINEL_CALLOUT_MAX_INTERVAL_MS,
  );

  console.log(`[SentinelCallout] Proximo envio agendado para daqui a ${formatDuration(nextDelayMs)}.`);

  schedulerTimer = setTimeout(() => {
    void runScheduledAutomatedCallout();
  }, nextDelayMs);
}

async function runScheduledAutomatedCallout() {
  try {
    if (!(await isModuleEnabled("sentinelCalloutOverlay"))) {
      return;
    }

    const callout = pickAutomatedCallout();
    const visibleForMs = randomBetween(
      SENTINEL_CALLOUT_MIN_VISIBLE_MS,
      SENTINEL_CALLOUT_MAX_VISIBLE_MS,
    );

    console.log(
      `[SentinelCallout] Enviando callout "${callout.title}" com exibicao de ${formatDuration(visibleForMs)}.`,
    );

    publishSentinelCalloutOverlay({
      ...callout,
      visibleForMs,
    });
  } catch (error) {
    console.error("[SentinelCallout] Falha ao verificar modulo sentinelCalloutOverlay:", error);
  } finally {
    scheduleNextAutomatedCallout();
  }
}

export function initializeSentinelCalloutScheduler() {
  if (schedulerInitialized) {
    return;
  }

  schedulerInitialized = true;
  scheduleNextAutomatedCallout();
}

export function shutdownSentinelCalloutScheduler() {
  schedulerInitialized = false;

  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}
