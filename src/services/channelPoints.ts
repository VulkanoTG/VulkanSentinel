import { appConfig, env } from "#config";
import { prisma } from "#database";
import { GUILD_EVENT_START_BUFFER_MS, closeChannelPointsGuildEvent } from "./channelPointGuildEvent.js";
import { getTwitchClient, hasTwitchClient } from "./twitch.js";

const defaultChannelPointsConfig = appConfig.twitch.channelPoints;

type ChannelPointsRuntimeConfig = {
  points: number;
  baseMultiply: number;
  subMultiply: number;
  boosterMultiply: number;
  eventMultiply: number;
  eventMultiplierActive: boolean;
  activeEventName: string | null;
  activeEventDescription: string | null;
  eventStartsAt: Date | null;
  eventEndsAt: Date | null;
};

const channelPointsConfig: ChannelPointsRuntimeConfig = {
  ...defaultChannelPointsConfig,
  activeEventDescription: null,
  eventStartsAt: null,
  eventEndsAt: null,
};
let eventStartTimeout: NodeJS.Timeout | null = null;
let eventEndTimeout: NodeJS.Timeout | null = null;

type ChannelPointsInput = {
  userId: number;
  baseHours?: number;
};

type ChannelPointFlags = {
  isTwitchSub: boolean;
  isDiscordBooster: boolean;
  balanceMultiplier?: number;
};

export function getChannelPointBreakdown({
  isTwitchSub,
  isDiscordBooster,
  balanceMultiplier = 1,
}: ChannelPointFlags) {
  const currentConfig = getChannelPointsConfig();
  const multipliers = [
    {
      label: "Base",
      value: currentConfig.baseMultiply,
      active: true,
    },
    {
      label: "Sub Twitch",
      value: currentConfig.subMultiply,
      active: isTwitchSub,
    },
    {
      label: "Booster Discord",
      value: currentConfig.boosterMultiply,
      active: isDiscordBooster,
    },
    {
      label: currentConfig.activeEventName
        ? `Evento: ${currentConfig.activeEventName}`
        : "Evento",
      value: currentConfig.eventMultiply,
      active: currentConfig.eventMultiplierActive && currentConfig.eventMultiply > 1,
    },
    {
      label: "Bonus Individual",
      value: balanceMultiplier,
      active: balanceMultiplier > 1,
    },
  ];

  const activeMultipliers = multipliers.filter((multiplier) => multiplier.active);
  const totalMultiplier = activeMultipliers.reduce((total, multiplier) => {
    return total * multiplier.value;
  }, 1);

  return {
    basePoints: currentConfig.points,
    totalMultiplier,
    activeBonuses: activeMultipliers,
  };
}

export function getChannelPointsConfig() {
  if (channelPointsConfig.eventEndsAt && channelPointsConfig.eventEndsAt.getTime() <= Date.now()) {
    clearEventState();
  }

  if (
    !channelPointsConfig.eventMultiplierActive &&
    channelPointsConfig.activeEventName &&
    channelPointsConfig.eventStartsAt &&
    channelPointsConfig.eventStartsAt.getTime() <= Date.now() &&
    channelPointsConfig.eventEndsAt &&
    channelPointsConfig.eventEndsAt.getTime() > Date.now()
  ) {
    activateScheduledEvent();
  }

  return { ...channelPointsConfig };
}

function clearEventStartTimeout() {
  if (!eventStartTimeout) {
    return;
  }

  clearTimeout(eventStartTimeout);
  eventStartTimeout = null;
}

function clearEventTimeout() {
  if (!eventEndTimeout) {
    return;
  }

  clearTimeout(eventEndTimeout);
  eventEndTimeout = null;
}

function clearEventState() {
  clearEventStartTimeout();
  clearEventTimeout();
  channelPointsConfig.eventMultiplierActive = false;
  channelPointsConfig.activeEventName = null;
  channelPointsConfig.activeEventDescription = null;
  channelPointsConfig.eventStartsAt = null;
  channelPointsConfig.eventEndsAt = null;
  channelPointsConfig.eventMultiply = 1;
}

async function announceEventEnded(eventName: string) {
  if (!hasTwitchClient()) {
    console.warn(`[ChannelPoints] Evento ${eventName} encerrado, mas o cliente da Twitch nao esta disponivel para avisar no chat.`);
    return;
  }

  try {
    await getTwitchClient().say(
      `#${env.TWITCH_CHANNEL}`,
      `O evento ${eventName} terminou. O multiplicador extra de pontos foi encerrado.`
    );
    console.log(`[ChannelPoints] Aviso de encerramento enviado na Twitch para o evento ${eventName}.`);
  } catch {
    // Mantem o encerramento do evento mesmo se o aviso falhar.
    console.error(`[ChannelPoints] Falha ao enviar aviso de encerramento na Twitch para o evento ${eventName}.`);
  }
}

