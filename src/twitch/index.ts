import { env } from "#env";
import tmi from "tmi.js";
import { setTwitchClient } from "../services/twitch.js";
import { getTwitchAccessToken, getTokenTimeLeft } from "../services/twitchAuth.js";
import { getTwitchCommands } from "./base.js";

import { handleTwitchMessage } from "./events/listener.js";
import { startWatchTracker, processChatActivity } from "./events/viewertracker.js";

// Twitch Commands
import "./commands/discord.js";
import "./commands/test.js";

async function bootstrapTwitchClient() {
    const accessToken = await getTwitchAccessToken() ?? env.TWITCH_USER_TOKEN;

    if (!accessToken) {
        throw new Error("Nenhum token da Twitch configurado (TWITCH_USER_TOKEN ou refresh).");
    }

    const password = accessToken.startsWith("oauth:")
        ? accessToken
        : `oauth:${accessToken}`;

    const client = new tmi.Client({
        options: { debug: true },
        identity: {
            username: env.TWITCH_USERNAME,
            password,
        },
        channels: [env.TWITCH_CHANNEL],
    });

    await client.connect();
    setTwitchClient(client);

    // inicia o sistema de pontos/tempo de live
    startWatchTracker();

    const timeLeft = getTokenTimeLeft();
    if (timeLeft > 0) {
        console.log(
            `[Twitch] Cliente conectado. Token expira em ${(timeLeft / 1000 / 60).toFixed(1)} minutos.`
        );
    } else {
        console.log(`[Twitch] Cliente conectado. Renovação automática de token ativada.`);
    }

    client.on("message", async (channel: string, tags: any, message: string, self: boolean) => {
        if (self) return;

        try {
            // ponte Twitch → Discord
            await handleTwitchMessage(tags, message);

            // registra atividade no tracker
            await processChatActivity(channel, tags);

            // comandos do chat
            if (message.startsWith("!")) {
                const [commandName, ...args] = message.slice(1).split(/\s+/);
                const command = getTwitchCommands().get(commandName.toLowerCase());

                if (command) {
                    await command.run(client, channel, tags, args);
                }
            }
        } catch (error) {
            console.error("Erro ao processar mensagem da Twitch:", error);

            if (message.startsWith("!")) {
                client.say(channel, `@${tags.username}, erro ao executar comando!`);
            }
        }
    });
}

bootstrapTwitchClient().catch((err) => {
    console.error("Erro ao inicializar cliente da Twitch:", err);
});