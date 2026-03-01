import { env } from "#env";
import { getTwitchAccessToken } from "./twitchAuth.js";
// Types 
type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

type TwitchUsersResponse = {
  data: TwitchUser[];
};

type TwitchStream = {
  id: string;
  user_id: string;
  user_name: string;
  game_id: string;
  type: "live";
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  is_mature: boolean;
};

type TwitchStreamsResponse = {
  data: TwitchStream[];
};


// -- Get Twitch user ID --
async function getUserId(login: string): Promise<string | null> {
  const lc = login.toLowerCase().trim();
  const clientId = env.TWITCH_CLIENT_ID;
  const userToken = await getTwitchAccessToken();

  if (!clientId || !userToken) return null;

  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(lc)}`,
    {
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${userToken}`,
      },
    }
  );

  if (!res.ok) {
    console.error(
      `Failed to get user id for ${login}: ${res.status} ${await res.text()}`
    );
    return null;
  }

  const data = (await res.json()) as TwitchUsersResponse;

  return data.data?.[0]?.id ?? null;
}


// -- Get Twitch user by numeric ID (not login) --
export async function getTwitchUserById(
  twitchId: string
): Promise<TwitchUser | null> {
  const clientId = env.TWITCH_CLIENT_ID;
  const userToken = await getTwitchAccessToken();

  if (!clientId || !userToken) return null;

  const res = await fetch(
    `https://api.twitch.tv/helix/users?id=${twitchId}`,
    {
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${userToken}`,
      },
    }
  );

  if (!res.ok) {
    console.error(
      `Failed to get Twitch user by ID ${twitchId}: ${res.status} ${await res.text()}`
    );
    return null;
  }

  const data = (await res.json()) as TwitchUsersResponse;

  return data.data?.[0] ?? null;
}

// -- Send Twitch whisper from bot to target login --
export async function sendTwitchWhisper(
  targetLogin: string,
  message: string
) {
  const clientId = env.TWITCH_CLIENT_ID;
  const userToken = await getTwitchAccessToken();
  const botUserId = env.TWITCH_BOT_ID;

  if (!clientId || !userToken || !botUserId) {
    throw new Error(
      "Missing TWITCH_CLIENT_ID, TWITCH_USER_TOKEN or TWITCH_BOT_ID in environment"
    );
  }

  const toUserId = await getUserId(targetLogin);
  if (!toUserId) {
    throw new Error(`Target user ${targetLogin} not found`);
  }

  let fromUserId = botUserId;

  if (!/^\d+$/.test(fromUserId)) {
    const resolved = await getUserId(fromUserId);
    if (!resolved) {
      throw new Error(`Bot user ${fromUserId} not found`);
    }
    fromUserId = resolved;
  }

  const res = await fetch("https://api.twitch.tv/helix/whispers", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      "Authorization": `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      message,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Helix whisper failed: ${res.status} ${body}`);
  }

  return true;
}

// -- Get Live Mode (On/Off) --

export async function isStreamOnline(): Promise<boolean> {
  const clientId = env.TWITCH_CLIENT_ID;
  const userToken = await getTwitchAccessToken();
  const broadcasterId = env.TWITCH_BROADCASTER_ID;

  if (!clientId || !userToken || !broadcasterId) {
    throw new Error("Missing Twitch environment variables");
  }

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`,
    {
      method: "GET",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${userToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro Twitch API: ${errorText}`);
  }

  const data = (await res.json()) as TwitchStreamsResponse;

  return data.data.length > 0;
}

