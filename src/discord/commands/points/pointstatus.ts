import { createCommand } from "#base";
import { appConfig } from "#config";
import { getChannelPointsConfig } from "../../../services/channelPoints.js";
import {
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";

function formatDateTime(date: Date | null) {
  if (!date) {
    return "Nao definido";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatRemainingTime(date: Date | null) {
  if (!date) {
    return "Nao definido";
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

createCommand({
  name: "pointstatus",
  description: "Mostra os multiplicadores de pontos em memoria",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,

  async run(interaction) {
    const config = getChannelPointsConfig();

    const embed = new EmbedBuilder()
      .setColor(appConfig.discord.points.embedColor)
      .setTitle("Status dos Multiplicadores")
      .setDescription("Estado atual em memoria do sistema de pontos.")
      .addFields(
        { name: "Base multiply", value: `x${config.baseMultiply}`, inline: true },
        { name: "Sub Twitch", value: `x${config.subMultiply}`, inline: true },
        { name: "Booster Discord", value: `x${config.boosterMultiply}`, inline: true },
        { name: "Event multiply", value: `x${config.eventMultiply}`, inline: true },
        { name: "Evento ativo", value: config.eventMultiplierActive ? "Sim" : "Nao", inline: true },
        { name: "Nome do evento", value: config.activeEventName ?? "Nenhum", inline: true },
        { name: "Termina em", value: config.eventMultiplierActive ? formatRemainingTime(config.eventEndsAt) : "Nenhum evento ativo", inline: false },
        { name: "Fim previsto", value: config.eventMultiplierActive ? formatDateTime(config.eventEndsAt) : "Nenhum evento ativo", inline: false },
        { name: "Base de pontos", value: `${config.points}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
});
