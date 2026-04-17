import { getChannelPointsConfig } from "../../../services/channelPoints.js";
import { createTwitchCommand } from "../../base.js";

function formatDateTime(date: Date | null) {
  if (!date) {
    return "nao definido";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatRemainingTime(date: Date | null) {
  if (!date) {
    return "nao definido";
  }

  const remainingMs = Math.max(0, date.getTime() - Date.now());
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

createTwitchCommand({
  name: "events",
  description: "Mostra o evento de pontos atual",
  async run(client, channel) {
    const config = getChannelPointsConfig();

    if (!config.activeEventName || !config.eventEndsAt) {
      await client.say(channel, "Nenhum evento de pontos ativo ou agendado no momento.");
      return;
    }

    if (!config.eventMultiplierActive && config.eventStartsAt) {
      await client.say(
        channel,
        `Evento agendado: ${config.activeEventName}. Comeca as ${formatDateTime(config.eventStartsAt)} com multiplicador x${config.eventMultiply}.`
      );
      return;
    }

    await client.say(
      channel,
      `Evento ativo: ${config.activeEventName}. Multiplicador x${config.eventMultiply}. Termina em ${formatRemainingTime(config.eventEndsAt)}.`
    );
  },
});
