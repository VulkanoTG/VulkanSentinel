import { prisma } from "#database";
import { isStreamOnline } from "#helix";
import { getTwitchClient } from "../../services/twitch.js";

/* CONFIG */

const WATCH_INTERVAL_MINUTES = 10;
const POINTS_PER_INTERVAL = 30;
const ACTIVE_WINDOW_MINUTES = 15;
const WARNING_COOLDOWN_MINUTES = 30;

const IGNORE_USERS = [
  "nightbot",
  "streamelements",
  "moobot"
];

const warningCooldown = new Map<string, number>();


// Verifica atividade no chat e atualiza o timestamp do último visto
export async function processChatActivity(channel: string, tags: any) {

  const client = getTwitchClient();

  const twitchId = tags["user-id"];
  const username = tags.username?.toLowerCase();

//   console.log("📩 Tracker recebeu:", username);

  if (!twitchId || !username) return;

  if (IGNORE_USERS.includes(username)) {
    // console.log("⏭ Ignorado:", username);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { twitchId }
  });

  if (!user) {

    // console.log("⚠ Usuário não vinculado:", username);

    const lastWarning = warningCooldown.get(username);
    const now = Date.now();

    if (
      lastWarning &&
      now - lastWarning < WARNING_COOLDOWN_MINUTES * 60 * 1000
    ) {
      return;
    }

    warningCooldown.set(username, now);

    await client.say(
      channel,
      `Para ganhar pontos da live conecte sua conta no Discord usando /discord e siga as instruções para vincular sua Twitch!`
    );

    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastSeenInChat: new Date()
    }
  });

}

// Tracker de Timer
export function startWatchTracker() {

  console.log("Viewer tracker iniciado");

  setInterval(async () => {

    try {

        const live = await isStreamOnline();

        if (!live) {
            console.log("⏸ Stream offline, tracker pausado");
            return;
        }


      const activeSince = new Date(
        Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000
      );

      const activeUsers = await prisma.user.findMany({
        where: {
          twitchId: { not: null },
          lastSeenInChat: {
            gte: activeSince
          }
        },
        select: { id: true }
      });

      // console.log("👥 Usuários ativos:", activeUsers.length);

      if (activeUsers.length === 0) return;

      const ids = activeUsers.map(u => u.id);

      await prisma.user.updateMany({
        where: {
          id: { in: ids }
        },
        data: {
          balance: { increment: POINTS_PER_INTERVAL },
          hoursWatched: { increment: WATCH_INTERVAL_MINUTES / 60 }
        }
      });

    } catch (err) {

    //   console.error("🔥 Tracker error:", err);

    }

  }, WATCH_INTERVAL_MINUTES * 60 * 1000);

}