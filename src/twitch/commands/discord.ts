import { createTwitchCommand } from "../base.js";

process.env.GUILD_BOT_CHANNEL_ID!

//Envia o link do canal do Discord no chat da twitch

createTwitchCommand({
	name: "discord",
	description: "Envia o link do canal do Discord no Chat",
	async run(client, channel) {
		client.say(channel, `Link para participar do nosso Discord: https://discord.gg/FcvVVZVWH9`);
	}
});