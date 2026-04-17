import { validateEnv } from "@constatic/base";
import { z } from "zod";

export const appConfig = {
  colors: {
    default: 0x2b2d31,
    primary: 0x3b82f6,
    secondary: 0x4f545c,
    success: 0x22c55e,
    danger: 0xed4245,
    warning: 0xfbbd23,
    azoxo: 0x5865f2,
    green: 0x57f287,
    yellow: 0xfee75c,
    fuchsia: 0xeb459e,
    magic: 0xc026d3,
    developer: 0x3e70dd,
    balance: 0x45ddc0,
    brilliance: 0xf07d5f,
    nitro: 0xff6bfa,
    bravery: 0x9c84ef,
  },
  discord: {
    inviteUrl: "https://discord.gg/FcvVVZVWH9",
    verifiedRoleId: "1492288881058517122",
    linkAccount: {
      devMode: false, // Display the link as text instead of a clickable button when the /link command is entered
    },
    statsChannels: {
      memberCountChannelId: "1460103249876222053",
      twitchFollowersChannelId: "1460103651551871091",
      updateIntervalMs: 60 * 60 * 1000,
    },
    profile: {
      fireCoinsEmoji: "<:FireCoins:1491666484039254056>",
      embedColor: 0xff8a3d,
    },
    points: {
      embedColor: 0x45ddc0,
      auditEmbedColor: 0x1f9d74,
    },
    tickets: {
      panelChannelId: "1460105384667779075",
      transcriptsChannelId: "1491673864223199252",
      transcriptArchiveChannelId: "1491892639505715361",
      categoryId: "1419136780354977802",
      embedColor: 0xfee75c,
      footerText: "Vulkan Sentinel - Suporte",
      ratingStars: [1, 2, 3, 4, 5],
      categories: [
        { id: "bug", label: "Bug", emoji: "🐞" },
        { id: "conta", label: "Conta", emoji: "👤" },
        { id: "firecoins", label: "FireCoins", emoji: "<:FireCoins:1491666484039254056>" },
        { id: "denuncia", label: "Denuncia", emoji: "⚠️" },
      ],
    },
  },
  server: {
    port: 8080,
  },
  twitch: {
    liveNotifier: {
      alertChannelId: "1442332409906331809",
      checkIntervalMs: 60_000,
      embedColor: 0x9146ff,
      offlineColor: 0x2f3136,
    },
    partnerNotifier: {
      alertChannelId: "1442335000966987867",
      checkIntervalMs: 60_000,
      embedColor: 0xff8a3d,
      partners: [
        { login: "satooro", label: "satooro" },
        { login: "bela_puffy", label: "bela_puffy" },
      ],
    },
    viewerTracker: {
      watchIntervalMinutes: 10,
      activeWindowMinutes: 30,
      warningCooldownMinutes: 30,
      ignoreUsers: ["nightbot", "streamelements", "moobot", "streamlabs", "wizebot", "coebot", "phantombot", "ankhbot", "fossabot", "deepbot", "vertozbot"],
    },
    channelPoints: {
      points: 30,
      baseMultiply: 1,
      subMultiply: 1.5,
      boosterMultiply: 1.25,
      eventMultiply: 1,
      eventMultiplierActive: false,
      activeEventName: null as string | null,
    },
  },
} as const;

export const env = await validateEnv(z.looseObject({
  BOT_TOKEN: z.string("Discord Bot Token is required").min(1),
  WEBHOOK_LOGS_URL: z.url().optional(),
  GUILD_ID: z.string().optional(),
  GUILD_BOT_CHANNEL_ID: z.string("Guild Bot Channel ID is required").min(1),
  DATABASE_URL: z.string("Database URL is required").min(1),
  INTEGRATION_LOGS_CHANNEL_ID: z.string().optional(),
  TWITCH_CHANNEL: z.string("Twitch Streamer Channel is required").min(1),
  TWITCH_BROADCASTER_ID: z.string("Twitch Broadcaster ID is required").min(1),
  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_USER_TOKEN: z.string().optional(),
  TWITCH_BOT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  TWITCH_REFRESH_TOKEN: z.string().optional(),
  TWITCH_USERNAME: z.string("Twitch username is required").min(1),
  TWITCH_REDIRECT_URI: z.string("CallbackUrl is required").min(1),
  TWITCH_EVENTSUB_CALLBACK: z.url().optional(),
  TWITCH_EVENTSUB_SECRET: z.string().min(10).optional(),
}));
