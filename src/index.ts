import "./shared/consoleLogger.js";
import { httpServer } from "#server";
import { env } from "#config";
import { bootstrap } from "@constatic/base";
import { hasDiscordClient, getDiscordClient, setDiscordClient } from "./services/discord.js";
import { prisma } from "#database";
import { hasTwitchClient, getTwitchClient } from "./services/twitch.js";
import "./twitch/index.js";

let isShuttingDown = false;

function closeHttpServer() {
	return new Promise<void>((resolve, reject) => {
		httpServer.close((error) => {
			if (error) {
				reject(error);
				return;
			}

			resolve();
		});
	});
}

async function shutdown(signal: NodeJS.Signals) {
	if (isShuttingDown) {
		return;
	}

	isShuttingDown = true;
	console.log(`[App] Sinal ${signal} recebido. Iniciando shutdown gracioso...`);

	try {
		await closeHttpServer();
		console.log("[App] HTTP server encerrado.");
	} catch (error) {
		console.error("[App] Erro ao encerrar HTTP server:", error);
	}

	if (hasTwitchClient()) {
		try {
			await getTwitchClient().disconnect();
			console.log("[App] Cliente Twitch desconectado.");
		} catch (error) {
			console.error("[App] Erro ao desconectar cliente Twitch:", error);
		}
	}

	if (hasDiscordClient()) {
		try {
			getDiscordClient().destroy();
			console.log("[App] Cliente Discord encerrado.");
		} catch (error) {
			console.error("[App] Erro ao encerrar cliente Discord:", error);
		}
	}

	try {
		await prisma.$disconnect();
		console.log("[App] Prisma desconectado.");
	} catch (error) {
		console.error("[App] Erro ao desconectar Prisma:", error);
	}

	process.exit(0);
}

process.on("SIGINT", () => {
	void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
	void shutdown("SIGTERM");
});

await bootstrap({ 
	meta: import.meta, 
	env,
	beforeLoad: async (client) => {
		setDiscordClient(client);
	}
});
