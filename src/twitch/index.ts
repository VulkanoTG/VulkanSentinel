import { env } from "#env";
import tmi from "tmi.js";
import { setTwitchClient } from "../services/twitch.js";
import { getTwitchAccessToken } from "../services/twitchAuth.js";
import { getTwitchCommands } from "./base.js";

import { handleTwitchMessage } from "./events/listener.js";
// Twitch Commands
import "./commands/discord.js";
import "./commands/test.js";
//

async function bootstrapTwitchClient() {
	const accessToken = await getTwitchAccessToken() ?? env.TWITCH_USER_TOKEN;

	if (!accessToken) {
		throw new Error("Nenhum token da Twitch configurado (TWITCH_USER_TOKEN ou refresh).");
	}

	// tmi.js espera o formato "oauth:<token>"
	const password = accessToken.startsWith("oauth:") ? accessToken : `oauth:${accessToken}`;

	const client = new tmi.Client({
		options: { debug: true },
		identity: {
			username: env.TWITCH_USERNAME,
			password,
		},
		channels: [ env.TWITCH_CHANNEL ],
	});

	await client.connect();

	setTwitchClient(client);

	client.on("message", async (channel: string, tags: any, message: string, self: boolean) => {
		// Ignore echoed messages.
		if (self) return;

		await handleTwitchMessage(tags, message);

		// Handle commands
		if (message.startsWith("!")) {
			const [commandName, ...args] = message.slice(1).split(/\s+/);
			const command = getTwitchCommands().get(commandName.toLowerCase());

			if (command) {
				try {
					await command.run(client, channel, tags, args);
				} catch (error) {
					console.error(`Error executing command ${commandName}:`, error);
					client.say(channel, `@${tags.username}, erro ao executar comando!`);
				}
			}
		}
	});
}

bootstrapTwitchClient().catch((err) => {
	console.error("Erro ao inicializar cliente da Twitch:", err);
});
		