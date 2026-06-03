import { appConfig, env } from "#config";
import { getDiscordClient } from "./discord.js";
import { sendBotChatMessage } from "./twitchChat.js";
import { sendTwitchWhisper, getTwitchUserById, getTwitchUserByLogin, timeoutTwitchUser } from "./twitchHelix.js";
import { getTwitchClient, hasTwitchClient } from "./twitch.js";

export class DiscordModerationPermissionError extends Error {
  constructor(message = "O bot nao tem permissao para aplicar timeout nesse usuario no Discord.") {
    super(message);
    this.name = "DiscordModerationPermissionError";
  }
}

export type PunishmentType = "timeout" | "ban";

export type PunishmentPlan = {
  type: PunishmentType;
  durationMs: number | null;
  label: string;
};

function formatDuration(durationMs: number | null) {
  if (durationMs === null) {
    return "permanente";
  }

  const totalMinutes = Math.round(durationMs / 60_000);

  if (totalMinutes % (24 * 60) === 0) {
    const days = totalMinutes / (24 * 60);
    return `${days} dia${days > 1 ? "s" : ""}`;
  }

  if (totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return `${hours} hora${hours > 1 ? "s" : ""}`;
  }

  return `${totalMinutes} minuto${totalMinutes > 1 ? "s" : ""}`;
}

export class PunishmentService {
  getThresholdPunishmentPlan() {
    return {
      type: "timeout",
      durationMs: appConfig.moderation.thresholdPunishmentMs,
      label: formatDuration(appConfig.moderation.thresholdPunishmentMs),
    } satisfies PunishmentPlan;
  }

  getDirectUnlinkedPunishmentPlan() {
    return {
      type: "timeout",
      durationMs: appConfig.moderation.directPunishmentMs,
      label: formatDuration(appConfig.moderation.directPunishmentMs),
    } satisfies PunishmentPlan;
  }

  getFutureEscalationPlan(nextPunishmentNumber: number) {
    const fallback = appConfig.moderation.futureEscalation.at(-1)!;
    const match =
      appConfig.moderation.futureEscalation.find(
        (entry) => nextPunishmentNumber <= entry.punishmentNumber
      ) ?? fallback;

    return {
      type: match.type,
      durationMs: match.durationMs,
      label: match.label,
    } satisfies PunishmentPlan;
  }

  async applyDiscordTimeout(discordId: string, durationMs: number, reason: string) {
    if (!env.GUILD_ID) {
      throw new Error("GUILD_ID nao configurado para timeout de moderacao no Discord.");
    }

    const client = getDiscordClient();
    const guild = await client.guilds.fetch(env.GUILD_ID);
    const member = await guild.members.fetch(discordId);

    if (!member.moderatable) {
      throw new DiscordModerationPermissionError(
        "O bot nao consegue aplicar timeout nesse usuario no Discord. Verifique a hierarquia de cargos e a permissao de moderar membros."
      );
    }

    try {
      await member.timeout(durationMs, reason);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 50013
      ) {
        throw new DiscordModerationPermissionError(
          "O bot nao tem permissao para aplicar timeout nesse usuario no Discord."
        );
      }

      throw error;
    }

    return member;
  }

  async applyTwitchTimeout(
    target: { twitchId?: string; twitchLogin?: string },
    durationMs: number,
    reason: string
  ) {
    const twitchUser =
      target.twitchId
        ? await getTwitchUserById(target.twitchId)
        : target.twitchLogin
          ? await getTwitchUserByLogin(target.twitchLogin)
          : null;

    if (!twitchUser) {
      throw new Error("Nao foi possivel resolver o usuario da Twitch para aplicar timeout.");
    }

    await timeoutTwitchUser({
      twitchId: twitchUser.id,
      durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
      reason,
    });

    return twitchUser;
  }

  async notifyDirectPunishmentOnDiscord(discordId: string, durationLabel: string) {
    const client = getDiscordClient();
    const user = await client.users.fetch(discordId);

    await user.send(
      [
        "Voce nao esta vinculado ao sistema de moderacao do Vulkan Sentinel.",
        `Por isso recebeu uma punicao direta de ${durationLabel}.`,
        "Vincule sua conta para acessar o sistema progressivo de warnings.",
      ].join(" ")
    ).catch(() => null);
  }

  async notifyDirectPunishmentOnTwitch(target: { twitchId?: string; twitchLogin?: string }, durationLabel: string) {
    const twitchUser =
      target.twitchId
        ? await getTwitchUserById(target.twitchId)
        : target.twitchLogin
          ? await getTwitchUserByLogin(target.twitchLogin)
          : null;

    const twitchLogin = twitchUser?.login ?? target.twitchLogin;
    if (!twitchLogin) {
      return;
    }

    const message = [
      "Voce nao esta vinculado ao sistema de moderacao do Vulkan Sentinel.",
      `Por isso recebeu uma punicao direta de ${durationLabel}.`,
      "Vincule sua conta para acessar o sistema progressivo de warnings.",
    ].join(" ");

    try {
      await sendTwitchWhisper(twitchLogin, message);
      return;
    } catch (error) {
      console.warn(`[Moderation] Falha ao enviar whisper para ${twitchLogin}:`, error);
    }

    if (hasTwitchClient()) {
      const client = getTwitchClient();
      await sendBotChatMessage(client, env.TWITCH_CHANNEL, `@${twitchLogin}, ${message}`);
    }
  }
}

export const punishmentService = new PunishmentService();
