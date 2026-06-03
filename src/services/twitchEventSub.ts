import { env } from "#config";
import crypto from "node:crypto";
import { syncSubscriptionStatus } from "../twitch/events/subTracker.js";
import { markStreamOffline, refreshLiveStatus } from "./liveStatus.js";
import { notifyTwitchEngagement } from "./twitchEngagementNotifications.js";
import { getTwitchAppAccessToken } from "./twitchAuth.js";

type EventSubTransport = {
    method: "webhook";
    callback: string;
    secret: string;
};

type EventSubSubscription = {
    id: string;
    status: string;
    type: string;
    version: string;
    condition: Record<string, string>;
    transport: EventSubTransport;
    created_at: string;
    cost: number;
};

type EventSubListResponse = {
    data: EventSubSubscription[];
};

type EventSubMessageType =
    | "webhook_callback_verification"
    | "notification"
    | "revocation";

type EventSubPayload = {
    subscription: EventSubSubscription;
    challenge?: string;
    event?: Record<string, string | boolean | number | null | undefined>;
};

const EVENTSUB_TYPES = [
    "stream.online",
    "stream.offline",
    "channel.update",
    "channel.follow",
    "channel.subscribe",
    "channel.subscription.message",
    "channel.subscription.gift",
    "channel.subscription.end",
] as const;

function getEventSubConfig() {
    return {
        callback: env.TWITCH_EVENTSUB_CALLBACK,
        secret: env.TWITCH_EVENTSUB_SECRET,
        broadcasterId: env.TWITCH_BROADCASTER_ID,
        clientId: env.TWITCH_CLIENT_ID,
    };
}

function isValidWebhookCallback(callback: string) {
    try {
        const url = new URL(callback);
        const isHttps = url.protocol === "https:";
        const hasStandardPort = url.port === "" || url.port === "443";
        const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
        return isHttps && hasStandardPort && !isLocalhost;
    } catch {
        return false;
    }
}

function buildSignature(messageId: string, timestamp: string, rawBody: string, secret: string) {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(messageId + timestamp + rawBody);
    return `sha256=${hmac.digest("hex")}`;
}

export function verifyEventSubSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
) {
    const { secret } = getEventSubConfig();

    if (!secret || !rawBody) return false;

    const messageId = headers["twitch-eventsub-message-id"];
    const timestamp = headers["twitch-eventsub-message-timestamp"];
    const signature = headers["twitch-eventsub-message-signature"];

    if (
        typeof messageId !== "string" ||
        typeof timestamp !== "string" ||
        typeof signature !== "string"
    ) {
        return false;
    }

    const expected = buildSignature(messageId, timestamp, rawBody, secret);

    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
}

function extractTwitchUser(event: Record<string, string | boolean | number | null | undefined>) {
    const twitchId =
        (typeof event.user_id === "string" && event.user_id) ||
        (typeof event.recipient_user_id === "string" && event.recipient_user_id) ||
        null;

    const username =
        (typeof event.user_login === "string" && event.user_login) ||
        (typeof event.recipient_user_login === "string" && event.recipient_user_login) ||
        null;

    return { twitchId, username };
}

