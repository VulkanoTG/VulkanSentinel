const OVERLAY_WIDTH_PX = 400;
const MAX_VISIBLE_MESSAGES = 8;
const MESSAGE_LIFETIME_MS = 10500;
const IDLE_CLEAR_MS = 12000;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderVulkanTerminalOverlayPage() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml("OCCHAT // Vulkan Terminal")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: dark;
      --overlay-width: ${OVERLAY_WIDTH_PX}px;
      --line: rgba(255, 173, 92, 0.2);
      --panel: rgba(9, 10, 14, 0.24);
      --panel-strong: rgba(14, 15, 20, 0.44);
      --text: rgba(244, 236, 228, 0.96);
      --text-soft: rgba(240, 226, 212, 0.78);
      --text-dim: rgba(240, 226, 212, 0.56);
      --lava: #ff7a2f;
      --amber: #ffba59;
      --ember: #ff5126;
      --thermal: #ff4a36;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      width: 100%;
      min-height: 100%;
      overflow: hidden;
      background: transparent;
      font-family: "Space Grotesk", "Segoe UI", sans-serif;
      color: var(--text);
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(20rem 12rem at 0% 100%, rgba(255, 83, 24, 0.15), transparent 65%),
        radial-gradient(18rem 10rem at 8% 92%, rgba(255, 180, 90, 0.08), transparent 70%);
      filter: blur(12px);
      opacity: 0.85;
    }
    .overlay-root {
      position: relative;
      width: min(var(--overlay-width), 100vw);
      height: 100vh;
      padding: 16px 14px 18px;
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      isolation: isolate;
    }
    .smoke-layer,
    .ember-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .smoke-layer::before,
    .smoke-layer::after {
      content: "";
      position: absolute;
      inset: auto 0 0 -8%;
      height: 55%;
      background:
        radial-gradient(circle at 20% 100%, rgba(255, 120, 54, 0.08), transparent 30%),
        radial-gradient(circle at 62% 100%, rgba(255, 255, 255, 0.04), transparent 28%),
        radial-gradient(circle at 86% 100%, rgba(255, 92, 28, 0.06), transparent 24%);
      filter: blur(30px);
      animation: smokeLift 16s linear infinite;
      opacity: 0.42;
    }
    .smoke-layer::after {
      animation-duration: 22s;
      animation-direction: reverse;
      opacity: 0.22;
      transform: translateY(8%);
    }
    .ember {
      position: absolute;
      bottom: -8%;
      width: 4px;
      height: 4px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(255, 211, 154, 0.95), rgba(255, 97, 31, 0.55) 55%, transparent 72%);
      box-shadow: 0 0 14px rgba(255, 102, 34, 0.34);
      animation: emberFloat linear infinite;
    }
    .chat-stack {
      position: relative;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 10px;
    }
    .message {
      position: relative;
      overflow: visible;
      padding: 8px 0 10px 14px;
      background: transparent;
      transform-origin: bottom left;
      animation:
        messageEnter 520ms cubic-bezier(.18,.78,.18,1),
        heatPulse 4.4s ease-in-out infinite;
    }
    .message::before {
      content: "";
      position: absolute;
      left: -36px;
      right: -18px;
      top: -14px;
      bottom: -12px;
      background:
        radial-gradient(ellipse at 12% 52%, color-mix(in srgb, var(--role) 20%, transparent), transparent 48%),
        radial-gradient(ellipse at 28% 50%, rgba(255,255,255,0.055), transparent 36%),
        radial-gradient(ellipse at 54% 64%, color-mix(in srgb, var(--role) 24%, transparent), transparent 42%);
      filter: blur(18px);
      opacity: 0.92;
      pointer-events: none;
      z-index: 0;
    }
    .message::after {
      content: "";
      position: absolute;
      left: 0;
      top: 3px;
      bottom: 4px;
      width: 2px;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255,255,255,0.05), color-mix(in srgb, var(--role) 92%, white 8%), rgba(255,255,255,0.02));
      box-shadow:
        0 0 12px color-mix(in srgb, var(--role) 45%, transparent),
        0 0 26px color-mix(in srgb, var(--role) 24%, transparent);
      opacity: 0.9;
    }
    .message.role-default {
      --role: var(--lava);
      --role-soft: rgba(255, 122, 47, 0.34);
    }
    .message.role-subscriber {
      --role: var(--amber);
      --role-soft: rgba(255, 186, 89, 0.34);
    }
    .message.role-moderator {
      --role: var(--thermal);
      --role-soft: rgba(255, 74, 54, 0.36);
    }
    .message.tone-engagement {
      --role: #9f68ff;
      --role-soft: rgba(159, 104, 255, 0.34);
    }
    .message.tone-reward {
      --role: #ffe27a;
      --role-soft: rgba(255, 226, 122, 0.28);
    }
    .message.tone-event {
      --role: #7fd6ff;
      --role-soft: rgba(127, 214, 255, 0.3);
    }
    .message.tone-spotify {
      --role: #1ed760;
      --role-soft: rgba(30, 215, 96, 0.3);
    }
    .message.is-fading {
      animation:
        emberDissolve 900ms ease forwards,
        heatPulse 2s ease-in-out infinite;
    }
    .message-shell {
      position: relative;
      z-index: 1;
      padding: 8px 14px 9px 10px;
      border-radius: 0 18px 18px 0;
      background:
        linear-gradient(
          90deg,
          color-mix(in srgb, var(--role) 6%, rgba(8, 9, 12, 0.08)),
          color-mix(in srgb, var(--role) 10%, rgba(8, 9, 12, 0.26)) 18%,
          color-mix(in srgb, var(--role) 6%, rgba(8, 9, 12, 0.14)) 72%,
          rgba(8, 9, 12, 0)
        );
      backdrop-filter: blur(10px) saturate(120%);
      mask-image: linear-gradient(90deg, rgba(0,0,0,0.98), rgba(0,0,0,0.96) 68%, rgba(0,0,0,0.12) 100%);
    }
    .message-shell::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      width: 108px;
      height: 1px;
      background: linear-gradient(90deg, color-mix(in srgb, var(--role) 84%, white 16%), transparent);
      box-shadow: 0 0 16px color-mix(in srgb, var(--role) 24%, transparent);
      opacity: 0.85;
    }
    .message-shell::after {
      content: "";
      position: absolute;
      left: 0;
      bottom: 1px;
      width: 76px;
      height: 1px;
      background: linear-gradient(90deg, rgba(255,255,255,0.05), transparent);
      opacity: 0.5;
    }
    .message-head {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0;
      min-width: 0;
      z-index: 1;
    }
    .username {
      min-width: 0;
      font-family: "Rajdhani", sans-serif;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: color-mix(in srgb, white 58%, var(--role) 42%);
      text-shadow: 0 0 16px var(--role-soft);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .badge {
      flex: 0 0 auto;
      padding: 3px 7px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--role) 32%, transparent);
      background: color-mix(in srgb, var(--role) 9%, rgba(0,0,0,0.1));
      color: color-mix(in srgb, white 72%, var(--role) 28%);
      font-family: "Rajdhani", sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      box-shadow: 0 0 18px color-mix(in srgb, var(--role) 26%, transparent);
    }
    .body {
      position: relative;
      z-index: 1;
      margin-top: 6px;
      color: var(--text-soft);
      font-size: 0.95rem;
      line-height: 1.45;
      text-wrap: pretty;
      text-shadow: 0 0 18px rgba(0, 0, 0, 0.12);
    }
    .message-idle {
      opacity: 0;
      transform: translateY(18px);
    }
    @keyframes messageEnter {
      0% {
        opacity: 0;
        transform: translateY(22px) scale(0.96);
        filter: blur(8px);
      }
      60% {
        opacity: 1;
        transform: translateY(-2px) scale(1);
        filter: blur(0);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes emberDissolve {
      0% {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0);
      }
      100% {
        opacity: 0;
        transform: translateY(-18px) scale(0.97);
        filter: blur(7px);
      }
    }
    @keyframes heatPulse {
      0%, 100% {
        filter: saturate(100%);
      }
      50% {
        filter: saturate(118%);
      }
    }
    @keyframes emberFloat {
      0% {
        opacity: 0;
        transform: translate3d(0, 0, 0) scale(0.7);
      }
      10% {
        opacity: 0.9;
      }
      100% {
        opacity: 0;
        transform: translate3d(var(--drift-x), -78vh, 0) scale(1.15);
      }
    }
    @keyframes smokeLift {
      0% {
        transform: translate3d(-2%, 10%, 0) scale(1);
      }
      50% {
        transform: translate3d(4%, -4%, 0) scale(1.04);
      }
      100% {
        transform: translate3d(-2%, -12%, 0) scale(1);
      }
    }
    @media (max-width: 480px) {
      :root {
        --overlay-width: 100vw;
      }
      .overlay-root {
        padding: 10px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .message,
      .message.is-fading,
      .smoke-layer::before,
      .smoke-layer::after,
      .ember {
        animation: none !important;
      }
    }
  </style>
</head>
<body>
  <main class="overlay-root">
    <div class="smoke-layer" aria-hidden="true"></div>
    <div class="ember-layer" id="ember-layer" aria-hidden="true"></div>
    <section class="chat-stack" id="chat-stack" aria-live="polite" aria-label="${escapeHtml("Chat overlay Vulkan Terminal")}"></section>
  </main>
  <script>
    (() => {
      const MAX_VISIBLE_MESSAGES = ${MAX_VISIBLE_MESSAGES};
      const MESSAGE_LIFETIME_MS = ${MESSAGE_LIFETIME_MS};
      const IDLE_CLEAR_MS = ${IDLE_CLEAR_MS};
      const stack = document.getElementById("chat-stack");
      const emberLayer = document.getElementById("ember-layer");
      const activeMessages = [];
      let idleTimer = null;

      function escapeHtml(value) {
        return value
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function seedEmbers() {
        for (let index = 0; index < 18; index += 1) {
          const ember = document.createElement("span");
          ember.className = "ember";
          ember.style.left = (Math.random() * 100).toFixed(2) + "%";
          ember.style.animationDuration = (7 + Math.random() * 9).toFixed(2) + "s";
          ember.style.animationDelay = (-Math.random() * 12).toFixed(2) + "s";
          ember.style.setProperty("--drift-x", ((Math.random() * 26) - 13).toFixed(2) + "px");
          emberLayer.appendChild(ember);
        }
      }

      function restartIdleTimer() {
        if (idleTimer) {
          window.clearTimeout(idleTimer);
        }

        idleTimer = window.setTimeout(() => {
          clearAllMessages();
        }, IDLE_CLEAR_MS);
      }

      function removeTrackedMessage(id) {
        const index = activeMessages.findIndex((entry) => entry.id === id);
        if (index >= 0) {
          activeMessages.splice(index, 1);
        }
      }

      function fadeOutMessage(entry) {
        if (!entry || entry.isFading) {
          return;
        }

        entry.isFading = true;
        entry.node.classList.add("is-fading");

        window.setTimeout(() => {
          entry.node.remove();
          removeTrackedMessage(entry.id);
        }, 900);
      }

      function clearAllMessages() {
        const snapshot = [...activeMessages];
        for (const entry of snapshot) {
          fadeOutMessage(entry);
        }
      }

      function enforceMessageCap() {
        while (activeMessages.length > MAX_VISIBLE_MESSAGES) {
          fadeOutMessage(activeMessages[0]);
        }
      }

      function renderMessage(message) {
        return [
          '<article class="message role-' + escapeHtml(message.role) + ' tone-' + escapeHtml(message.tone || "chat") + '" data-message-id="' + escapeHtml(message.id) + '">',
            '<div class="message-shell">',
              '<div class="message-head">',
                '<span class="username">' + escapeHtml(message.username) + '</span>',
              '</div>',
              '<div class="body">' + escapeHtml(message.message) + '</div>',
            '</div>',
          '</article>'
        ].join("");
      }

      function pushMessage(message) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = renderMessage(message);
        const node = wrapper.firstElementChild;
        if (!node) {
          return;
        }

        stack.appendChild(node);

        const entry = {
          id: message.id,
          node,
          isFading: false
        };

        activeMessages.push(entry);
        enforceMessageCap();
        restartIdleTimer();

        window.setTimeout(() => {
          fadeOutMessage(entry);
        }, MESSAGE_LIFETIME_MS);
      }

      function connect() {
        const events = new EventSource("/api/overlays/chat/stream");

        events.addEventListener("chat-message", (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (!payload || typeof payload.message !== "string" || typeof payload.username !== "string") {
              return;
            }

            pushMessage(payload);
          } catch (error) {
            console.error("[Overlay] Falha ao processar mensagem do chat:", error);
          }
        });

        events.onerror = () => {
          events.close();
          window.setTimeout(connect, 1500);
        };
      }

      seedEmbers();
      connect();
      restartIdleTimer();
    })();
  </script>
</body>
</html>`;
}
