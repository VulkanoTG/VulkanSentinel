import { createCommand } from "#base";
import {
  buildChannelPointsEventEmbed,
  syncChannelPointsGuildEvent,
  startEventWithDuration,
} from "../../../services/channelPointsAdmin.js";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  PermissionFlagsBits,
} from "discord.js";

createCommand({
  name: "eventstart",
  description: "Inicia um evento de pontos",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [
    {
      name: "name",
      description: "Nome do evento",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "tempo",
      description: "Duracao do evento. Ex: 30m, 2h, 1d",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "multiplicador",
      description: "Multiplicador do evento",
      type: ApplicationCommandOptionType.Number,
      required: true,
    },
    {
      name: "descricao",
      description: "Descricao opcional do evento",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],

  async run(interaction) {
    const eventName = interaction.options.getString("name", true);
    const durationInput = interaction.options.getString("tempo", true);
    const multiplier = interaction.options.getNumber("multiplicador", true);
    const description = interaction.options.getString("descricao");
    const result = startEventWithDuration(eventName, durationInput, multiplier, description);
    const embed = buildChannelPointsEventEmbed({
      type: "started",
      source: "discord",
    });

    if (result.ok) {
      await syncChannelPointsGuildEvent({
        type: "started",
        source: "discord",
      });
    }

    await interaction.reply({
      content: result.ok ? undefined : result.message,
      embeds: result.ok ? [embed] : [],
      ephemeral: true,
    });
  },
});
