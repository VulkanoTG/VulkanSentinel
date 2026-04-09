import { env } from "#env";
import { EmbedBuilder } from "discord.js";
import crypto from "node:crypto";
import { syncSubscriptionStatus } from "../twitch/events/subTracker.js";
import { sendEmbedToChannel } from "./discord.js";
import { getCurrentStream } from "./twitchHelix.js";
import { getTwitchAccessToken } from "./twitchAuth.js";

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
    "channel.online",
    "channel.subscribe",
    "channel.subscription.message",
    "channel.subscription.gift",
    "channel.subscription.end",
] as const;

const LIVE_ALERT_CHANNEL_ID = "1442332409906331809";

function getEventSubConfig() {
    return {
        callback: env.TWITCH_EVENTSUB_CALLBACK,
        secret: env.TWITCH_EVENTSUB_SECRET,
        broadcasterId: env.TWITCH_BROADCASTER_ID,
        clientId: env.TWITCH_CLIENT_ID,
    };
}

function buildSignature(messageId: string, timestamp: string, rawBody: string, secret: string) {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(messageId + timestamp + rawBody);
    return `sha256=${hmac.digest("hex")}`;
}

export function verifyEventSubSignature(headers: Record<string, string | string[] | undefined>, rawBody: string) {
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

    if (type === "channel.online") {
        await notifyDiscordOnLiveStart(event);
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
}

async function notifyDiscordOnLiveStart(event: Record<string, string | boolean | number | null | undefined>) {
    const broadcasterName =
        (typeof event.broadcaster_user_name === "string" && event.broadcaster_user_name) ||
        env.TWITCH_CHANNEL;

    const stream = await getCurrentStream().catch((error) => {
        console.error("[EventSub] Erro ao buscar detalhes da live:", error);
        return null;
    });

    const streamUrl = `https://twitch.tv/${env.TWITCH_CHANNEL}`;
    const title = stream?.title ?? "A live comecou agora";
    const game = stream?.game_name ?? null;
    const thumbnail = stream?.thumbnail_url
        ?.replace("{width}", "1280")
        .replace("{height}", "720");

    const embed = new EmbedBuilder()
        .setColor(0x9146ff)
        .setTitle(`${broadcasterName} esta ao vivo!`)
        .setURL(streamUrl)
        .setDescription(`A live acabou de comecar na Twitch.\n\n**${title}**`)
        .addFields(
            { name: "Canal", value: `[twitch.tv/${env.TWITCH_CHANNEL}](${streamUrl})`, inline: true },
            { name: "Status", value: "Ao vivo", inline: true },
            { name: "Categoria", value: game ?? "Nao informada", inline: true }
        )
        .setTimestamp();

    if (thumbnail) {
        embed.setImage(thumbnail);
    }

    await sendEmbedToChannel(LIVE_ALERT_CHANNEL_ID, embed);
}

async function getExistingSubscriptions() {
    const token = await getTwitchAccessToken();
    const { clientId } = getEventSubConfig();

    if (!token || !clientId) {
        throw new Error("TWITCH_CLIENT_ID ou token da Twitch ausente para listar EventSub.");
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
    const token = await getTwitchAccessToken();
    const { clientId, broadcasterId, callback, secret } = getEventSubConfig();

    if (!token || !clientId || !broadcasterId || !callback || !secret) {
        throw new Error("Configuração EventSub incompleta (token/client/callback/secret/broadcaster). ");
    }

    const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
            "Client-ID": clientId,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            type,
            version: "1",
            condition: {
                broadcaster_user_id: broadcasterId,
            },
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
        console.warn("[EventSub] Configuração incompleta. Pulando registro automático de subscriptions.");
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

        await createSubscription(type);
    }
}

export function parseEventSubMessageType(headers: Record<string, string | string[] | undefined>) {
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
