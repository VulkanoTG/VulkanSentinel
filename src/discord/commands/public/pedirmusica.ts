import { createCommand } from "#base";
import { appConfig } from "#config";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { requestSpotifyTrackReward } from "../../../spotify/reward.js";

createCommand({
  name: "pedirmusica",
  description: "Busca uma musica no Spotify e adiciona na fila da conta configurada",
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
  options: [
    {
      name: "musica",
      description: "Nome da musica",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "artista",
      description: "Nome do artista",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],

  async run(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("musica", true);
    const artist = interaction.options.getString("artista");

    try {
      const result = await requestSpotifyTrackReward({
        discordId: interaction.user.id,
        title,
        artist,
      });

      if (!result.ok) {
        await interaction.editReply({
          content: result.message,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(appConfig.colors.success)
        .setTitle("Musica adicionada na fila do Spotify")
        .setDescription(`**${result.track.name}** - **${result.track.artist}**`)
        .addFields(
          { name: "Album", value: result.track.album, inline: true },
          { name: "Solicitado por", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Custo", value: `${result.chargedAmount} Firecoins`, inline: true },
          { name: "Saldo restante", value: `${result.balanceAfter}`, inline: true },
          { name: "Link", value: result.track.url ?? "Nao disponivel", inline: false }
        )
        .setTimestamp();

      if (result.track.artworkUrl) {
        embed.setThumbnail(result.track.artworkUrl);
      }

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("[Spotify] Erro no comando /pedirmusica:", error);
      await interaction.editReply({
        content: "Falha inesperada ao processar o pedido de musica.",
      });
    }
  },
});
