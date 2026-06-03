import { appConfig } from "#config";
import { getDiscordClient } from "../../services/discord.js";
import { EmbedBuilder } from "discord.js";
import { sendEmbedToChannel } from "../../services/discord.js";
import { isModuleEnabled } from "../../services/moduleSettings.js";
import { getCurrentStreamByUserId, getUserId } from "../../services/twitchHelix.js";
import { buildTwitchStreamPreviewUrl } from "../../services/twitchStreamPreview.js";

type PartnerConfig = {
  login: string;
  label?: string;
};

const PARTNERS: PartnerConfig[] = [...appConfig.twitch.partnerNotifier.partners];

const partnerLiveState = new Map<string, boolean>();
let partnerCleanupTimeout: NodeJS.Timeout | null = null;
let partnerCleanupInterval: NodeJS.Timeout | null = null;

function buildPartnerLiveEmbed(
  partner: PartnerConfig,
  stream: NonNullable<Awaited<ReturnType<typeof getCurrentStreamByUserId>>>
) {
  const channelName = partner.label ?? stream.user_name;
  const streamUrl = `https://twitch.tv/${partner.login}`;
  const thumbnail = buildTwitchStreamPreviewUrl({
    stream,
    cacheKey: `${stream.id}:${stream.started_at}:${Date.now()}`,
  });

  return new EmbedBuilder()
    .setColor(appConfig.twitch.partnerNotifier.embedColor)
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

async function isPartnerNotifierActive() {
  try {
    return await isModuleEnabled("partnerNotifier");
  } catch (error) {
    console.error("[Partners] Falha ao consultar status do modulo partnerNotifier:", error);
    return true;
  }
}

async function checkPartnerLive(partner: PartnerConfig) {
  if (!(await isPartnerNotifierActive())) {
    partnerLiveState.set(partner.login, false);
    return;
  }

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
      appConfig.twitch.partnerNotifier.alertChannelId,
      buildPartnerLiveEmbed(partner, stream)
    );
    console.log(`[Partners] Aviso de live enviado para ${partner.login}.`);
  }

  partnerLiveState.set(partner.login, isLive);
}

async function sendPartnerLiveAlert(partner: PartnerConfig) {
  if (!(await isPartnerNotifierActive())) {
    partnerLiveState.set(partner.login, false);
    return false;
  }

  const partnerId = await getUserId(partner.login);

  if (!partnerId) {
    console.warn(`[Partners] Nao foi possivel resolver o canal ${partner.login}.`);
    return false;
  }

  const stream = await getCurrentStreamByUserId(partnerId);
  if (!stream) {
    partnerLiveState.set(partner.login, false);
    return false;
  }

  await sendEmbedToChannel(
    appConfig.twitch.partnerNotifier.alertChannelId,
    buildPartnerLiveEmbed(partner, stream)
  );
  partnerLiveState.set(partner.login, true);
  return true;
}

async function clearPartnerAlertChannel() {
  if (!(await isPartnerNotifierActive())) {
    return;
  }

  const channel = await getDiscordClient().channels
    .fetch(appConfig.twitch.partnerNotifier.alertChannelId)
    .catch(() => null);

  if (!channel || !channel.isTextBased() || !("messages" in channel) || !("bulkDelete" in channel)) {
    console.error("[Partners] Canal de alertas dos parceiros nao encontrado ou nao suporta mensagens.");
    return;
  }

  let before: string | undefined;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) {
      break;
    }

    const messages = [...batch.values()];
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const newerThan14Days = messages.filter((message) => message.createdTimestamp >= cutoff);
    const olderThan14Days = messages.filter((message) => message.createdTimestamp < cutoff);

    if (newerThan14Days.length > 0) {
      await channel.bulkDelete(newerThan14Days.map((message) => message.id), true).catch(() => null);
    }

    for (const message of olderThan14Days) {
      await message.delete().catch(() => null);
    }

    before = messages[messages.length - 1]?.id;
  }
}

async function republishLivePartnersAfterCleanup() {
  if (!(await isPartnerNotifierActive())) {
    return;
  }

  for (const partner of PARTNERS) {
    try {
      const sent = await sendPartnerLiveAlert(partner);
      if (sent) {
        console.log(`[Partners] ${partner.login} segue em live. Aviso reenviado apos limpeza do canal.`);
      }
    } catch (error) {
      console.error(`[Partners] Erro ao republicar ${partner.login} apos limpeza:`, error);
    }
  }
}

function getMsUntilNextPartnerCleanup(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function schedulePartnerChannelCleanup() {
  const intervalMs = appConfig.twitch.partnerNotifier.cleanupIntervalDays * 24 * 60 * 60 * 1000;

  if (partnerCleanupTimeout) {
    clearTimeout(partnerCleanupTimeout);
  }

  if (partnerCleanupInterval) {
    clearInterval(partnerCleanupInterval);
  }

  partnerCleanupTimeout = setTimeout(() => {
    void runPartnerChannelCleanup();

    partnerCleanupInterval = setInterval(() => {
      void runPartnerChannelCleanup();
    }, intervalMs);
  }, getMsUntilNextPartnerCleanup());
}

async function runPartnerChannelCleanup() {
  try {
    if (!(await isPartnerNotifierActive())) {
      return;
    }

    console.log("[Partners] Limpando canal de lives dos parceiros.");
    await clearPartnerAlertChannel();
    await republishLivePartnersAfterCleanup();
  } catch (error) {
    console.error("[Partners] Erro durante limpeza do canal de lives dos parceiros:", error);
  }
}

async function initializePartnerStates() {
  if (!(await isPartnerNotifierActive())) {
    for (const partner of PARTNERS) {
      partnerLiveState.set(partner.login, false);
    }
    console.log("[Partners] Modulo partnerNotifier desativado. Startup ignorado.");
    return;
  }

  for (const partner of PARTNERS) {
    try {
      const partnerId = await getUserId(partner.login);
      if (!partnerId) {
        partnerLiveState.set(partner.login, false);
        continue;
      }

      const stream = await getCurrentStreamByUserId(partnerId);
      const isLive = stream !== null;

      if (isLive && stream) {
        await sendEmbedToChannel(
          appConfig.twitch.partnerNotifier.alertChannelId,
          buildPartnerLiveEmbed(partner, stream)
        );
        console.log(`[Partners] ${partner.login} ja estava em live no startup. Aviso enviado.`);
      }

      partnerLiveState.set(partner.login, isLive);
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
  schedulePartnerChannelCleanup();

  setInterval(() => {
    void (async () => {
      if (!(await isPartnerNotifierActive())) {
        return;
      }

      for (const partner of PARTNERS) {
        void checkPartnerLive(partner).catch((error) => {
          console.error(`[Partners] Erro ao verificar ${partner.login}:`, error);
        });
      }
    })();
  }, appConfig.twitch.partnerNotifier.checkIntervalMs);
}
