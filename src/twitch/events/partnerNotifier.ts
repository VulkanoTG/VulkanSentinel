import { EmbedBuilder } from "discord.js";
import { sendEmbedToChannel } from "../../services/discord.js";
import { getCurrentStreamByUserId, getUserId } from "../../services/twitchHelix.js";

const PARTNER_ALERT_CHANNEL_ID = "1442335000966987867";
const PARTNER_CHECK_INTERVAL_MS = 60_000;

type PartnerConfig = {
  login: string;
  label?: string;
};

const PARTNERS: PartnerConfig[] = [
  // Exemplo:
  // { login: "nome_do_parceiro", label: "Nome do Parceiro" },
   { login: "satooro", label: "satooro" },
];

const partnerLiveState = new Map<string, boolean>();

function buildPartnerLiveEmbed(
  partner: PartnerConfig,
  stream: NonNullable<Awaited<ReturnType<typeof getCurrentStreamByUserId>>>
) {
  const channelName = partner.label ?? stream.user_name;
  const streamUrl = `https://twitch.tv/${partner.login}`;
  const thumbnail = stream.thumbnail_url
    .replace("{width}", "1280")
    .replace("{height}", "720");

  return new EmbedBuilder()
    .setColor(0xff8a3d)
    .setTitle(`${channelName} entrou em live!`)
    .setURL(streamUrl)
    .setDescription(`**${stream.title}**`)
    .addFields(
      { name: "Canal", value: `[twitch.tv/${partner.login}](${streamUrl})`, inline: true },
      { name: "Categoria", value: stream.game_name || "Nao informada", inline: true }
    )
    .setImage(thumbnail)
    .setTimestamp(new Date(stream.started_at));
}

async function checkPartnerLive(partner: PartnerConfig) {
  const partnerId = await getUserId(partner.login);

  if (!partnerId) {
    console.warn(`[Partners] Nao foi possivel resolver o canal ${partner.login}.`);
    return;
  }

  const stream = await getCurrentStreamByUserId(partnerId);
  const isLive = stream !== null;
  const wasLive = partnerLiveState.get(partner.login) ?? false;

  if (isLive && !wasLive && stream) {
    await sendEmbedToChannel(
      PARTNER_ALERT_CHANNEL_ID,
      buildPartnerLiveEmbed(partner, stream)
    );
    console.log(`[Partners] Aviso de live enviado para ${partner.login}.`);
  }

  partnerLiveState.set(partner.login, isLive);
}

async function initializePartnerStates() {
  for (const partner of PARTNERS) {
    try {
      const partnerId = await getUserId(partner.login);
      if (!partnerId) {
        partnerLiveState.set(partner.login, false);
        continue;
      }

      const stream = await getCurrentStreamByUserId(partnerId);
      partnerLiveState.set(partner.login, stream !== null);
    } catch (error) {
      console.error(`[Partners] Erro ao inicializar ${partner.login}:`, error);
      partnerLiveState.set(partner.login, false);
    }
  }
}

export async function startPartnerNotifier() {
  if (PARTNERS.length === 0) {
    console.log("[Partners] Nenhum parceiro configurado para monitorar.");
    return;
  }

  await initializePartnerStates();

  setInterval(() => {
    for (const partner of PARTNERS) {
      void checkPartnerLive(partner).catch((error) => {
        console.error(`[Partners] Erro ao verificar ${partner.login}:`, error);
      });
    }
  }, PARTNER_CHECK_INTERVAL_MS);
}
