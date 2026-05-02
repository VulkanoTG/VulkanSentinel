import { appConfig, env } from "#config";
import { EmbedBuilder } from "discord.js";
import { sendEmbedToChannel } from "./discord.js";

type LogUserIdentity = {
  discordId?: string;
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

function formatUserIdentity(identity: LogUserIdentity) {
  const lines = [
    identity.discordId ? `<@${identity.discordId}>` : null,
    identity.twitchLogin ? `Twitch: ${identity.twitchLogin}` : null,
    !identity.twitchLogin && identity.twitchId ? `Twitch ID: ${identity.twitchId}` : null,
  ].filter(Boolean);

  return lines.join("\n") || "Nao resolvido";
}

function formatModerator(moderator: ModeratorIdentity) {
  if (moderator.platform === "discord" && moderator.id) {
    return `<@${moderator.id}>`;
  }

  return `${moderator.name} (${moderator.platform})`;
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
    const embed = new EmbedBuilder()
      .setColor(appConfig.colors.warning)
      .setTitle("Warning aplicado")
      .addFields(
        { name: "Usuario", value: formatUserIdentity(input.user), inline: false },
        { name: "Moderador", value: formatModerator(input.moderator), inline: false },
        { name: "Motivo", value: input.reason, inline: false },
        { name: "Warns atuais", value: `${input.currentWarns}/${input.threshold}`, inline: true },
        { name: "Warns totais", value: `${input.totalWarns}`, inline: true },
      )
      .setTimestamp();

    await sendEmbedToChannel(getModerationLogChannelId(), embed);
  }

  async logThresholdPunishment(input: {
    user: LogUserIdentity;
    moderator: ModeratorIdentity;
    durationLabel: string;
    totalPunishments: number;
  }) {
    const embed = new EmbedBuilder()
      .setColor(appConfig.colors.danger)
      .setTitle("Punicao automatica por limite de warns")
      .addFields(
        { name: "Usuario", value: formatUserIdentity(input.user), inline: false },
        { name: "Moderador", value: formatModerator(input.moderator), inline: false },
        { name: "Motivo", value: "Reached warning threshold", inline: false },
        { name: "Duracao", value: input.durationLabel, inline: true },
        { name: "Total de punicoes", value: `${input.totalPunishments}`, inline: true },
      )
      .setTimestamp();

    await sendEmbedToChannel(getModerationLogChannelId(), embed);
  }

  async logDirectPunishmentForUnlinkedUser(input: {
    user: LogUserIdentity;
    moderator: ModeratorIdentity;
    reason: string;
    durationLabel: string;
  }) {
    const embed = new EmbedBuilder()
      .setColor(appConfig.colors.danger)
      .setTitle("Punicao direta em usuario nao vinculado")
      .addFields(
        { name: "Usuario", value: formatUserIdentity(input.user), inline: false },
        { name: "Moderador", value: formatModerator(input.moderator), inline: false },
        { name: "Motivo", value: input.reason, inline: false },
        { name: "Status", value: "Usuario nao vinculado ao sistema", inline: false },
        { name: "Punicao aplicada", value: input.durationLabel, inline: true },
      )
      .setTimestamp();

    await sendEmbedToChannel(getModerationLogChannelId(), embed);
  }
}

export const logService = new LogService();
