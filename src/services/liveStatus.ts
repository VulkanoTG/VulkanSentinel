import { getCurrentStream, type TwitchStream } from "./twitchHelix.js";

export type LiveStatusSnapshot = {
  initialized: boolean;
  isLive: boolean;
  stream: TwitchStream | null;
  source: string | null;
  updatedAt: Date | null;
};

type LiveStatusListener = (
  next: LiveStatusSnapshot,
  previous: LiveStatusSnapshot
) => void | Promise<void>;

const listeners = new Set<LiveStatusListener>();

let snapshot: LiveStatusSnapshot = {
  initialized: false,
  isLive: false,
  stream: null,
  source: null,
  updatedAt: null,
};

let bootstrapPromise: Promise<LiveStatusSnapshot> | null = null;

function notifyListeners(next: LiveStatusSnapshot, previous: LiveStatusSnapshot) {
  for (const listener of listeners) {
    void Promise.resolve(listener(next, previous)).catch((error) => {
      console.error("[LiveStatus] Listener falhou:", error);
    });
  }
}

function applySnapshot(
  next: Omit<LiveStatusSnapshot, "updatedAt"> & { updatedAt?: Date | null },
  options?: { emit?: boolean }
) {
  const previous = snapshot;

  snapshot = {
    ...next,
    updatedAt: next.updatedAt ?? new Date(),
  };

  if (options?.emit === false) {
    return snapshot;
  }

  notifyListeners(snapshot, previous);
  return snapshot;
}

export function getLiveStatusSnapshot(): LiveStatusSnapshot {
  return snapshot;
}

export function onLiveStatusChange(listener: LiveStatusListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function initializeLiveStatus() {
  if (snapshot.initialized) {
    return snapshot;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = getCurrentStream()
      .then((stream) =>
        applySnapshot(
          {
            initialized: true,
            isLive: stream !== null,
            stream,
            source: "bootstrap:helix",
            updatedAt: new Date(),
          },
          { emit: false }
        )
      )
      .finally(() => {
        bootstrapPromise = null;
      });
  }

  return bootstrapPromise;
}

export async function refreshLiveStatus(source = "refresh:helix") {
  const stream = await getCurrentStream();

  return applySnapshot({
    initialized: true,
    isLive: stream !== null,
    stream,
    source,
    updatedAt: new Date(),
  });
}

export function markStreamOffline(source = "eventsub:stream.offline") {
  return applySnapshot({
    initialized: true,
    isLive: false,
    stream: null,
    source,
    updatedAt: new Date(),
  });
}

export function isStreamLiveCached() {
  return snapshot.isLive;
}
