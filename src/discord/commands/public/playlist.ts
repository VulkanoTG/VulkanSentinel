import { createCommand } from "#base";
import { appConfig } from "#config";
import {
  ApplicationCommandType,
  EmbedBuilder,
} from "discord.js";
import { getSpotifyQueueSnapshot } from "../../../spotify/service.js";

function formatQueueTrack(index: number, track: { name: string; artist: string }) {
  return `\`${index}.\` **${track.name}**\n${track.artist}`;
}

createCommand({
  name: "playlist",
  description: "Mostra a fila atual de musicas do Spotify",
  type: ApplicationCommandType.ChatInput,

  async run(interaction) {
    await interaction.deferReply();

    try {
      const snapshot = await getSpotifyQueueSnapshot({ limit: 6 });

      if (!snapshot.availability.ok) {
        await interaction.editReply({
          content: snapshot.availability.message,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(appConfig.discord.profile.embedColor)
        .setTitle("Playlist atual")
        .setDescription(
          snapshot.currentTrack
            ? `**Tocando agora:** ${snapshot.currentTrack.name} - ${snapshot.currentTrack.artist}`
            : "Nenhuma musica tocando agora."
        )
        .setTimestamp();

      if (snapshot.currentTrack?.artworkUrl) {
        embed.setThumbnail(snapshot.currentTrack.artworkUrl);
      }

      embed.addFields({
        name: "Proximas da fila",
        value: snapshot.queue.length
          ? snapshot.queue.map((track, index) => formatQueueTrack(index + 1, track)).join("\n\n")
          : "A fila esta vazia no momento.",
      });

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("[Spotify] Erro no comando /playlist:", error);
      await interaction.editReply({
        content: "Falha ao consultar a fila do Spotify.",
      });
    }
  },
});
