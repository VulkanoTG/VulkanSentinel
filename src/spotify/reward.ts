import { prisma } from "#database";
import { publishRewardOverlayMessage } from "../services/chatOverlay.js";
import { getRewardSetting } from "../services/rewardSettings.js";
import { sendSystemChatMessage } from "../services/twitchChat.js";
import {
  getSpotifyQueueAvailability,
  queueSpotifyTrack,
  searchSpotifyTrack,
} from "./service.js";

type RewardUser = {
  id: number;
  discordId: string;
  twitchId: string | null;
  balance: number;
};

type SpotifyRewardResult =
  | {
      ok: true;
      user: RewardUser;
      chargedAmount: number;
      balanceAfter: number;
      track: Awaited<ReturnType<typeof searchSpotifyTrack>> extends infer T
        ? Exclude<T, null>
        : never;
    }
  | {
      ok: false;
      code:
        | "USER_NOT_FOUND"
        | "REWARD_DISABLED"
        | "INSUFFICIENT_BALANCE"
        | "TRACK_NOT_FOUND"
        | "SPOTIFY_UNAVAILABLE"
        | "SPOTIFY_ERROR";
      chargedAmount?: number;
      user?: RewardUser;
      message: string;
    };

async function findRewardUser(input: { discordId?: string; twitchId?: string }) {
  if (input.discordId) {
    return prisma.user.findUnique({
      where: { discordId: input.discordId },
      select: {
        id: true,
        discordId: true,
        twitchId: true,
        balance: true,
      },
    });
  }

  if (input.twitchId) {
    return prisma.user.findUnique({
      where: { twitchId: input.twitchId },
      select: {
        id: true,
        discordId: true,
        twitchId: true,
        balance: true,
      },
    });
  }

  return null;
}

export async function requestSpotifyTrackReward(input: {
  discordId?: string;
  twitchId?: string;
  requesterName?: string;
  title: string;
  artist?: string | null;
}) : Promise<SpotifyRewardResult> {
  const user = await findRewardUser({
    discordId: input.discordId,
    twitchId: input.twitchId,
  });

  if (!user) {
    return {
      ok: false,
      code: "USER_NOT_FOUND",
      message: "Sua conta ainda nao foi encontrada no banco. Vincule a Twitch primeiro.",
    };
  }

  const rewardSetting = await getRewardSetting("spotifyQueue");

  if (!rewardSetting.enabled) {
    return {
      ok: false,
      code: "REWARD_DISABLED",
      user,
      message: "O pedido de musica esta desativado no momento.",
    };
  }

  const chargedAmount = rewardSetting.cost;

  if (user.balance < chargedAmount) {
    return {
      ok: false,
      code: "INSUFFICIENT_BALANCE",
      chargedAmount,
      user,
      message: `Saldo insuficiente. Voce precisa de ${chargedAmount} Firecoins e tem ${user.balance}.`,
    };
  }

  const track = await searchSpotifyTrack({
    title: input.title,
    artist: input.artist,
  });

  if (!track) {
    return {
      ok: false,
      code: "TRACK_NOT_FOUND",
      chargedAmount,
      user,
      message: "Nao encontrei essa musica no Spotify.",
    };
  }

  const availability = await getSpotifyQueueAvailability();
  if (!availability.ok) {
    return {
      ok: false,
      code: "SPOTIFY_UNAVAILABLE",
      chargedAmount,
      user,
      message: availability.message,
    };
  }

  let charged = false;

  try {
    const chargeResult = await prisma.user.updateMany({
      where: {
        id: user.id,
        balance: {
          gte: chargedAmount,
        },
      },
      data: {
        balance: { decrement: chargedAmount },
      },
    });

    if (chargeResult.count === 0) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    charged = true;

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        balance: true,
      },
    });

    if (!updatedUser) {
      throw new Error("USER_NOT_FOUND_AFTER_CHARGE");
    }

    await queueSpotifyTrack(track.uri);
    if (input.requesterName) {
      const announcement = `${input.requesterName} adicionou a musica ${track.name} na playlist`;

      await sendSystemChatMessage(announcement).catch((error) => {
        console.error("[SpotifyReward] Falha ao avisar no chat da Twitch:", error);
      });
    }

    publishRewardOverlayMessage({
      username: "Vulkan Sentinel",
      message: `${input.requesterName ?? "Alguem"} adicionou a musica ${track.name} na playlist`,
      icon: "SPTFY",
      tone: "spotify",
    });

    return {
      ok: true,
      user,
      chargedAmount,
      balanceAfter: updatedUser.balance,
      track,
    };
  } catch (error) {
    if (charged) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: chargedAmount },
        },
      }).catch((refundError) => {
        console.error("[SpotifyReward] Falha ao estornar Firecoins:", refundError);
      });
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return {
        ok: false,
        code: "INSUFFICIENT_BALANCE",
        chargedAmount,
        user,
        message: `Saldo insuficiente. Voce precisa de ${chargedAmount} Firecoins.`,
      };
    }

    console.error("[SpotifyReward] Falha ao processar pedido do Spotify:", error);
    return {
      ok: false,
      code: "SPOTIFY_ERROR",
      chargedAmount,
      user,
      message:
        "Falha ao adicionar a musica na fila do Spotify. Se houve cobranca parcial, o sistema tentou estornar automaticamente.",
    };
  }
}
