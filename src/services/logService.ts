import { appConfig, env } from "#config";
import { EmbedBuilder } from "discord.js";
import { getDiscordClient, hasDiscordClient, sendEmbedToChannel, sendToChannel } from "./discord.js";

type LogUserIdentity = {
  discordId?: string;
  discordLabel?: string;
  twitchLogin?: string;
  twitchId?: string;
};

type ModeratorIdentity = {
  platform: "discord" | "twitch";
  name: string;
  id?: string;
};

function getModerationLogChannelId() {
  return appConfig.moderation.logsChannelId ?? env.INTEGRATION_LOGS_CHANNEL_ID ?? env.GUILD_BOT_CHANNEL_ID;
}

function getPublicModerationLogChannelId() {
  return appConfig.moderation.publicLogsChannelId;
}

async function resolveDiscordLabel(identity: LogUserIdentity) {
  if (identity.discordLabel) {
    return identity.discordLabel;
  }

  if (!identity.discordId || !env.GUILD_ID || !hasDiscordClient()) {
    return null;
  }

  try {
    const client = getDiscordClient();
    const guild = await client.guilds.fetch(env.GUILD_ID);
    const member = await guild.members.fetch(identity.discordId).catch(() => null);
    return member?.displayName ?? member?.user.username ?? null;
  } catch {
    return null;
  }
}

async function buildUserFields(identity: LogUserIdentity) {
  const discordLabel = await resolveDiscordLabel(identity);
  const staffIdentityLines = [
    identity.discordId ? `<@${identity.discordId}>` : null,
    identity.discordId ? `Discord ID: ${identity.discordId}` : null,
    identity.twitchLogin ? `Twitch: ${identity.twitchLogin}` : null,
    !identity.twitchLogin && identity.twitchId ? `Twitch ID: ${identity.twitchId}` : null,
  ].filter(Boolean);
  const publicIdentityLines = [
    identity.discordId ? `<@${identity.discordId}>` : null,
    identity.twitchLogin ? `Twitch: ${identity.twitchLogin}` : null,
    !identity.twitchLogin && identity.twitchId ? `Twitch ID: ${identity.twitchId}` : null,
  ].filter(Boolean);

  return {
    nick: discordLabel ?? identity.twitchLogin ?? "Nao resolvido",
    staffIdentity: staffIdentityLines.join("\n") || "Nao resolvido",
    publicIdentity: publicIdentityLines.join("\n") || "Nao resolvido",
  };
}

function formatModerator(moderator: ModeratorIdentity) {
  if (moderator.platform === "discord" && moderator.id) {
    return `<@${moderator.id}>`;
  }

  return `${moderator.name} (${moderator.platform})`;
}

async function sendModerationEmbeds(input: {
  staffEmbed: EmbedBuilder;
  publicEmbed: EmbedBuilder;
  publicMessage?: string;
}) {
  const staffChannelId = getModerationLogChannelId();
  await sendEmbedToChannel(staffChannelId, input.staffEmbed);

  const publicChannelId = getPublicModerationLogChannelId();
  if (publicChannelId && String(publicChannelId) !== String(staffChannelId)) {
    if (input.publicMessage) {
      await sendToChannel(publicChannelId, input.publicMessage);
    }

    await sendEmbedToChannel(publicChannelId, input.publicEmbed);
  }
}

export class LogService {
  async logWarning(input: {
    user: LogUserIdentity;
    moderator: ModeratorIdentity;
    reason: string;
    currentWarns: number;
    threshold: number;
    totalWarns: number;
  }) {
    const userFields = await buildUserFields(input.user);
    const staffEmbed = new EmbedBuilder()
      .setColor(appConfig.colors.warning)
      .setTitle("Warning aplicado")
      .addFields(
        { name: "Nick", value: userFields.nick, inline: true },
        { name: "Usuario", value: userFields.staffIdentity, inline: false },
        { name: "Moderador", value: formatModerator(input.moderator), inline: false },
        { name: "Motivo", value: input.reason, inline: false },
        { name: "Warns atuais", value: `${input.currentWarns}/${input.threshold}`, inline: true },
        { name: "Warns totais", value: `${input.totalWarns}`, inline: true },
      )
      .setTimestamp();
    const publicEmbed = EmbedBuilder.from(staffEmbed).spliceFields(1, 1, {
      name: "Usuario",
      value: userFields.publicIdentity,
      inline: false,
    });

    await sendModerationEmbeds({ staffEmbed, publicEmbed });
  }

  async logThresholdPunishment(input: {
    user: LogUserIdentity;
    moderator: ModeratorIdentity;
    reason: string;
    durationLabel: string;
    threshold: number;
    totalWarns: number;
    totalPunishments: number;
  }) {
    const userFields = await buildUserFields(input.user);
    const staffEmbed = new EmbedBuilder()
      .setColor(appConfig.colors.danger)
      .setTitle("Punicao automatica por limite de warns")
      .addFields(
        { name: "Nick", value: userFields.nick, inline: true },
        { name: "Usuario", value: userFields.staffIdentity, inline: false },
        { name: "Moderador", value: formatModerator(input.moderator), inline: false },
        { name: "Motivo", value: input.reason, inline: false },
        { name: "Limite de warns", value: `${input.threshold}`, inline: true },
        { name: "Warns totais", value: `${input.totalWarns}`, inline: true },
        { name: "Duracao", value: input.durationLabel, inline: true },
        { name: "Total de punicoes", value: `${input.totalPunishments}`, inline: true },
      )
      .setTimestamp();
    const publicEmbed = EmbedBuilder.from(staffEmbed).spliceFields(1, 1, {
      name: "Usuario",
      value: userFields.publicIdentity,
      inline: false,
    });

    await sendModerationEmbeds({ staffEmbed, publicEmbed });
  }

  async logDirectPunishmentForUnlinkedUser(input: {
    user: LogUserIdentity;
    moderator: ModeratorIdentity;
    reason: string;
    durationLabel: string;
  }) {
    const userFields = await buildUserFields(input.user);
    const staffEmbed = new EmbedBuilder()
      .setColor(appConfig.colors.danger)
      .setTitle("Punicao direta em usuario nao vinculado")
      .addFields(
        { name: "Nick", value: userFields.nick, inline: true },
        { name: "Usuario", value: userFields.staffIdentity, inline: false },
        { name: "Moderador", value: formatModerator(input.moderator), inline: false },
        { name: "Motivo", value: input.reason, inline: false },
        { name: "Status", value: "Usuario nao vinculado ao sistema", inline: false },
        { name: "Punicao aplicada", value: input.durationLabel, inline: true },
      )
      .setTimestamp();
    const publicEmbed = EmbedBuilder.from(staffEmbed).spliceFields(1, 1, {
      name: "Usuario",
      value: userFields.publicIdentity,
      inline: false,
    });
    const publicMessage =
      input.user.discordId
        ? `<@${input.user.discordId}> esta tomando punicao direta por nao ter a conta vinculada.`
        : `O usuario ${userFields.nick} esta tomando punicao direta por nao ter a conta vinculada.`;

    await sendModerationEmbeds({ staffEmbed, publicEmbed, publicMessage });
  }
}

export const logService = new LogService();
