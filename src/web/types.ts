export type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

export type TwitchUserResponse = {
  data: {
    id: string;
    login: string;
    display_name: string;
  }[];
};

export type WebProfilePayload = {
  viewer: null | {
    twitchId: string;
    twitchLogin: string;
    twitchDisplayName: string;
  };
  live: {
    isLive: boolean;
    title: string | null;
    category: string | null;
    viewerCount: number | null;
    startedAt: string | null;
  };
  user: null | {
    id: number;
    discordId: string;
    discordLabel: string | null;
    twitchId: string | null;
    twitchLogin: string;
    twitchDisplayName: string;
    balance: number;
    hoursWatched: number;
    currentWarns: number;
    totalWarns: number;
    totalPunishments: number;
    isTwitchSub: boolean;
    isDiscordBooster: boolean;
    isModerator: boolean;
    badges: Array<{
      key: string;
      name: string;
      description: string | null;
      iconUrl: string | null;
      active: boolean;
      equipped: boolean;
      displayOrder: number;
      source: string | null;
      note: string | null;
      acquiredAt: string;
    }>;
    multiplier: number;
    basePoints: number;
    activeBonuses: string[];
  };
  rewards: Array<{
    key: string;
    id: string;
    title: string;
    cost: number;
    enabled: boolean;
    description: string;
    affordable: boolean;
    type: "spotify" | "voicemod" | "soundalert" | "chaos";
    thumbnailUrl: string | null;
    status: "coming_soon" | "available";
  }>;
  controlsInvertEffect: {
    effectKey: string;
    userId: number | null;
    requesterName: string | null;
    agentId: string | null;
    state: "idle" | "active" | "paused";
    startedAt: string | null;
    expiresAt: string | null;
    pausedAt: string | null;
    sessionId: string | null;
    source: string | null;
    agentState: "idle" | "active" | "paused";
    cooldownUntil: string | null;
  };
  mouseAxesInvertEffect: {
    effectKey: string;
    userId: number | null;
    requesterName: string | null;
    agentId: string | null;
    state: "idle" | "active" | "paused";
    startedAt: string | null;
    expiresAt: string | null;
    pausedAt: string | null;
    sessionId: string | null;
    source: string | null;
    agentState: "idle" | "active" | "paused";
    cooldownUntil: string | null;
  };
  voicemodVoices: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    fallbackThumbnailUrl: string | null;
    selectedThumbnailUrl: string | null;
    imageCandidates: string[];
    selectedImageCandidates: string[];
    voiceId: string;
    agentId: string;
    enabled: boolean;
    isCustom: boolean;
    favorited: boolean;
    isNew: boolean;
    bitmapChecksum: string | null;
    isActive: boolean;
    isQueued: boolean;
  }>;
  voicemodSoundboard: null | {
    id: string | null;
    name: string | null;
  };
  voicemodSoundAlerts: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    fallbackThumbnailUrl: string | null;
    imageCandidates: string[];
    soundId: string;
    agentId: string;
    enabled: boolean;
    playbackMode: string | null;
    loop: boolean;
    muteVoice: boolean;
    stopOtherSounds: boolean;
    soundboardId: string | null;
    soundboardName: string | null;
  }>;
  activeVoicemodReward: null | {
    queueId: number;
    userId: number;
    agentId: string;
    voiceId: string;
    technicalId: string;
    displayName: string;
    startedAt: string;
    expiresAt: string;
    remainingMs: number;
  };
  voicemodQueue: Array<{
    queueId: number;
    userId: number;
    technicalId: string;
    displayName: string;
    createdAt: string;
    position: number;
  }>;
  rewardSettings: Array<{
    key: string;
    id: string;
    title: string;
    cost: number;
    enabled: boolean;
    description: string;
  }>;
  moduleSettings: Array<{
    key: string;
    title: string;
    enabled: boolean;
    description: string;
  }>;
  spotifyQueue: {
    available: boolean;
    message: string | null;
    currentTrack: null | {
      name: string;
      artist: string;
      album: string;
      url: string | null;
      artworkUrl: string | null;
    };
    tracks: Array<{
      name: string;
      artist: string;
      album: string;
      url: string | null;
      artworkUrl: string | null;
    }>;
  };
};

export type WebSessionPayload = {
  twitchId: string;
  twitchLogin: string;
  twitchDisplayName: string;
  expiresAt: number;
};
