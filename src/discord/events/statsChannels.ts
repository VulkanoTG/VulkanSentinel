import { createEvent } from "#base";
import { startStatsChannelsUpdater } from "../../services/statsChannels.js";

createEvent({
  name: "start stats channels updater",
  event: "clientReady",
  once: true,
  async run() {
    try {
      await startStatsChannelsUpdater();
      console.log("[StatsChannels] Atualizador iniciado.");
    } catch (error) {
      console.error("[StatsChannels] Erro ao iniciar atualizador:", error);
    }
  },
});
