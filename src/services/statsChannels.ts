import { appConfig, env } from "#config";
import { getChannelFollowersCount } from "./twitchHelix.js";
import { getDiscordClient } from "./discord.js";

async function updateDiscordMemberCountChannel() {
  if (!env.GUILD_ID) {
    console.warn("[StatsChannels] GUILD_ID nao configurado. Pulando contador de membros.");
    return;
  }

  const client = getDiscordClient();
  const guild = await client.guilds.fetch(env.GUILD_ID);
  const channel = await client.channels.fetch(appConfig.discord.statsChannels.memberCountChannelId);

  if (!channel || !("setName" in channel)) {
    throw new Error("Canal de contador de membros nao encontrado ou nao permite renomear.");
  }

  const nextName = `👥〡Membros: ${guild.memberCount}`;
  if (channel.name !== nextName) {
    await channel.setName(nextName);
  }
}

async function updateTwitchFollowersChannel() {
  const client = getDiscordClient();
  const channel = await client.channels.fetch(appConfig.discord.statsChannels.twitchFollowersChannelId);

  if (!channel || !("setName" in channel)) {
    throw new Error("Canal de contador de seguidores nao encontrado ou nao permite renomear.");
  }

  const followersCount = await getChannelFollowersCount();
  const nextName = `🟣〡Seguidores: ${followersCount}`;

  if (channel.name !== nextName) {
    await channel.setName(nextName);
  }
}

async function updateStatsChannels() {
  const results = await Promise.allSettled([
    updateDiscordMemberCountChannel(),
    updateTwitchFollowersChannel(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[StatsChannels] Falha ao atualizar canal de estatistica:", result.reason);
    }
  }
}

export async function startStatsChannelsUpdater() {
  await updateStatsChannels();

  setInterval(() => {
    void updateStatsChannels();
  }, appConfig.discord.statsChannels.updateIntervalMs);
}
