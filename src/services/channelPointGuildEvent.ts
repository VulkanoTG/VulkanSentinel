import { env } from "#config";
import {
  type GuildScheduledEvent,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
} from "discord.js";
import { getDiscordClient } from "./discord.js";

type ChannelPointsEventSource = "discord" | "twitch" | "system";

let activeGuildScheduledEventId: string | null = null;
export const GUILD_EVENT_START_BUFFER_MS = 60 * 1000;
let suppressNextManualSync = false;

async function getGuild() {
  if (!env.GUILD_ID) {
    throw new Error("GUILD_ID nao configurado para criar evento da guilda.");
  }

  return getDiscordClient().guilds.fetch(env.GUILD_ID);
}

export async function createChannelPointsGuildEvent(params: {
  eventName: string;
  description?: string | null;
  multiplier: number;
  startsAt: Date;
  endsAt: Date;
  source: ChannelPointsEventSource;
}) {
  const guild = await getGuild();

  if (activeGuildScheduledEventId) {
    await closeChannelPointsGuildEvent("replaced").catch(() => null);
  }

  const createdEvent = await guild.scheduledEvents.create({
    name: params.eventName,
    scheduledStartTime: params.startsAt,
    scheduledEndTime: params.endsAt,
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    entityType: GuildScheduledEventEntityType.External,
    entityMetadata: {
      location: `https://twitch.tv/${env.TWITCH_CHANNEL}`,
    },
    description: params.description
      ? `${params.description}\n\nMultiplicador: x${params.multiplier}`
      : `Multiplicador: x${params.multiplier}`,
    reason: `Evento de pontos iniciado via ${params.source}`,
  });

  activeGuildScheduledEventId = createdEvent.id;

  console.log(
    `[ChannelPoints] Evento da guilda criado/atualizado: ${createdEvent.id} para ${params.eventName}. Inicio agendado para ${params.startsAt.toLocaleString("pt-BR")}.`
  );

  return createdEvent;
}

export async function closeChannelPointsGuildEvent(reason: "manual" | "timeout" | "replaced") {
  if (!activeGuildScheduledEventId) {
    return;
  }

  const guild = await getGuild();
  const scheduledEvent = await guild.scheduledEvents
    .fetch(activeGuildScheduledEventId)
    .catch(() => null);

  activeGuildScheduledEventId = null;

  if (!scheduledEvent) {
    return;
  }

  suppressNextManualSync = true;

  if (scheduledEvent.status === GuildScheduledEventStatus.Scheduled) {
    await scheduledEvent.setStatus(
      GuildScheduledEventStatus.Canceled,
      `Evento de pontos encerrado (${reason})`
    ).catch(() => null);
    return;
  }

  if (scheduledEvent.status === GuildScheduledEventStatus.Active) {
    await scheduledEvent.setStatus(
      GuildScheduledEventStatus.Completed,
      `Evento de pontos encerrado (${reason})`
    ).catch(() => null);
  }
}

export function isManagedChannelPointsGuildEvent(event: GuildScheduledEvent | null) {
  return Boolean(event && activeGuildScheduledEventId && event.id === activeGuildScheduledEventId);
}

export function shouldSuppressChannelPointsGuildEventSync() {
  if (!suppressNextManualSync) {
    return false;
  }

  suppressNextManualSync = false;
  return true;
}
