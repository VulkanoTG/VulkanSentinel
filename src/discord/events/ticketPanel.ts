import { createEvent } from "#base";
import { ensureTicketPanelMessage } from "../../services/tickets.js";

createEvent({
  name: "ensure ticket panel",
  event: "clientReady",
  once: true,
  async run() {
    try {
      await ensureTicketPanelMessage();
      console.log("[Tickets] Painel de tickets verificado.");
    } catch (error) {
      console.error("[Tickets] Erro ao garantir painel de tickets:", error);
    }
  },
});
