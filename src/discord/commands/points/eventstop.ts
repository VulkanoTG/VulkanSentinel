import { createCommand } from "#base";
import {
  buildChannelPointsEventEmbed,
  syncChannelPointsGuildEvent,
  stopEventNow,
} from "../../../services/channelPointsAdmin.js";
import {
  ApplicationCommandType,
  PermissionFlagsBits,
} from "discord.js";

createCommand({
  name: "eventstop",
  description: "Encerra um evento de pontos ativo ou agendado",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,

  async run(interaction) {
    const result = stopEventNow();
    const embed = buildChannelPointsEventEmbed({
      type: "stopped",
      source: "discord",
    });

    if (result.ok) {
      await syncChannelPointsGuildEvent({
        type: "stopped",
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