async function announceEventStarted(eventName: string, multiplier: number) {
  if (!hasTwitchClient()) {
    console.warn(`[ChannelPoints] Evento ${eventName} ativado, mas o cliente da Twitch nao esta disponivel para avisar no chat.`);
    return;
  }

  try {
    await getTwitchClient().say(
      `#${env.TWITCH_CHANNEL}`,
      `O evento ${eventName} comecou agora. O multiplicador extra de pontos esta ativo em x${multiplier}.`
    );
    console.log(`[ChannelPoints] Aviso de inicio enviado na Twitch para o evento ${eventName}.`);
  } catch {
    console.error(`[ChannelPoints] Falha ao enviar aviso de inicio na Twitch para o evento ${eventName}.`);
  }
}

function scheduleEventEnd(eventName: string, durationMs: number) {
  clearEventTimeout();
  console.log(`[ChannelPoints] Encerramento automatico agendado para o evento ${eventName} em ${durationMs}ms.`);

  eventEndTimeout = setTimeout(() => {
    clearEventState();
    console.log(`[ChannelPoints] Evento encerrado automaticamente: ${eventName}.`);
    void closeChannelPointsGuildEvent("timeout");
    void announceEventEnded(eventName);
  }, durationMs);
}

function activateScheduledEvent() {
  if (!channelPointsConfig.activeEventName || channelPointsConfig.eventMultiplierActive) {
    return;
  }

  channelPointsConfig.eventMultiplierActive = true;
  console.log(
    `[ChannelPoints] Evento ativado no bot: ${channelPointsConfig.activeEventName} com multiplicador x${channelPointsConfig.eventMultiply}.`
  );
  void announceEventStarted(
    channelPointsConfig.activeEventName,
    channelPointsConfig.eventMultiply
  );
}

function scheduleEventActivation(eventName: string, startsInMs: number) {
  clearEventStartTimeout();
  console.log(`[ChannelPoints] Ativacao do bot agendada para o evento ${eventName} em ${startsInMs}ms.`);

  eventStartTimeout = setTimeout(() => {
    activateScheduledEvent();
  }, startsInMs);
}

export function setBaseMultiply(value: number) {
  channelPointsConfig.baseMultiply = value;
  return getChannelPointsConfig();
}

export function setEventMultiply(value: number) {
  channelPointsConfig.eventMultiply = value;
  return getChannelPointsConfig();
}

export function setEventState(active: boolean, eventName?: string | null) {
  channelPointsConfig.eventMultiplierActive = active;
  channelPointsConfig.activeEventName = active
    ? eventName?.trim() || channelPointsConfig.activeEventName || "Evento especial"
    : null;
  channelPointsConfig.activeEventDescription = active
    ? channelPointsConfig.activeEventDescription
    : null;
  channelPointsConfig.eventStartsAt = active ? channelPointsConfig.eventStartsAt : null;
  channelPointsConfig.eventEndsAt = active ? channelPointsConfig.eventEndsAt : null;

  if (!active) {
    clearEventStartTimeout();
    clearEventTimeout();
  }

  return getChannelPointsConfig();
}

export function startTimedEvent(
  eventName: string,
  multiplier: number,
  durationMs: number,
  eventDescription?: string | null
) {
  const startsAt = new Date(Date.now() + GUILD_EVENT_START_BUFFER_MS);
  const endsAt = new Date(startsAt.getTime() + durationMs);

  channelPointsConfig.eventMultiplierActive = false;
  channelPointsConfig.activeEventName = eventName.trim();
  channelPointsConfig.activeEventDescription = eventDescription?.trim() || null;
  channelPointsConfig.eventMultiply = multiplier;
  channelPointsConfig.eventStartsAt = startsAt;
  channelPointsConfig.eventEndsAt = endsAt;
  scheduleEventActivation(channelPointsConfig.activeEventName, startsAt.getTime() - Date.now());
  scheduleEventEnd(channelPointsConfig.activeEventName, endsAt.getTime() - Date.now());

  return getChannelPointsConfig();
}

export function stopTimedEvent() {
  clearEventState();

  return getChannelPointsConfig();
}

export function stopTimedEventFromDiscord() {
  const eventName = channelPointsConfig.activeEventName;

  if (!eventName) {
    return false;
  }

  clearEventState();
  console.log(`[ChannelPoints] Evento encerrado manualmente pelo Discord: ${eventName}.`);
  void announceEventEnded(eventName);
  return true;
}

export async function calculateChannelPoints({
  userId,
  baseHours = 10 / 60,
}: ChannelPointsInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isTwitchSub: true,
      isDiscordBooster: true,
      balancemultiplier: true,
    },
  });

  if (!user) {
    const breakdown = getChannelPointBreakdown({
      isTwitchSub: false,
      isDiscordBooster: false,
      balanceMultiplier: 1,
    });

    return {
      points: Math.floor(channelPointsConfig.points * breakdown.totalMultiplier),
      hours: baseHours,
      multiplier: breakdown.totalMultiplier,
      activeBonuses: breakdown.activeBonuses,
    };
  }

  const breakdown = getChannelPointBreakdown({
    isTwitchSub: user.isTwitchSub,
    isDiscordBooster: user.isDiscordBooster,
    balanceMultiplier: user.balancemultiplier,
  });

  return {
    points: Math.floor(channelPointsConfig.points * breakdown.totalMultiplier),
    hours: baseHours,
    multiplier: breakdown.totalMultiplier,
    activeBonuses: breakdown.activeBonuses,
  };
}
