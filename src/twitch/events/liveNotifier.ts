import { env } from "#env";
import { EmbedBuilder } from "discord.js";
import { sendEmbedToChannel } from "../../services/discord.js";
import { getCurrentStream } from "../../services/twitchHelix.js";

const LIVE_ALERT_CHANNEL_ID = "1442332409906331809";
const LIVE_CHECK_INTERVAL_MS = 60_000;

let wasLive = false;

function buildLiveEmbed(stream: NonNullable<Awaited<ReturnType<typeof getCurrentStream>>>) {
  const streamUrl = `https://twitch.tv/${env.TWITCH_CHANNEL}`;
  const thumbnail = stream.thumbnail_url
    .replace("{width}", "1280")
    .replace("{height}", "720");

  return new EmbedBuilder()
    .setColor(0x9146ff)
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

async function checkLiveStatus() {
  try {
    const stream = await getCurrentStream();
    const isLive = stream !== null;

    if (isLive && !wasLive && stream) {
      await sendEmbedToChannel(LIVE_ALERT_CHANNEL_ID, buildLiveEmbed(stream));
      console.log("[Twitch] Aviso de live enviado para o Discord.");
    }

    wasLive = isLive;
  } catch (error) {
    console.error("[Twitch] Erro ao verificar inicio de live:", error);
  }
}

export async function startLiveNotifier() {
  const currentStream = await getCurrentStream().catch((error) => {
    console.error("[Twitch] Erro ao inicializar live notifier:", error);
    return null;
  });

  wasLive = currentStream !== null;

  setInterval(() => {
    void checkLiveStatus();
  }, LIVE_CHECK_INTERVAL_MS);
}
