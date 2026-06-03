import { env } from "#config";

type SpotifyTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

type SpotifySearchResponse = {
  tracks?: {
    items?: Array<{
      id: string;
      uri: string;
      name: string;
      duration_ms: number;
      external_urls?: {
        spotify?: string;
      };
      artists: Array<{
        id: string;
        name: string;
      }>;
      album: {
        name: string;
        images?: Array<{
          url: string;
          width?: number;
          height?: number;
        }>;
      };
    }>;
  };
};

type SpotifyDeviceResponse = {
  devices?: Array<{
    id: string;
    is_active: boolean;
    is_private_session?: boolean;
    is_restricted?: boolean;
    name: string;
    type: string;
  }>;
};

type SpotifyPlaybackStateResponse = {
  is_playing?: boolean;
  device?: {
    id?: string;
    is_active?: boolean;
  } | null;
};

type SpotifyQueueResponse = {
  currently_playing?: NonNullable<NonNullable<SpotifySearchResponse["tracks"]>["items"]>[number] | null;
  queue?: Array<NonNullable<NonNullable<SpotifySearchResponse["tracks"]>["items"]>[number]>;
};

export type SpotifyTrackResult = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  url: string | null;
  artworkUrl: string | null;
};

export type SpotifyAvailabilityResult =
  | {
      ok: true;
      deviceId: string;
    }
  | {
      ok: false;
      reason: "NO_DEVICE" | "CONFIGURED_DEVICE_NOT_FOUND" | "RESTRICTED_DEVICE";
      message: string;
    };

export type SpotifyQueueSnapshot = {
  availability: SpotifyAvailabilityResult;
  currentTrack: SpotifyTrackResult | null;
  queue: SpotifyTrackResult[];
};

export type SpotifyModerationSnapshot = {
  available: boolean;
  isPlaying: boolean;
  currentTrackName: string | null;
  queueCount: number;
  clearSupported: false;
};

let cachedSpotifyAccessToken: string | null = null;
let spotifyAccessTokenExpiresAt: number | null = null;

function getSpotifyConfig() {
  return {
    clientId: env.SPOTIFY_CLIENT_ID,
    clientSecret: env.SPOTIFY_CLIENT_SECRET,
    refreshToken: env.SPOTIFY_REFRESH_TOKEN,
    deviceId: env.SPOTIFY_DEVICE_ID,
  };
}

function assertSpotifyConfigured() {
  const { clientId, clientSecret, refreshToken } = getSpotifyConfig();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Spotify nao configurado. Defina SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e SPOTIFY_REFRESH_TOKEN."
    );
  }
}

async function getSpotifyAccessToken() {
  assertSpotifyConfigured();

  if (
    cachedSpotifyAccessToken &&
    spotifyAccessTokenExpiresAt &&
    Date.now() < spotifyAccessTokenExpiresAt - 60_000
  ) {
    return cachedSpotifyAccessToken;
  }

  const { clientId, clientSecret, refreshToken } = getSpotifyConfig();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken!,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao renovar token do Spotify: ${response.status} ${body}`);
  }

  const data = (await response.json()) as SpotifyTokenResponse;
  if (!data.access_token) {
    throw new Error("Resposta do Spotify sem access_token.");
  }

  cachedSpotifyAccessToken = data.access_token;
  spotifyAccessTokenExpiresAt = data.expires_in
    ? Date.now() + data.expires_in * 1000
    : Date.now() + 30 * 60 * 1000;

  return cachedSpotifyAccessToken;
}

async function spotifyRequest(
  input: string,
  init?: RequestInit
) {
  const accessToken = await getSpotifyAccessToken();
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify API ${response.status}: ${body}`);
  }

  return response;
}

function mapTrack(track: NonNullable<NonNullable<SpotifySearchResponse["tracks"]>["items"]>[number]): SpotifyTrackResult {
  const artwork = track.album.images?.[0]?.url ?? null;

  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artist: track.artists.map((artist) => artist.name).join(", "),
    album: track.album.name,
    durationMs: track.duration_ms,
    url: track.external_urls?.spotify ?? null,
    artworkUrl: artwork,
  };
}

