import { appConfig } from "#config";
import { EmbedBuilder } from "discord.js";
import {
  getChannelPointsConfig,
  setBaseMultiply,
  startTimedEvent,
  stopTimedEvent,
} from "./channelPoints.js";
import {
  closeChannelPointsGuildEvent,
  createChannelPointsGuildEvent,
} from "./channelPointGuildEvent.js";

type AdminResult = {
  ok: boolean;
  message: string;
};

type ChannelPointsEventSource = "discord" | "twitch" | "system";

function formatDateTime(date: Date | null) {
  if (!date) {
    return "Nao definido";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function normalizeMultiplier(value: number) {
  return Number(value.toFixed(2));
}

function parseMultiplierInput(input: string | number) {
  const value = typeof input === "number" ? input : Number(input.replace(",", "."));

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return normalizeMultiplier(value);
}

export function updateBaseMultiplier(input: string | number): AdminResult {
  const value = parseMultiplierInput(input);

  if (value === null) {
    return {
      ok: false,
      message: "Informe um multiplicador valido maior que 0. Exemplo: 1.5",
    };
  }

  const previous = getChannelPointsConfig().baseMultiply;
  setBaseMultiply(value);
  console.log(`[ChannelPoints] Base multiply alterado de x${previous} para x${value}.`);

  return {
    ok: true,
    message: `Base multiply atualizado para x${value}.`,
  };
}

export function updateEventMultiplier(_input: string | number): AdminResult {
  return {
    ok: false,
    message: "O event multiply agora e definido pelo comando eventstart.",
  };
}

export function updateEventStatus(active: boolean, _eventName?: string | null): AdminResult {
  return {
    ok: false,
    message: active
      ? "Use eventstart <nome> <tempo> <multiplicador> para ativar um evento."
      : "Use eventstart com a opcao de encerrar para desligar o evento.",
  };
}

function parseDurationInput(input: string) {
  const normalized = input.trim().toLowerCase();
  const match = normalized.match(/^(\d+)(s|m|h|d)$/);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const unitMap: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * unitMap[unit];
}

function formatRemainingTime(endsAt: Date | null) {
  if (!endsAt) {
    return "sem tempo definido";
  }

  const remainingMs = Math.max(0, endsAt.getTime() - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function formatWindow(startAt: Date | null, endAt: Date | null) {
  if (!startAt || !endAt) {
    return "Nao definido";
  }

  return `${formatDateTime(startAt)} ate ${formatDateTime(endAt)}`;
}

export function buildChannelPointsEventEmbed(params: {
  type: "started" | "stopped";
  source: ChannelPointsEventSource;
}) {
  const config = getChannelPointsConfig();
  const sourceLabel = {
    discord: "Discord",
    twitch: "Twitch",
    system: "Sistema",
  }[params.source];

  if (params.type === "stopped") {
    return new EmbedBuilder()
      .setColor(appConfig.discord.points.embedColor)
      .setTitle("Evento de Pontos Encerrado")
      .setDescription("O evento de pontos foi encerrado.")
      .addFields(
        { name: "Origem", value: sourceLabel, inline: true },
        { name: "Event multiply", value: `x${config.eventMultiply}`, inline: true }
      )
      .setFooter({ text: "Vulkan Sentinel - Eventos de Pontos" })
      .setTimestamp();
  }

  if (!config.eventMultiplierActive) {
    const embed = new EmbedBuilder()
      .setColor(appConfig.discord.points.embedColor)
      .setTitle("Evento de Pontos Agendado")
      .setDescription(
        `Evento: **${config.activeEventName ?? "Sem nome"}** agendado com multiplicador **x${config.eventMultiply}**.`
      )
      .addFields({ name: "Origem", value: sourceLabel, inline: true })
      .setFooter({ text: "Vulkan Sentinel - Eventos de Pontos" })
      .setTimestamp();

    if (config.activeEventDescription) {
      embed.addFields({
        name: "Descricao",
        value: config.activeEventDescription,
        inline: false,
      });
    }

    embed.addFields({
      name: "Janela",
      value: formatWindow(config.eventStartsAt, config.eventEndsAt),
      inline: false,
    });

    return embed;
  }

  const embed = new EmbedBuilder()
    .setColor(appConfig.discord.points.embedColor)
    .setTitle("Evento de Pontos Ativo")
    .setDescription(
      `Evento: **${config.activeEventName ?? "Sem nome"}** ativo por **${formatRemainingTime(config.eventEndsAt)}** com o multiplicador **x${config.eventMultiply}**.`
    )
    .addFields({ name: "Origem", value: sourceLabel, inline: true })
    .setFooter({ text: "Vulkan Sentinel - Eventos de Pontos" })
    .setTimestamp();

  if (config.activeEventDescription) {
    embed.addFields({
      name: "Descricao",
      value: config.activeEventDescription,
      inline: false,
    });
  }

  embed.addFields({
    name: "Expira em",
    value: formatDateTime(config.eventEndsAt),
    inline: true,
  });

  return embed;
}

export async function syncChannelPointsGuildEvent(params: {
  type: "started" | "stopped";
  source: ChannelPointsEventSource;
}) {
  const config = getChannelPointsConfig();

  if (params.type === "stopped") {
    await closeChannelPointsGuildEvent("manual");
    return;
  }

  if (!config.activeEventName || !config.eventStartsAt || !config.eventEndsAt) {
    return;
  }

  await createChannelPointsGuildEvent({
    eventName: config.activeEventName,
    description: config.activeEventDescription,
    multiplier: config.eventMultiply,
    startsAt: config.eventStartsAt,
    endsAt: config.eventEndsAt,
    source: params.source,
  });
}

export function startEventWithDuration(
  eventName: string,
  durationInput: string,
  multiplierInput: string | number,
  eventDescription?: string | null
): AdminResult {
  const cleanName = eventName.trim();

  if (!cleanName) {
    return {
      ok: false,
      message: "Informe o nome do evento.",
    };
  }

  const durationMs = parseDurationInput(durationInput);

  if (!durationMs) {
    return {
      ok: false,
      message: "Tempo invalido. Use formatos como 30m, 2h ou 1d.",
    };
  }

  const multiplier = parseMultiplierInput(multiplierInput);

  if (multiplier === null) {
    return {
      ok: false,
      message: "Informe um multiplicador valido maior que 0. Exemplo: 2",
    };
  }

  const previous = getChannelPointsConfig();
  const config = startTimedEvent(cleanName, multiplier, durationMs, eventDescription);
  const replacedEventText = previous.eventMultiplierActive
    ? ` Evento anterior substituido: ${previous.activeEventName ?? "Sem nome"}.`
    : "";
  console.log(
    `[ChannelPoints] Evento ativado: ${config.activeEventName} | multiplicador x${config.eventMultiply} | duracao ${durationInput}.${replacedEventText}`
  );

  return {
    ok: true,
    message: `Evento agendado: ${config.activeEventName}. Comeca em ${formatDateTime(config.eventStartsAt)} e termina em ${formatDateTime(config.eventEndsAt)} com multiplicador x${config.eventMultiply}.`,
  };
}

export function stopEventNow(): AdminResult {
  const config = getChannelPointsConfig();

  if (!config.activeEventName) {
    return {
      ok: false,
      message: "Nao ha nenhum evento ativo ou agendado agora.",
    };
  }

  const eventName = config.activeEventName ?? "Sem nome";
  stopTimedEvent();
  console.log(`[ChannelPoints] Evento desativado manualmente: ${eventName}.`);

  return {
    ok: true,
    message: "Evento de pontos encerrado.",
  };
}

export function getChannelPointsStatusText() {
  const config = getChannelPointsConfig();

  return [
    `Base multiply: x${config.baseMultiply}`,
    `Sub Twitch: x${config.subMultiply}`,
    `Booster Discord: x${config.boosterMultiply}`,
    `Event multiply: x${config.eventMultiply}`,
    config.activeEventName
      ? `Evento: ${config.activeEventName} (${config.eventMultiplierActive ? "ativo" : "agendado"})`
      : "Evento: nenhum",
    config.eventStartsAt
      ? `Comeca em: ${formatDateTime(config.eventStartsAt)}`
      : "Comeca em: -",
    config.eventEndsAt
      ? `Termina em: ${formatRemainingTime(config.eventEndsAt)}`
      : "Termina em: -",
  ].join(" | ");
}
