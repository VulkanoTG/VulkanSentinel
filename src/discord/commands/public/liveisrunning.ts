import { createCommand } from "#base";
import {
    ApplicationCommandType,
    EmbedBuilder,
    PermissionFlagsBits
} from "discord.js";

import { isStreamOnline } from "#helix";

createCommand({
  name: "live",
  description: "Verifica se a live está online",
  type: ApplicationCommandType.ChatInput,

  // 🔒 Apenas moderadores (pode trocar a permissão se quiser)
  defaultMemberPermissions: PermissionFlagsBits.ManageMessages,

  async run(interaction) {

    await interaction.deferReply({ ephemeral: true });

    try {
      const online = await isStreamOnline();

      const embed = new EmbedBuilder()
        .setTitle("Status da Live")
        .setTimestamp();

      if (online) {
        embed
          .setColor(0x9146FF) // Roxo Twitch
          .setDescription("🔴 A live está **ONLINE** agora!")
          .setURL(`https://twitch.tv/${process.env.TWITCH_CHANNEL}`);
      } else {
        embed
          .setColor(0x2F3136)
          .setDescription("⚫ A live está **offline** no momento.");
      }

      await interaction.editReply({
        embeds: [embed],
      });

    } catch (error) {
      console.error(error);

      await interaction.editReply({
        content: "⚠️ Erro ao verificar status da live."
      });
    }
  }
});