export async function searchSpotifyTracks(input: {
  title: string;
  artist?: string | null;
  limit?: number;
}) {
  const title = input.title.trim();
  const artist = input.artist?.trim();
  const limit = Math.max(1, Math.min(10, input.limit ?? 5));

  if (!title) {
    throw new Error("Informe o nome da musica.");
  }

  const query = artist ? `track:${title} artist:${artist}` : title;
  const url = `https://api.spotify.com/v1/search?${new URLSearchParams({
    q: query,
    type: "track",
    limit: String(limit),
    market: "BR",
  }).toString()}`;

  const response = await spotifyRequest(url, { method: "GET" });
  const data = (await response.json()) as SpotifySearchResponse;
  const tracks = data.tracks?.items ?? [];

  return tracks.map(mapTrack);
}

export async function searchSpotifyTrack(input: {
  title: string;
  artist?: string | null;
}) {
  const tracks = await searchSpotifyTracks({
    title: input.title,
    artist: input.artist,
    limit: 1,
  });

  return tracks[0] ?? null;
}

async function resolveSpotifyDeviceId() {
  const { deviceId } = getSpotifyConfig();
  if (deviceId) {
    return deviceId;
  }

  const response = await spotifyRequest("https://api.spotify.com/v1/me/player/devices", {
    method: "GET",
  });
  const data = (await response.json()) as SpotifyDeviceResponse;
  const activeDevice = data.devices?.find((item) => item.is_active) ?? data.devices?.[0];

  return activeDevice?.id ?? null;
}

async function getSpotifyDevices() {
  const response = await spotifyRequest("https://api.spotify.com/v1/me/player/devices", {
    method: "GET",
  });
  const data = (await response.json()) as SpotifyDeviceResponse;
  return data.devices ?? [];
}

async function getSpotifyPlaybackState() {
  const response = await spotifyRequest("https://api.spotify.com/v1/me/player", {
    method: "GET",
  });

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as SpotifyPlaybackStateResponse;
}

export async function getSpotifyQueueAvailability(): Promise<SpotifyAvailabilityResult> {
  const deviceId = await resolveSpotifyDeviceId();

  if (!deviceId) {
    return {
      ok: false,
      reason: "NO_DEVICE",
      message:
        "O recurso esta desativado temporariamente porque o streamer nao esta usando o Spotify agora.",
    };
  }

  const devices = await getSpotifyDevices();
  const targetDevice = devices.find((device) => device.id === deviceId);

  if (!targetDevice) {
    return {
      ok: false,
      reason: "CONFIGURED_DEVICE_NOT_FOUND",
      message:
        "O recurso esta desativado temporariamente porque o streamer nao esta usando o Spotify agora.",
    };
  }

  if (targetDevice.is_restricted) {
    return {
      ok: false,
      reason: "RESTRICTED_DEVICE",
      message:
        "O recurso esta desativado temporariamente porque o Spotify do streamer nao aceita controle remoto agora.",
    };
  }

  return {
    ok: true,
    deviceId,
  };
}

async function queueSpotifyTrackOnDevice(trackUri: string, deviceId: string | null) {
  const params = new URLSearchParams({
    uri: trackUri,
  });

  if (deviceId) {
    params.set("device_id", deviceId);
  }

  await spotifyRequest(`https://api.spotify.com/v1/me/player/queue?${params.toString()}`, {
    method: "POST",
  });
}

async function transferSpotifyPlayback(deviceId: string) {
  await spotifyRequest("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
  });
}

async function pauseSpotifyPlayback(deviceId: string) {
  await spotifyRequest(`https://api.spotify.com/v1/me/player/pause?${new URLSearchParams({
    device_id: deviceId,
  }).toString()}`, {
    method: "PUT",
  });
}

