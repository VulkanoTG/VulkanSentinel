import { env } from "#config";
import { prisma } from "#database";
import { getConnectedAgentsSnapshot } from "../services/agentHub.js";
import { getControlsInvertEffectState } from "../services/controlsInvertReward.js";
import { getMouseAxesInvertEffectState } from "../services/mouseAxesInvertReward.js";
import { getChannelPointBreakdown } from "../services/channelPoints.js";
import { getDiscordClient } from "../services/discord.js";
import { listUserBadges } from "../services/badges.js";
import { getLiveStatusSnapshot } from "../services/liveStatus.js";
import { getModuleSettings } from "../services/moduleSettings.js";
import { getRewardSetting, getRewardSettings, rewardSettingDefinitions } from "../services/rewardSettings.js";
import {
  getActiveVoicemodRewardState,
  getVoicemodSoundCatalog,
  listVoicemodQueueItems,
  listVoicemodVoiceChoices,
} from "../services/voicemodRewards.js";
import { getSpotifyQueueSnapshot } from "../spotify/service.js";
import { getTwitchUserById } from "../services/twitchHelix.js";
import type { WebProfilePayload, WebSessionPayload } from "./types.js";

export async function getCurrentSubscriptionStatus(accessToken: string, twitchUserId: string) {
  if (!env.TWITCH_BROADCASTER_ID || !env.TWITCH_CLIENT_ID) {
    return false;
  }

  const response = await fetch(
    `https://api.twitch.tv/helix/subscriptions/user?${new URLSearchParams({
      broadcaster_id: env.TWITCH_BROADCASTER_ID,
      user_id: twitchUserId,
    }).toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": env.TWITCH_CLIENT_ID,
      },
    }
  );

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Erro ao consultar status de sub na Twitch: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    data?: Array<{
      broadcaster_id: string;
    }>;
  };

  return Boolean(data.data?.length);
}

async function resolveDiscordMember(discordId: string) {
  if (!env.GUILD_ID) {
    return null;
  }

  try {
    const guild = await getDiscordClient().guilds.fetch(env.GUILD_ID);
    return await guild.members.fetch(discordId).catch(() => null);
  } catch {
    return null;
  }
}

async function buildRewardCatalog(balance: number) {
  const [spotifyReward, voicemodSetting, soundAlertSetting, chaosSetting] = await Promise.all([
    getRewardSetting("spotifyQueue"),
    getRewardSetting("voicemod"),
    getRewardSetting("soundalert"),
    getRewardSetting("chaos"),
  ]);
  const connectedAgents = getConnectedAgentsSnapshot().filter((agent) => agent.isReady);
  const voicemodVoiceSupported = connectedAgents.some((agent) =>
    agent.capabilities.some((capability) => capability.actions.includes("voicemod.getRedeemVoices"))
  );
  const voicemodSoundSupported = connectedAgents.some((agent) =>
    agent.capabilities.some((capability) =>
      capability.actions.includes("voicemod.getSoundAlerts") || capability.actions.includes("voicemod.playSound")
    )
  );
  const invertSupported = connectedAgents.some((agent) =>
    agent.capabilities.some((capability) => capability.actions.includes("controls.invert.start"))
  );
  const mouseAxesInvertSupported = connectedAgents.some((agent) =>
    agent.capabilities.some((capability) => capability.actions.includes("mouse.axes.invert.start"))
  );
  const mouseAxesInvertSetting = await getRewardSetting("mouseAxesInvert");

  return [
    {
      key: "spotifyQueue",
      id: rewardSettingDefinitions.spotifyQueue.id,
      title: rewardSettingDefinitions.spotifyQueue.title,
      cost: spotifyReward.cost,
      enabled: spotifyReward.enabled,
      description: rewardSettingDefinitions.spotifyQueue.description,
      affordable: balance >= spotifyReward.cost,
      status: "available" as const,
      type: "spotify" as const,
      thumbnailUrl: null,
    },
    {
      key: "voicemod",
      id: rewardSettingDefinitions.voicemod.id,
      title: rewardSettingDefinitions.voicemod.title,
      cost: voicemodSetting.cost,
      enabled: voicemodSetting.enabled && voicemodVoiceSupported,
      description: rewardSettingDefinitions.voicemod.description,
      affordable: balance >= voicemodSetting.cost,
      status: voicemodVoiceSupported ? ("available" as const) : ("coming_soon" as const),
      type: "voicemod" as const,
      thumbnailUrl: null,
    },
    {
      key: "soundalert",
      id: rewardSettingDefinitions.soundalert.id,
      title: rewardSettingDefinitions.soundalert.title,
      cost: soundAlertSetting.cost,
      enabled: soundAlertSetting.enabled && voicemodSoundSupported,
      description: rewardSettingDefinitions.soundalert.description,
      affordable: balance >= soundAlertSetting.cost,
      status: voicemodSoundSupported ? ("available" as const) : ("coming_soon" as const),
      type: "soundalert" as const,
      thumbnailUrl: null,
    },
    {
      key: "chaos",
      id: rewardSettingDefinitions.chaos.id,
      title: rewardSettingDefinitions.chaos.title,
      cost: chaosSetting.cost,
      enabled: chaosSetting.enabled && invertSupported,
      description: rewardSettingDefinitions.chaos.description,
      affordable: balance >= chaosSetting.cost,
      status: invertSupported ? ("available" as const) : ("coming_soon" as const),
      type: "chaos" as const,
      thumbnailUrl: null,
    },
    {
      key: "mouseAxesInvert",
      id: rewardSettingDefinitions.mouseAxesInvert.id,
      title: rewardSettingDefinitions.mouseAxesInvert.title,
      cost: mouseAxesInvertSetting.cost,
      enabled: mouseAxesInvertSetting.enabled && mouseAxesInvertSupported,
      description: rewardSettingDefinitions.mouseAxesInvert.description,
      affordable: balance >= mouseAxesInvertSetting.cost,
      status: mouseAxesInvertSupported ? ("available" as const) : ("coming_soon" as const),
      type: "chaos" as const,
      thumbnailUrl: null,
    },
  ];
}

export async function loadWebProfilePayload(input: {
  viewer?: WebSessionPayload | null;
}): Promise<WebProfilePayload> {
  const liveSnapshot = getLiveStatusSnapshot();
  const spotifyQueueSnapshot = await getSpotifyQueueSnapshot({ limit: 4 }).catch((error) => {
    console.error("[Spotify] Falha ao carregar fila para o perfil web:", error);
    return null;
  });
  const user = (input.viewer?.twitchId
    ? await prisma.user.findUnique({ where: { twitchId: input.viewer.twitchId } })
    : null) as ({
      id: number;
      discordId: string;
      twitchId: string | null;
      balance: number;
      hoursWatched: number;
      currentWarns: number;
      totalWarns: number;
      totalPunishments: number;
      isTwitchSub: boolean;
      isDiscordBooster: boolean;
      isModerator: boolean;
      balancemultiplier: number;
    } & Record<string, unknown>) | null;

  const [
    rewards,
    rewardSettings,
    moduleSettings,
    controlsInvertEffect,
    mouseAxesInvertEffect,
    voicemodVoices,
    voicemodSoundCatalog,
    activeVoicemodReward,
    voicemodQueue,
  ] = await Promise.all([
    buildRewardCatalog(user?.balance ?? 0),
    getRewardSettings(),
    getModuleSettings(),
    getControlsInvertEffectState(),
    getMouseAxesInvertEffectState(),
    listVoicemodVoiceChoices(),
    getVoicemodSoundCatalog(),
    getActiveVoicemodRewardState(),
    listVoicemodQueueItems(),
  ]);
  const viewer = input.viewer
    ? {
        twitchId: input.viewer.twitchId,
        twitchLogin: input.viewer.twitchLogin,
        twitchDisplayName: input.viewer.twitchDisplayName,
      }
    : null;

  if (!user) {
    return {
      viewer,
      live: {
        isLive: liveSnapshot.isLive,
        title: liveSnapshot.stream?.title ?? null,
        category: liveSnapshot.stream?.game_name ?? null,
        viewerCount: liveSnapshot.stream?.viewer_count ?? null,
        startedAt: liveSnapshot.stream?.started_at ?? null,
      },
      user: null,
      rewards,
      controlsInvertEffect,
      mouseAxesInvertEffect,
      voicemodVoices,
      voicemodSoundboard: voicemodSoundCatalog.soundboard,
      voicemodSoundAlerts: voicemodSoundCatalog.soundAlerts,
      activeVoicemodReward,
      voicemodQueue,
      rewardSettings,
      moduleSettings,
      spotifyQueue: {
        available: spotifyQueueSnapshot?.availability.ok ?? false,
        message: spotifyQueueSnapshot?.availability.ok === false
          ? spotifyQueueSnapshot.availability.message
          : spotifyQueueSnapshot
            ? null
            : "Nao foi possivel carregar a playlist agora.",
        currentTrack: spotifyQueueSnapshot?.currentTrack
          ? {
              name: spotifyQueueSnapshot.currentTrack.name,
              artist: spotifyQueueSnapshot.currentTrack.artist,
              album: spotifyQueueSnapshot.currentTrack.album,
              url: spotifyQueueSnapshot.currentTrack.url,
              artworkUrl: spotifyQueueSnapshot.currentTrack.artworkUrl,
            }
          : null,
        tracks: spotifyQueueSnapshot?.queue.map((track) => ({
          name: track.name,
          artist: track.artist,
          album: track.album,
          url: track.url,
          artworkUrl: track.artworkUrl,
        })) ?? [],
      },
    };
  }

  const [guildMember, twitchData, badges] = await Promise.all([
    resolveDiscordMember(user.discordId),
    user.twitchId ? getTwitchUserById(user.twitchId).catch(() => null) : Promise.resolve(null),
    listUserBadges(user.id),
  ]);

  const breakdown = getChannelPointBreakdown({
    isTwitchSub: user.isTwitchSub,
    isDiscordBooster: user.isDiscordBooster,
    balanceMultiplier: user.balancemultiplier,
  });

  return {
    viewer,
    live: {
      isLive: liveSnapshot.isLive,
      title: liveSnapshot.stream?.title ?? null,
      category: liveSnapshot.stream?.game_name ?? null,
      viewerCount: liveSnapshot.stream?.viewer_count ?? null,
      startedAt: liveSnapshot.stream?.started_at ?? null,
    },
    user: {
      id: user.id,
      discordId: user.discordId,
      discordLabel:
        guildMember?.displayName ??
        guildMember?.user.globalName ??
        guildMember?.user.username ??
        null,
      twitchId: user.twitchId,
      twitchLogin: twitchData?.login ?? "nao-vinculado",
      twitchDisplayName: twitchData?.display_name ?? "Nao vinculado",
      balance: user.balance ?? 0,
      hoursWatched: user.hoursWatched ?? 0,
      currentWarns: user.currentWarns ?? 0,
      totalWarns: user.totalWarns ?? 0,
      totalPunishments: user.totalPunishments ?? 0,
      isTwitchSub: user.isTwitchSub,
      isDiscordBooster: user.isDiscordBooster,
      isModerator: user.isModerator,
      badges,
      multiplier: breakdown.totalMultiplier,
      basePoints: breakdown.basePoints,
      activeBonuses: breakdown.activeBonuses
        .filter((bonus) => bonus.value > 1)
        .map((bonus) => `${bonus.label} x${bonus.value}`),
    },
    rewards,
    controlsInvertEffect,
    mouseAxesInvertEffect,
    voicemodVoices,
    voicemodSoundboard: voicemodSoundCatalog.soundboard,
    voicemodSoundAlerts: voicemodSoundCatalog.soundAlerts,
    activeVoicemodReward,
    voicemodQueue,
    rewardSettings,
    moduleSettings,
    spotifyQueue: {
      available: spotifyQueueSnapshot?.availability.ok ?? false,
      message: spotifyQueueSnapshot?.availability.ok === false
        ? spotifyQueueSnapshot.availability.message
        : spotifyQueueSnapshot
          ? null
          : "Nao foi possivel carregar a playlist agora.",
      currentTrack: spotifyQueueSnapshot?.currentTrack
        ? {
            name: spotifyQueueSnapshot.currentTrack.name,
            artist: spotifyQueueSnapshot.currentTrack.artist,
            album: spotifyQueueSnapshot.currentTrack.album,
            url: spotifyQueueSnapshot.currentTrack.url,
            artworkUrl: spotifyQueueSnapshot.currentTrack.artworkUrl,
          }
        : null,
      tracks: spotifyQueueSnapshot?.queue.map((track) => ({
        name: track.name,
        artist: track.artist,
        album: track.album,
        url: track.url,
        artworkUrl: track.artworkUrl,
      })) ?? [],
    },
  };
}
