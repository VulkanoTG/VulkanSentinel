import { appConfig } from "#config";
import { prisma } from "#database";
import { calculateChannelPoints } from "../../services/channelPoints.js";
import { sendBotChatMessage } from "../../services/twitchChat.js";
import { isStreamLiveCached, onLiveStatusChange } from "../../services/liveStatus.js";
import { getTwitchClient } from "../../services/twitch.js";
import { isIgnoredTwitchUser } from "../shared.js";

const viewerTrackerConfig = appConfig.twitch.viewerTracker;
const warningCooldown = new Map<string, number>();
let lastTrackerPauseState: boolean | null = null;

export async function processChatActivity(channel: string, tags: any) {
  const client = getTwitchClient();
  const twitchId = tags["user-id"];
  const username = tags.username?.toLowerCase();
  const message = tags["message-text"] as string | undefined;

  if (!twitchId || !username) return;

  if (isIgnoredTwitchUser(username)) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { twitchId },
  });

  if (!user) {
    if (message?.startsWith("!")) {
      return;
    }

    const lastWarning = warningCooldown.get(username);
    const now = Date.now();

    if (
      lastWarning &&
      now - lastWarning < viewerTrackerConfig.unlinkedWarningCooldownHours * 60 * 60 * 1000
    ) {
      return;
    }

    warningCooldown.set(username, now);

    await sendBotChatMessage(
      client,
      channel,
      "Para ganhar firecoins da live conecte sua conta usando /link em nosso servidor do Discord siga as instruções para vincular sua Twitch!"
    );

    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastSeenInChat: new Date(),
    },
  });
}

export function startWatchTracker() {
  console.log("Viewer tracker iniciado");

  onLiveStatusChange((next, previous) => {
    if (!previous.initialized) {
      lastTrackerPauseState = !next.isLive;
      console.log(
        next.isLive ? "Stream online, tracker ativo" : "Stream offline, tracker pausado"
      );
      return;
    }

    if (next.isLive === previous.isLive) {
      return;
    }

    lastTrackerPauseState = !next.isLive;
    console.log(
      next.isLive ? "Stream online, tracker ativo" : "Stream offline, tracker pausado"
    );
  });

  setInterval(async () => {
    try {
      const live = isStreamLiveCached();

      if (!live) {
        if (lastTrackerPauseState !== true) {
          lastTrackerPauseState = true;
          console.log("Stream offline, tracker pausado");
        }
        return;
      }

      if (lastTrackerPauseState !== false) {
        lastTrackerPauseState = false;
        console.log("Stream online, tracker ativo");
      }

      const activeSince = new Date(
        Date.now() - viewerTrackerConfig.activeWindowMinutes * 60 * 1000
      );

      const activeUsers = await prisma.user.findMany({
        where: {
          twitchId: { not: null },
          lastSeenInChat: {
            gte: activeSince,
          },
        },
        select: { id: true },
      });

      if (activeUsers.length === 0) return;

      for (const activeUser of activeUsers) {
        const reward = await calculateChannelPoints({
          userId: activeUser.id,
          baseHours: viewerTrackerConfig.watchIntervalMinutes / 60,
        });

        await prisma.user.update({
          where: { id: activeUser.id },
          data: {
            balance: { increment: reward.points },
            hoursWatched: { increment: reward.hours },
          },
        });
      }
    } catch {
      // Mantem o tracker vivo mesmo em caso de falha pontual.
    }
  }, viewerTrackerConfig.watchIntervalMinutes * 60 * 1000);
}
