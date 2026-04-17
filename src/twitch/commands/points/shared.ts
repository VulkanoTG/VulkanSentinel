import { env } from "#config";

export function isTwitchPointsAdmin(tags: any) {
  if (tags.mod) {
    return true;
  }

  if (tags.badges?.broadcaster === "1") {
    return true;
  }

  return tags.username?.toLowerCase() === env.TWITCH_CHANNEL.toLowerCase();
}
