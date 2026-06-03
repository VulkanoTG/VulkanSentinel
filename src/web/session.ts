import { env } from "#config";
import crypto from "node:crypto";
import type { WebSessionPayload } from "./types.js";

export const WEB_SESSION_COOKIE_NAME = "vs_web_session";
export const WEB_OAUTH_STATE_COOKIE_NAME = "vs_web_oauth_state";
export const WEB_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const TWITCH_WEB_SCOPES = ["user:read:subscriptions"] as const;

function getWebSessionSecret() {
  return env.WEB_SESSION_SECRET ?? env.TWITCH_EVENTSUB_SECRET ?? env.BOT_TOKEN;
}

function signValue(value: string) {
  return crypto.createHmac("sha256", getWebSessionSecret()).update(value).digest("hex");
}

export function parseCookies(cookieHeader: string | undefined) {
  const pairs = (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const cookies = new Map<string, string>();
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    cookies.set(key, decodeURIComponent(value));
  }

  return cookies;
}

export function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const isSecure = env.TWITCH_REDIRECT_URI.startsWith("https://");
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isSecure ? "Secure" : null,
    `Max-Age=${maxAgeSeconds}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function serializeExpiredCookie(name: string) {
  const isSecure = env.TWITCH_REDIRECT_URI.startsWith("https://");
  return [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isSecure ? "Secure" : null,
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}

export function createWebSessionCookie(payload: WebSessionPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function readWebSessionFromCookieHeader(cookieHeader: string | undefined): WebSessionPayload | null {
  const cookies = parseCookies(cookieHeader);
  const rawSession = cookies.get(WEB_SESSION_COOKIE_NAME);

  if (!rawSession) {
    return null;
  }

  const [encodedPayload, signature] = rawSession.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as WebSessionPayload;
    if (!payload.twitchId || !payload.twitchLogin || !payload.twitchDisplayName || payload.expiresAt <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function buildTwitchAuthUrl(state: string) {
  return `https://id.twitch.tv/oauth2/authorize?${new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID ?? "",
    redirect_uri: env.TWITCH_REDIRECT_URI,
    response_type: "code",
    force_verify: "true",
    scope: TWITCH_WEB_SCOPES.join(" "),
    state,
  }).toString()}`;
}
