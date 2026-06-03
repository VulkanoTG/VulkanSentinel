import { env } from "#config";
import { prisma } from "#database";
import type { ServerResponse } from "node:http";

export type ChatOverlayRole = "default" | "subscriber" | "moderator";
export type ChatOverlayBadge = "V-LINK" | "SENTINELA";
export type ChatOverlayTone = "chat" | "engagement" | "reward" | "event" | "spotify";

export type ChatOverlayMessagePayload = {
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

const overlayClients = new Set<OverlayClient>();

function serializeSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function broadcast(event: string, payload: unknown) {
  const body = serializeSseEvent(event, payload);

  for (const client of overlayClients) {
    client.response.write(body);
  }
}

export function attachChatOverlayStream(response: ServerResponse) {
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

function resolveRole(input: { isModerator: boolean; isTwitchSub: boolean }): ChatOverlayRole {
  if (input.isModerator) {
    return "moderator";
  }

  if (input.isTwitchSub) {
    return "subscriber";
  }

  return "default";
}

function resolveBadge(input: { isModerator: boolean; isLinked: boolean }): ChatOverlayBadge | null {
  if (input.isModerator) {
    return "SENTINELA";
  }

  if (input.isLinked) {
    return "V-LINK";
  }

  return null;
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

export async function publishChatOverlayMessage(input: {
  username: string;
  message: string;
  twitchId?: string | null;
}) {
  if (!overlayClients.size) {
    return;
  }

  const linkedUser = (input.twitchId
    ? await prisma.user.findUnique({
        where: { twitchId: input.twitchId },
        select: {
          isModerator: true,
          isTwitchSub: true,
          discordId: true,
        },
      } as any)
    : null) as {
      isModerator: boolean;
      isTwitchSub: boolean;
      discordId: string | null;
    } | null;

  const isBroadcaster = input.twitchId === env.TWITCH_BROADCASTER_ID;
  const role = isBroadcaster
    ? "default"
    : resolveRole({
        isModerator: linkedUser?.isModerator ?? false,
        isTwitchSub: linkedUser?.isTwitchSub ?? false,
      });

  const payload: ChatOverlayMessagePayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    username: input.username,
    message: input.message,
    role,
    badge: resolveBadge({
      isModerator: linkedUser?.isModerator ?? false,
      isLinked: Boolean(linkedUser?.discordId),
    }),
    icon: resolveIcon(role),
    tone: "chat",
    timestamp: Date.now(),
  };

  broadcast("chat-message", payload);
}

export function publishMockChatOverlayMessage(input: {
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

export function publishEngagementOverlayMessage(input: {
  username: string;
  message: string;
  icon?: string;
}) {
  publishMockChatOverlayMessage({
    username: input.username,
    message: input.message,
    role: "default",
    icon: input.icon ?? "ENG",
    tone: "engagement",
  });
}

export function publishRewardOverlayMessage(input: {
  username: string;
  message: string;
  icon?: string;
  tone?: ChatOverlayTone;
}) {
  publishMockChatOverlayMessage({
    username: input.username,
    message: input.message,
    role: "subscriber",
    icon: input.icon ?? "RWD",
    tone: input.tone ?? "reward",
  });
}

export function publishEventOverlayMessage(input: {
  username: string;
  message: string;
  icon?: string;
}) {
  publishMockChatOverlayMessage({
    username: input.username,
    message: input.message,
    role: "default",
    icon: input.icon ?? "EVT",
    tone: "event",
  });
}
