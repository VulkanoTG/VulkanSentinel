import { createCommand } from "#base";
import { appConfig, env } from "#config";
import {
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getLiveStatusSnapshot } from "../../../services/liveStatus.js";

createCommand({
  name: "live",
  description: "Verifica se a live esta online",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.ManageMessages,

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { initialized, isLive } = getLiveStatusSnapshot();

      const embed = new EmbedBuilder()
        .setTitle("Status da Live")
        .setTimestamp();

      if (!initialized) {
        embed
          .setColor(appConfig.twitch.liveNotifier.offlineColor)
          .setDescription("O status da live ainda esta sendo carregado.");
      } else if (isLive) {
        embed
          .setColor(appConfig.twitch.liveNotifier.embedColor)
          .setDescription("A live esta ONLINE agora!")
          .setURL(`https://twitch.tv/${env.TWITCH_CHANNEL}`);
      } else {
        embed
          .setColor(appConfig.twitch.liveNotifier.offlineColor)
          .setDescription("A live esta offline no momento.");
      }

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error(error);

      await interaction.editReply({
        content: "Erro ao verificar status da live.",
      });
    }
  },
});
