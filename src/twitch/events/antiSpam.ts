import { prisma } from "#database";
import { getTwitchClient } from "../../services/twitch.js";

const EXACT_PHRASES = [
  "viewer bot",
  "viewerbots",
  "buy viewers",
  "buy followers",
  "cheap viewers",
  "cheap followers",
  "best viewers",
  "best followers",
  "instant viewers",
  "instant followers",
  "more viewers",
  "more followers",
  "live viewers",
  "prime viewers",
  "follower service",
  "viewer service",
  "grow your channel",
  "promotion service",
  "promote your stream",
  "stream promotion",
];

const JOINED_PHRASES = [
  "buyviewers",
  "buyfollowers",
  "cheapviewers",
  "cheapfollowers",
  "viewerbot",
  "viewerbots",
  "followbot",
  "followbots",
  "instantviewers",
  "instantfollowers",
  "moreviewers",
  "morefollowers",
  "bestviewers",
  "bestfollowers",
  "liverviewers",
  "streampromotion",
  "promoteyourstream",
  "growyourchannel",
  "followerscheap",
  "viewerscheap",
];

const TRIGGER_WORDS = [
  "viewer",
  "viewers",
  "follower",
  "followers",
  "promo",
  "promotion",
  "promote",
  "grow",
  "cheap",
  "instant",
  "service",
  "bot",
  "bots",
];

function normalizeMessage(message: string) {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseMessage(message: string) {
  return normalizeMessage(message).replace(/[^a-z0-9]/g, "");
}

function isTrustedUser(tags: any) {
  return (
    tags.badges?.broadcaster === "1" ||
    tags.badges?.moderator === "1" ||
    tags.badges?.vip === "1" ||
    tags.mod === true ||
    tags["user-type"] === "mod"
  );
}

function looksLikeSpam(message: string) {
  const normalized = normalizeMessage(message);
  const collapsed = collapseMessage(message);

  const phraseMatch = EXACT_PHRASES.some((phrase) => normalized.includes(phrase));
  const joinedMatch = JOINED_PHRASES.some((phrase) => collapsed.includes(phrase));
  const triggerCount = TRIGGER_WORDS.filter(
    (word) => normalized.includes(word) || collapsed.includes(word)
  ).length;

  const suspiciousUrl =
    /(best|cheap|instant|prime|promo|viewer|follower)[a-z0-9-]*\.(com|net|gg|shop|site|xyz|ru|io)/i.test(
      normalized
    );

  return phraseMatch || joinedMatch || suspiciousUrl || triggerCount >= 3;
}

export async function handleAntiSpam(channel: string, tags: any, message: string) {
  const username = tags.username?.toLowerCase();
  const messageId = tags.id as string | undefined;
  const twitchId = tags["user-id"] as string | undefined;

  if (!username || !message || isTrustedUser(tags)) {
    return false;
  }

  if (!looksLikeSpam(message)) {
    return false;
  }

  if (twitchId) {
    const linkedUser = await prisma.user.findUnique({
      where: { twitchId },
      select: { id: true },
    });

    if (linkedUser) {
      return false;
    }
  }

  const client = getTwitchClient();

  try {
    if (messageId) {
      await client.deletemessage(channel, messageId);
    }
  } catch (error) {
    console.error(`[AntiSpam] Falha ao deletar mensagem de ${username}:`, error);
  }

  try {
    await client.ban(channel, username, "Spam de venda de viewers/followers");
  } catch (error) {
    console.error(`[AntiSpam] Falha ao banir ${username}:`, error);
  }

  console.warn(`[AntiSpam] Usuario banido por spam suspeito: ${username} | "${message}"`);
  return true;
}
