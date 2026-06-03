import { createEvent } from "#base";
import { ensureTicketPanelMessage, pruneTicketArchives } from "../../services/tickets.js";

createEvent({
  name: "ensure ticket panel",
  event: "clientReady",
  once: true,
  async run() {
    try {
      await ensureTicketPanelMessage();
      await pruneTicketArchives();
      console.log("[Tickets] Painel de tickets verificado.");
    } catch (error) {
      console.error("[Tickets] Erro ao garantir painel de tickets:", error);
    }
  },
});
