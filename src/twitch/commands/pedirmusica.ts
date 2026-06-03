import { sendBotChatMessage } from "../../services/twitchChat.js";
import { requestSpotifyTrackReward } from "../../spotify/reward.js";
import { createTwitchCommand } from "../base.js";
import { isTwitchPointsAdmin } from "./points/shared.js";

createTwitchCommand({
  name: "pedirmusica",
  alias: ["sr"],
  description: "Busca uma música no Spotify e adiciona à fila da conta configurada",
  async run(client, channel, tags, args) {
    if (!isTwitchPointsAdmin(tags)) {
      await sendBotChatMessage(client, channel, `@${tags.username}, você não tem permissão para esse comando.`);
      return;
    }

    if (args.length === 0) {
      await sendBotChatMessage(
        client,
        channel,
        `@${tags.username}, uso: !pedirmusica <música> | <artista opcional>`
      );
      return;
    }

    const rawInput = args.join(" ").trim();
    const [title, artist] = rawInput.split("|").map((part) => part.trim());

    if (!title) {
      await sendBotChatMessage(
        client,
        channel,
        `@${tags.username}, informe o nome da música.`
      );
      return;
    }

    try {
      const result = await requestSpotifyTrackReward({
        twitchId: tags["user-id"],
        title,
        artist,
      });

      if (!result.ok) {
        await sendBotChatMessage(client, channel, `@${tags.username}, ${result.message}`);
        return;
      }

      await sendBotChatMessage(
        client,
        channel,
        `@${tags.username}, adicionado na fila: ${result.track.name} - ${result.track.artist}. Custo: ${result.chargedAmount}. Saldo restante: ${result.balanceAfter}.`
      );
    } catch (error) {
      console.error("[Spotify] Erro no comando !pedirmusica:", error);
      await sendBotChatMessage(
        client,
        channel,
        `@${tags.username}, ocorreu uma falha inesperada ao processar o pedido de música.`
      );
    }
  },
});
