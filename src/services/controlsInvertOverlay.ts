import type { ServerResponse } from "node:http";
import { isModuleEnabled } from "./moduleSettings.js";

export type ControlsInvertOverlayPayload = {
  id: string;
  active: boolean;
  requesterName: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  timestamp: number;
};

type OverlayClient = {
  response: ServerResponse;
  keepAlive: NodeJS.Timeout;
};

const overlayClients = new Set<OverlayClient>();
let latestPayload: ControlsInvertOverlayPayload | null = null;

function buildPayloadSignature(input: {
  active: boolean;
  requesterName?: string | null;
  startedAt?: string | null;
  expiresAt?: string | null;
}) {
  return [
    input.active ? "1" : "0",
    input.requesterName?.trim() || "",
    input.startedAt?.trim() || "",
    input.expiresAt?.trim() || "",
  ].join("|");
}

function serializeSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function writeEvent(response: ServerResponse, event: string, payload: unknown) {
  response.write(serializeSseEvent(event, payload));
}

function broadcast(event: string, payload: unknown) {
  const body = serializeSseEvent(event, payload);

  for (const client of overlayClients) {
    client.response.write(body);
  }
}

export function attachControlsInvertOverlayStream(response: ServerResponse) {
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
    }, 15_000),
  };

  overlayClients.add(client);

  if (latestPayload) {
    writeEvent(response, "controls-invert", latestPayload);
  }

  const close = () => {
    clearInterval(client.keepAlive);
    overlayClients.delete(client);
  };

  response.on("close", close);
  response.on("error", close);
}

export function publishControlsInvertOverlayState(input: {
  active: boolean;
  requesterName?: string | null;
  startedAt?: string | null;
  expiresAt?: string | null;
}) {
  void publishControlsInvertOverlayStateAsync(input);
}

async function publishControlsInvertOverlayStateAsync(input: {
  active: boolean;
  requesterName?: string | null;
  startedAt?: string | null;
  expiresAt?: string | null;
}) {
  if (!(await isModuleEnabled("controlsInvertOverlay"))) {
    return;
  }

  const nextSignature = buildPayloadSignature(input);
  const currentSignature = latestPayload
    ? buildPayloadSignature(latestPayload)
    : null;

  if (currentSignature === nextSignature) {
    return;
  }

  latestPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    active: input.active,
    requesterName: input.requesterName?.trim() || null,
    startedAt: input.startedAt?.trim() || null,
    expiresAt: input.expiresAt?.trim() || null,
    timestamp: Date.now(),
  };

  broadcast("controls-invert", latestPayload);
}
