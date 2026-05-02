import type { Guild } from "discord.js";
import { appConfig } from "#config";
import { getTwitchUserById, getTwitchUserByLogin } from "./twitchHelix.js";
import { logService } from "./logService.js";
import { punishmentService } from "./punishmentService.js";
import { warningService } from "./warningService.js";

type ResolvedTarget = {
  discordId?: string;
  discordLabel?: string;
  twitchId?: string;
  twitchLogin?: string;
};

type ModeratorContext = {
  platform: "discord" | "twitch";
  id?: string;
  name: string;
};

function normalizeTargetInput(input: string) {
  return input.replace(/[<@!>]/g, "").trim();
}

async function buildTargetFromLinkedUser(user: {
  discordId: string;
  twitchId: string | null;
}) {
  const twitchUser = user.twitchId ? await getTwitchUserById(user.twitchId) : null;

  return {
    discordId: user.discordId,
    twitchId: user.twitchId ?? undefined,
    twitchLogin: twitchUser?.login,
  } satisfies ResolvedTarget;
}

export class ModerationService {
  async resolveDiscordTarget(params: {
    guild: Guild;
    selectedDiscordUserId?: string | null;
    searchText?: string | null;
  }) {
    if (params.selectedDiscordUserId) {
      const member = await params.guild.members.fetch(params.selectedDiscordUserId).catch(() => null);
      return {
        discordId: params.selectedDiscordUserId,
        discordLabel: member?.displayName ?? member?.user.username,
      } satisfies ResolvedTarget;
    }

    if (!params.searchText) {
      return null;
    }

    const cleaned = normalizeTargetInput(params.searchText);

    const memberById = /^\d+$/.test(cleaned)
      ? await params.guild.members.fetch(cleaned).catch(() => null)
      : null;
    if (memberById) {
      return {
        discordId: memberById.id,
        discordLabel: memberById.displayName,
      } satisfies ResolvedTarget;
    }

    const linkedByDiscordId = await warningService.findLinkedUser({
      discordId: cleaned,
    });
    if (linkedByDiscordId) {
      return buildTargetFromLinkedUser(linkedByDiscordId);
    }

    const normalized = cleaned.toLowerCase();
    const cachedMember =
      params.guild.members.cache.find((member) => {
        return (
          member.nickname?.toLowerCase() === normalized ||
          member.displayName.toLowerCase() === normalized ||
          member.user.username.toLowerCase() === normalized ||
          member.user.globalName?.toLowerCase() === normalized
        );
      }) ?? null;

    if (cachedMember) {
      return {
        discordId: cachedMember.id,
        discordLabel: cachedMember.displayName,
      } satisfies ResolvedTarget;
    }

    const twitchUser =
      /^\d+$/.test(cleaned)
        ? await getTwitchUserById(cleaned)
        : await getTwitchUserByLogin(cleaned);

    if (twitchUser) {
      const linkedByTwitch = await warningService.findLinkedUser({ twitchId: twitchUser.id });
      if (linkedByTwitch) {
        return buildTargetFromLinkedUser(linkedByTwitch);
      }

      return {
        twitchId: twitchUser.id,
        twitchLogin: twitchUser.login,
      } satisfies ResolvedTarget;
    }

    return null;
  }

  async resolveTwitchTarget(input: string) {
    const cleaned = normalizeTargetInput(input).replace(/^@/, "");

    if (/^\d+$/.test(cleaned)) {
      const linkedByTwitchId = await warningService.findLinkedUser({
        twitchId: cleaned,
      });
      if (linkedByTwitchId) {
        return buildTargetFromLinkedUser(linkedByTwitchId);
      }

      const linkedByDiscordId = await warningService.findLinkedUser({
        discordId: cleaned,
      });
      if (linkedByDiscordId) {
        return buildTargetFromLinkedUser(linkedByDiscordId);
      }
    }

    const twitchUser =
      /^\d+$/.test(cleaned)
        ? await getTwitchUserById(cleaned)
        : await getTwitchUserByLogin(cleaned);

    if (!twitchUser) {
      return null;
    }

    const linkedByTwitch = await warningService.findLinkedUser({ twitchId: twitchUser.id });
    if (linkedByTwitch) {
      return buildTargetFromLinkedUser(linkedByTwitch);
    }

    return {
      twitchId: twitchUser.id,
      twitchLogin: twitchUser.login,
    } satisfies ResolvedTarget;
  }

  async warn(params: {
    target: ResolvedTarget;
    moderator: ModeratorContext;
    reason: string;
  }) {
    const linkedUser = await warningService.findLinkedUser({
      discordId: params.target.discordId,
      twitchId: params.target.twitchId,
    });

    if (!linkedUser) {
      const directPunishment = punishmentService.getDirectUnlinkedPunishmentPlan();

      if (params.target.discordId) {
        await punishmentService.applyDiscordTimeout(
          params.target.discordId,
          directPunishment.durationMs!,
          params.reason
        );
        await punishmentService.notifyDirectPunishmentOnDiscord(
          params.target.discordId,
          directPunishment.label
        );
      }

      if (params.target.twitchId || params.target.twitchLogin) {
        await punishmentService.applyTwitchTimeout(
          params.target,
          directPunishment.durationMs!,
          params.reason
        );
        await punishmentService.notifyDirectPunishmentOnTwitch(
          params.target,
          directPunishment.label
        );
      }

      await logService.logDirectPunishmentForUnlinkedUser({
        user: params.target,
        moderator: params.moderator,
        reason: params.reason,
        durationLabel: directPunishment.label,
      });

      return {
        status: "unlinked_direct_punishment" as const,
        durationLabel: directPunishment.label,
      };
    }

    const warnedUser = await warningService.incrementWarning(linkedUser.id);

    const linkedTarget = await buildTargetFromLinkedUser(linkedUser);

    await logService.logWarning({
      user: linkedTarget,
      moderator: params.moderator,
      reason: params.reason,
      currentWarns: warnedUser.currentWarns,
      threshold: appConfig.moderation.warningThreshold,
      totalWarns: warnedUser.totalWarns,
    });

    if (warnedUser.currentWarns < appConfig.moderation.warningThreshold) {
      return {
        status: "warned" as const,
        currentWarns: warnedUser.currentWarns,
        threshold: appConfig.moderation.warningThreshold,
        totalWarns: warnedUser.totalWarns,
      };
    }

    const thresholdPunishment = punishmentService.getThresholdPunishmentPlan();
    const punishmentReason = "Reached warning threshold";

    if (linkedUser.discordId) {
      await punishmentService.applyDiscordTimeout(
        linkedUser.discordId,
        thresholdPunishment.durationMs!,
        punishmentReason
      );
    }

    if (linkedUser.twitchId) {
      await punishmentService.applyTwitchTimeout(
        { twitchId: linkedUser.twitchId },
        thresholdPunishment.durationMs!,
        punishmentReason
      );
    }

    const punishedUser = await warningService.registerPunishmentAndResetWarns(linkedUser.id);

    await logService.logThresholdPunishment({
      user: linkedTarget,
      moderator: params.moderator,
      durationLabel: thresholdPunishment.label,
      totalPunishments: punishedUser.totalPunishments,
    });

    return {
      status: "warned_and_punished" as const,
      durationLabel: thresholdPunishment.label,
      totalPunishments: punishedUser.totalPunishments,
      threshold: appConfig.moderation.warningThreshold,
    };
  }
}

export const moderationService = new ModerationService();