export async function handleEventSubNotification(payload: EventSubPayload) {
    const type = payload.subscription?.type;
    const event = payload.event;

    if (!type || !event) return;

    if (!EVENTSUB_TYPES.includes(type as (typeof EVENTSUB_TYPES)[number])) return;

    if (type === "stream.online") {
        await refreshLiveStatus("eventsub:stream.online");
        return;
    }

    if (type === "stream.offline") {
        markStreamOffline("eventsub:stream.offline");
        return;
    }

    if (type === "channel.update") {
        await refreshLiveStatus("eventsub:channel.update");
        return;
    }

    if (type === "channel.follow") {
        await notifyTwitchEngagement({
            kind: "follow",
            twitchUserId: typeof event.user_id === "string" ? event.user_id : null,
            twitchLogin: typeof event.user_login === "string" ? event.user_login : null,
            twitchDisplayName: typeof event.user_name === "string" ? event.user_name : null,
        });
        return;
    }

    if (type === "channel.subscription.gift") {
        await notifyTwitchEngagement({
            kind: "gift_subscription",
            twitchUserId: typeof event.user_id === "string" ? event.user_id : null,
            twitchLogin: typeof event.user_login === "string" ? event.user_login : null,
            twitchDisplayName: typeof event.user_name === "string" ? event.user_name : null,
            tier: typeof event.tier === "string" ? event.tier : null,
            totalGifted: typeof event.total === "number" ? event.total : null,
            isAnonymous: typeof event.is_anonymous === "boolean" ? event.is_anonymous : false,
        });
        return;
    }

    const { twitchId, username } = extractTwitchUser(event);

    if (!twitchId) {
        console.warn(`[EventSub] Evento ${type} sem twitch user id.`);
        return;
    }

    if (type === "channel.subscription.end") {
        await syncSubscriptionStatus({
            twitchId,
            username,
            isSubscribed: false,
            source: `eventsub:${type}`,
        });
        return;
    }

    await syncSubscriptionStatus({
        twitchId,
        username,
        isSubscribed: true,
        source: `eventsub:${type}`,
    });

    if (type === "channel.subscribe") {
        await notifyTwitchEngagement({
            kind: "subscription",
            twitchUserId: typeof event.user_id === "string" ? event.user_id : null,
            twitchLogin: typeof event.user_login === "string" ? event.user_login : null,
            twitchDisplayName: typeof event.user_name === "string" ? event.user_name : null,
            tier: typeof event.tier === "string" ? event.tier : null,
        });
        return;
    }

    if (type === "channel.subscription.message") {
        await notifyTwitchEngagement({
            kind: "resubscription",
            twitchUserId: typeof event.user_id === "string" ? event.user_id : null,
            twitchLogin: typeof event.user_login === "string" ? event.user_login : null,
            twitchDisplayName: typeof event.user_name === "string" ? event.user_name : null,
            tier: typeof event.tier === "string" ? event.tier : null,
        });
        return;
    }
}

async function getExistingSubscriptions() {
    const token = await getTwitchAppAccessToken();
    const { clientId } = getEventSubConfig();

    if (!token || !clientId) {
        throw new Error("TWITCH_CLIENT_ID ou app access token da Twitch ausente para listar EventSub.");
    }

    const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "GET",
        headers: {
            "Client-ID": clientId,
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Falha ao listar EventSub subscriptions: ${response.status} ${body}`);
    }

    return (await response.json()) as EventSubListResponse;
}

async function createSubscription(type: (typeof EVENTSUB_TYPES)[number]) {
    const token = await getTwitchAppAccessToken();
    const { clientId, broadcasterId, callback, secret } = getEventSubConfig();
    const moderatorUserId = env.TWITCH_BOT_ID ?? broadcasterId;

    if (!token || !clientId || !broadcasterId || !callback || !secret) {
        throw new Error(
            "Configuracao EventSub incompleta (token/client/callback/secret/broadcaster)."
        );
    }

    const version = type === "channel.follow" ? "2" : "1";
    const condition =
        type === "channel.follow"
            ? {
                broadcaster_user_id: broadcasterId,
                moderator_user_id: moderatorUserId,
            }
            : {
                broadcaster_user_id: broadcasterId,
            };

    const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
            "Client-ID": clientId,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            type,
            version,
            condition,
            transport: {
                method: "webhook",
                callback,
                secret,
            },
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Falha ao criar EventSub (${type}): ${response.status} ${body}`);
    }

    console.log(`[EventSub] Subscription garantida: ${type}`);
}

export async function ensureEventSubSubscriptions() {
    const { callback, secret, broadcasterId, clientId } = getEventSubConfig();

    if (!callback || !secret || !broadcasterId || !clientId) {
        console.warn(
            "[EventSub] Configuracao incompleta. Pulando registro automatico de subscriptions."
        );
        return;
    }

    if (!isValidWebhookCallback(callback)) {
        console.warn(
            `[EventSub] Callback ${callback} nao e um webhook HTTPS publico valido. Pulando registro automatico em ambiente local.`
        );
        return;
    }

    const existing = await getExistingSubscriptions();

    const active = new Set(
        existing.data
            .filter((sub) => sub.status === "enabled")
            .map((sub) => `${sub.type}:${sub.condition.broadcaster_user_id}`)
    );

    for (const type of EVENTSUB_TYPES) {
        const key = `${type}:${broadcasterId}`;
        if (active.has(key)) {
            continue;
        }

        try {
            await createSubscription(type);
        } catch (error) {
            console.error(`[EventSub] Nao foi possivel garantir ${type}:`, error);
        }
    }
}

export function parseEventSubMessageType(
    headers: Record<string, string | string[] | undefined>
) {
    const value = headers["twitch-eventsub-message-type"];

    if (
        value === "webhook_callback_verification" ||
        value === "notification" ||
        value === "revocation"
    ) {
        return value as EventSubMessageType;
    }

    return null;
}
