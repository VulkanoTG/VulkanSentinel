import { env } from "#config";
import { prisma } from "#database";
import { EmbedBuilder } from "discord.js";
import { sendEmbedToChannel } from "./discord.js";
import { publishEngagementOverlayMessage } from "./chatOverlay.js";
import { sendBotChatMessage } from "./twitchChat.js";
import { getTwitchClient, hasTwitchClient } from "./twitch.js";

const TWITCH_ENGAGEMENT_LOG_CHANNEL_ID = "1504342283904880801";

type EngagementKind = "follow" | "subscription" | "resubscription" | "gift_subscription";

type EngagementNotificationInput = {
  kind: EngagementKind;
  twitchUserId?: string | null;
  twitchLogin?: string | null;
  twitchDisplayName?: string | null;
  tier?: string | null;
  totalGifted?: number | null;
  isAnonymous?: boolean;
};

function buildChatMessage(input: EngagementNotificationInput) {
  const mention = input.twitchLogin ? `@${input.twitchLogin}` : "galera";

  switch (input.kind) {
    case "follow":
      return `${mention}, obrigado por seguir a live!`;
    case "subscription":
      return `${mention}, muito obrigado pelo sub!`;
    case "resubscription":
      return `${mention}, muito obrigado por renovar o sub!`;
    case "gift_subscription":
      return input.isAnonymous
        ? "Muito obrigado pelo gift sub!"
        : `${mention}, muito obrigado pelo gift sub!`;
  }
}

function buildEmbedMeta(input: EngagementNotificationInput) {
  switch (input.kind) {
    case "follow":
      return {
        title: "Novo Follow na Twitch",
        description: `${input.twitchDisplayName ?? input.twitchLogin ?? "Usuario"} acabou de seguir a live.`,
        typeLabel: "Follow",
      };
    case "subscription":
      return {
        title: "Novo Sub na Twitch",
        description: `${input.twitchDisplayName ?? input.twitchLogin ?? "Usuario"} acabou de assinar o canal.`,
        typeLabel: "Sub",
      };
    case "resubscription":
      return {
        title: "Renovacao de Sub na Twitch",
        description: `${input.twitchDisplayName ?? input.twitchLogin ?? "Usuario"} renovou a inscricao no canal.`,
        typeLabel: "Renovacao",
      };
    case "gift_subscription":
      return {
        title: "Gift Sub na Twitch",
        description: input.isAnonymous
          ? "Um usuario anonimo enviou gift sub para a comunidade."
          : `${input.twitchDisplayName ?? input.twitchLogin ?? "Usuario"} enviou gift sub para a comunidade.`,
        typeLabel: "Gift Sub",
      };
  }
}

function formatTier(tier: string | null | undefined) {
  if (!tier) return null;
  if (tier === "1000") return "Tier 1";
  if (tier === "2000") return "Tier 2";
  if (tier === "3000") return "Tier 3";
  return tier;
}

export async function notifyTwitchEngagement(input: EngagementNotificationInput) {
  const linkedUser =
    input.twitchUserId
      ? await prisma.user.findUnique({
          where: { twitchId: input.twitchUserId },
          select: { discordId: true },
        })
      : null;

  if (hasTwitchClient()) {
    const client = getTwitchClient();
    const chatMessage = buildChatMessage(input);

    await sendBotChatMessage(client, env.TWITCH_CHANNEL, chatMessage).catch((error) => {
      console.error("[TwitchEngagement] Falha ao enviar agradecimento na Twitch:", error);
    });
  }

  publishEngagementOverlayMessage({
    username: input.twitchDisplayName ?? input.twitchLogin ?? "Sistema",
    message: buildChatMessage(input),
    icon: input.kind === "follow" ? "FOL" : "SUB",
  });

  const meta = buildEmbedMeta(input);
  const embed = new EmbedBuilder()
    .setColor(0x9146ff)
    .setTitle(meta.title)
    .setDescription(meta.description)
    .addFields(
      {
        name: "Twitch",
        value: input.twitchLogin ? `@${input.twitchLogin}` : "Anonimo",
        inline: true,
      },
      {
        name: "Tipo",
        value: meta.typeLabel,
        inline: true,
      }
    )
    .setTimestamp();

  const tier = formatTier(input.tier);
  if (tier) {
    embed.addFields({ name: "Tier", value: tier, inline: true });
  }

  if (input.totalGifted) {
    embed.addFields({ name: "Quantidade", value: `${input.totalGifted}`, inline: true });
  }

  if (linkedUser?.discordId) {
    embed.addFields({ name: "Discord", value: `<@${linkedUser.discordId}>`, inline: false });
  }

  await sendEmbedToChannel(TWITCH_ENGAGEMENT_LOG_CHANNEL_ID, embed);
}
