import "#server";
import { env } from "#env";
import { bootstrap } from "@constatic/base";
import { setDiscordClient } from "./services/discord.js";
import "./twitch/index.js";

await bootstrap({ 
	meta: import.meta, 
	env,
	beforeLoad: async (client) => {
		setDiscordClient(client);
	}
});