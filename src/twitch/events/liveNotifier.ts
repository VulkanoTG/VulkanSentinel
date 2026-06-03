import { appConfig, env } from "#config";
import { EmbedBuilder } from "discord.js";
import { sendEmbedToChannel } from "../../services/discord.js";
import {
  getLiveStatusSnapshot,
  onLiveStatusChange,
  type LiveStatusSnapshot,
} from "../../services/liveStatus.js";
import { type TwitchStream } from "../../services/twitchHelix.js";
import { buildTwitchStreamPreviewUrl } from "../../services/twitchStreamPreview.js";

function buildLiveEmbed(stream: TwitchStream) {
  const streamUrl = `https://twitch.tv/${env.TWITCH_CHANNEL}`;
  const thumbnail = buildTwitchStreamPreviewUrl({
    stream,
    cacheKey: `${stream.id}:${stream.started_at}:${Date.now()}`,
  });

  return new EmbedBuilder()
    .setColor(appConfig.twitch.liveNotifier.embedColor)
    .setTitle(`${stream.user_name} esta ao vivo!`)
    .setURL(streamUrl)
    .setDescription(`**${stream.title}**`)
    .addFields(
      { name: "Canal", value: `[twitch.tv/${env.TWITCH_CHANNEL}](${streamUrl})`, inline: true },
      { name: "Categoria", value: stream.game_name || "Nao informada", inline: true },
      { name: "Viewers", value: String(stream.viewer_count), inline: true }
    )
    .setImage(thumbnail)
    .setTimestamp(new Date(stream.started_at));
}

async function handleLiveTransition(
  next: LiveStatusSnapshot,
  previous: LiveStatusSnapshot
) {
  if (!next.isLive || previous.isLive || !next.stream) {
    return;
  }

  await sendEmbedToChannel(
    appConfig.twitch.liveNotifier.alertChannelId,
    buildLiveEmbed(next.stream)
  );
  console.log("[Twitch] Aviso de live enviado para o Discord.");
}

export async function startLiveNotifier() {
  const initial = getLiveStatusSnapshot();
  if (!initial.initialized) {
    console.warn("[Twitch] Live notifier iniciou antes do estado de live ser carregado.");
  }

  onLiveStatusChange((next, previous) => {
    void handleLiveTransition(next, previous).catch((error) => {
      console.error("[Twitch] Erro ao processar transicao de live:", error);
    });
  });
}