async function resumeSpotifyPlayback(deviceId: string) {
  await spotifyRequest(`https://api.spotify.com/v1/me/player/play?${new URLSearchParams({
    device_id: deviceId,
  }).toString()}`, {
    method: "PUT",
  });
}

async function startSpotifyTrack(trackUri: string, deviceId: string) {
  const params = new URLSearchParams({
    device_id: deviceId,
  });

  await spotifyRequest(`https://api.spotify.com/v1/me/player/play?${params.toString()}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uris: [trackUri],
    }),
  });
}

async function setSpotifyRepeatOff(deviceId: string) {
  await spotifyRequest(`https://api.spotify.com/v1/me/player/repeat?${new URLSearchParams({
    state: "off",
    device_id: deviceId,
  }).toString()}`, {
    method: "PUT",
  });
}

export async function skipSpotifyTrack() {
  const availability = await getSpotifyQueueAvailability();
  if (!availability.ok) {
    throw new Error(availability.message);
  }

  await spotifyRequest(`https://api.spotify.com/v1/me/player/next?${new URLSearchParams({
    device_id: availability.deviceId,
  }).toString()}`, {
    method: "POST",
  });
}

export async function toggleSpotifyPlaybackPause() {
  const availability = await getSpotifyQueueAvailability();
  if (!availability.ok) {
    throw new Error(availability.message);
  }

  const playbackState = await getSpotifyPlaybackState();
  if (playbackState?.is_playing) {
    await pauseSpotifyPlayback(availability.deviceId);
    return { paused: true as const };
  }

  await resumeSpotifyPlayback(availability.deviceId);
  return { paused: false as const };
}

export async function queueSpotifyTrack(trackUri: string) {
  const availability = await getSpotifyQueueAvailability();
  if (!availability.ok) {
    throw new Error(availability.message);
  }

  const deviceId = availability.deviceId;

  const playbackState = await getSpotifyPlaybackState();

  await setSpotifyRepeatOff(deviceId);

  const isPlaybackActiveOnTarget =
    playbackState?.is_playing === true &&
    playbackState.device?.id === deviceId &&
    playbackState.device?.is_active === true;

  if (isPlaybackActiveOnTarget) {
    await queueSpotifyTrackOnDevice(trackUri, deviceId);
    return;
  }

  await transferSpotifyPlayback(deviceId);
  await queueSpotifyTrackOnDevice(trackUri, deviceId);

  try {
    await resumeSpotifyPlayback(deviceId);
    return;
  } catch {
    await startSpotifyTrack(trackUri, deviceId);
  }
}

export async function getSpotifyQueueSnapshot(input?: {
  limit?: number;
}): Promise<SpotifyQueueSnapshot> {
  const availability = await getSpotifyQueueAvailability();
  if (!availability.ok) {
    return {
      availability,
      currentTrack: null,
      queue: [],
    };
  }

  const response = await spotifyRequest("https://api.spotify.com/v1/me/player/queue", {
    method: "GET",
  });
  const data = (await response.json()) as SpotifyQueueResponse;
  const limit = Math.max(1, Math.min(10, input?.limit ?? 5));

  return {
    availability,
    currentTrack: data.currently_playing ? mapTrack(data.currently_playing) : null,
    queue: (data.queue ?? [])
      .filter((track, index) => {
        if (data.currently_playing && track.id === data.currently_playing.id && index === 0) {
          return false;
        }

        return true;
      })
      .slice(0, limit)
      .map(mapTrack),
  };
}

export async function getSpotifyModerationSnapshot(): Promise<SpotifyModerationSnapshot> {
  const snapshot = await getSpotifyQueueSnapshot({ limit: 10 });
  const playbackState = snapshot.availability.ok
    ? await getSpotifyPlaybackState().catch(() => null)
    : null;

  return {
    available: snapshot.availability.ok,
    isPlaying: playbackState?.is_playing === true,
    currentTrackName: snapshot.currentTrack?.name ?? null,
    queueCount: snapshot.queue.length,
    clearSupported: false,
  };
}
