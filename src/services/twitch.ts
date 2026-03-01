import type { Client as TMIClient } from "tmi.js";

let twitchClient: TMIClient | null = null;

export function setTwitchClient(client: TMIClient) {
    twitchClient = client;
}

export function getTwitchClient(): TMIClient {
    if (!twitchClient) throw new Error("Twitch client not initialized. Call setTwitchClient first.");
    return twitchClient;
}

export function hasTwitchClient(): boolean {
    return twitchClient !== null;
}
