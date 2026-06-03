import { appConfig } from "#config";

export function isIgnoredTwitchUser(username: string | null | undefined) {
  if (!username) {
    return false;
  }

  const normalizedUsername = username.toLowerCase();
  return appConfig.twitch.ignoredUsers.some((ignoredUser) => ignoredUser === normalizedUsername);
}
