import { validateEnv } from "@constatic/base";
import { z } from "zod";
import "./constants.js";

export const env = await validateEnv(z.looseObject({
    BOT_TOKEN: z.string("Discord Bot Token is required").min(1),
    WEBHOOK_LOGS_URL: z.url().optional(),
    GUILD_ID: z.string().optional(),
    GUILD_BOT_CHANNEL_ID: z.string("Guild Bot Channel ID is required").min(1),
    
    DATABASE_URL: z.string("Database URL is required").min(1),


    INTEGRATION_LOGS_CHANNEL_ID:z.string().optional(),


    TWITCH_CHANNEL: z.string("Twitch Streamer Channel is required").min(1),
    TWITCH_BROADCASTER_ID: z.string("Twitch Broadcaster ID is required").min(1),
    TWITCH_CLIENT_ID: z.string().optional(),
    TWITCH_USER_TOKEN: z.string().optional(),
    TWITCH_BOT_ID: z.string().optional(),
    TWITCH_CLIENT_SECRET: z.string().optional(),
    TWITCH_REFRESH_TOKEN: z.string().optional(),
    TWITCH_USERNAME: z.string("Twitch username is required").min(1),
    TWITCH_REDIRECT_URI: z.string("CallbackUrl is required").min(1),
}));