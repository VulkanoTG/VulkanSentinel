const CALLOUT_WIDTH_PX = 760;
const CALLOUT_MIN_VISIBLE_MS = 45000;
const CALLOUT_MAX_VISIBLE_MS = 60000;
const CALLOUT_EXIT_MS = 1800;
const CALLOUT_ENTRY_MS = 2000;
const CALLOUT_CONTENT_REVEAL_MS = 2400;
const CALLOUT_HOLD_STATE_DELAY_MS = 2520;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderSentinelCalloutOverlayPage() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml("Sentinela // Live Callout")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      color-scheme: dark;
      --overlay-width: ${CALLOUT_WIDTH_PX}px;
      --ink: rgba(6, 7, 10, 0.88);
      --panel: rgba(12, 13, 18, 0.66);
      --line: rgba(255, 146, 68, 0.42);
      --line-soft: rgba(255, 168, 92, 0.22);
      --lava: #ff7a2f;
      --flare: #ffd39d;
      --ember: #ff5d26;
      --text: rgba(248, 240, 230, 0.96);
      --text-soft: rgba(239, 224, 207, 0.78);
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
    .overlay-root {
      position: relative;
      width: 100vw;
      height: 100vh;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      isolation: isolate;
    }
    .callout {
      position: relative;
      width: min(var(--overlay-width), 100%);
      min-height: 240px;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      overflow: visible;
    }
    .callout.is-active,
    .callout.is-holding,
    .callout.is-exiting {
      opacity: 1;
      visibility: visible;
    }
    .frame {
      position: absolute;
      inset: 34px 0 0;
    }
    .frame::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 0;
      width: 56px;
      height: 2px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(255, 206, 150, 0.14), rgba(255, 211, 158, 0.98), rgba(255, 124, 40, 0.82));
      box-shadow:
        0 0 18px rgba(255, 170, 88, 0.4),
        0 0 32px rgba(255, 118, 42, 0.18);
      transform: translateX(-50%) scaleX(0.14);
      transform-origin: center;
      opacity: 0;
    }
    .callout.is-active .frame::before {
      animation: coreBarFlash 660ms cubic-bezier(.16,.86,.22,1) forwards;
    }
    .callout.is-exiting .frame::before {
      animation: coreBarReturn 520ms cubic-bezier(.68,.06,.82,.24) 760ms forwards;
    }
    .callout.is-holding .frame::before {
      opacity: 0;
      transform: translateX(-50%) scaleX(0.14);
    }
    .bar {
      position: absolute;
      top: 0;
      height: 2px;
      width: calc(50% - 28px);
      background: linear-gradient(90deg, rgba(255, 148, 72, 0), rgba(255, 204, 145, 0.96), rgba(255, 126, 42, 0.88));
      box-shadow: 0 0 18px rgba(255, 162, 86, 0.42);
      opacity: 0;
    }
    .bar-left {
      right: 50%;
      transform-origin: right center;
      transform: translateX(16px) scaleX(0.08);
    }
    .bar-right {
      left: 50%;
      transform-origin: left center;
      transform: translateX(-16px) scaleX(0.08);
    }
    .callout.is-active .bar-left,
    .callout.is-active .bar-right {
      animation: splitBar 880ms cubic-bezier(.16,.88,.18,1) 420ms forwards;
    }
    .callout.is-exiting .bar-left,
    .callout.is-exiting .bar-right {
      animation: splitBarCollapse 760ms cubic-bezier(.72,.06,.84,.24) 0ms forwards;
    }
    .callout.is-holding .bar-left,
    .callout.is-holding .bar-right {
      opacity: 1;
    }
    .callout.is-holding .bar-left {
      transform: translateX(0) scaleX(1);
    }
    .callout.is-holding .bar-right {
      transform: translateX(0) scaleX(1);
    }
    .side {
      position: absolute;
      top: 0;
      width: 2px;
      height: 116px;
      background: linear-gradient(180deg, rgba(255, 203, 146, 0.94), rgba(255, 112, 34, 0.72), rgba(255, 101, 30, 0.08));
      box-shadow: 0 0 14px rgba(255, 144, 56, 0.36);
      opacity: 0;
      transform: scaleY(0.08);
      transform-origin: top center;
    }
    .side-left {
      left: 0;
    }
    .side-right {
      right: 0;
    }
    .callout.is-active .side-left,
    .callout.is-active .side-right {
      animation: drawSide 520ms cubic-bezier(.2,.86,.2,1) 1120ms forwards;
    }
    .callout.is-exiting .side-left,
    .callout.is-exiting .side-right {
      animation: drawSideCollapse 420ms cubic-bezier(.62,.04,.84,.34) 420ms forwards;
    }
    .callout.is-holding .side-left,
    .callout.is-holding .side-right {
      opacity: 1;
      transform: scaleY(1);
    }
    .terminal {
      position: absolute;
      inset: 14px 22px auto;
      padding: 24px 32px 20px;
      background:
        linear-gradient(180deg, rgba(16, 18, 24, 0.72), rgba(6, 7, 10, 0.84)),
        linear-gradient(90deg, rgba(255, 132, 46, 0.08), transparent 12%, transparent 88%, rgba(255, 132, 46, 0.06));
      border: 1px solid rgba(255, 140, 58, 0.12);
      clip-path: polygon(0 24px, 24px 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 0 100%);
      backdrop-filter: blur(12px) saturate(132%);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.04),
        0 18px 38px rgba(0, 0, 0, 0.22);
      opacity: 0;
      transform: translateY(10px);
    }
    .terminal::before {
      content: "";
      position: absolute;
      inset: 0;
      clip-path: inherit;
      border: 1px solid rgba(255, 196, 132, 0.16);
      mask: linear-gradient(180deg, rgba(0,0,0,0.8), rgba(0,0,0,0.18));
      pointer-events: none;
    }
    .terminal::after {
      content: "";
      position: absolute;
      left: 26px;
      right: 26px;
      top: 17px;
      height: 1px;
      background: linear-gradient(90deg, rgba(255, 182, 106, 0), rgba(255, 182, 106, 0.78), rgba(255, 182, 106, 0));
      opacity: 0.8;
    }
    .callout.is-active .terminal {
      animation: terminalReveal 560ms cubic-bezier(.18,.84,.18,1) 1340ms forwards;
    }
    .callout.is-exiting .terminal {
      animation: terminalCollapse 520ms cubic-bezier(.68,.04,.82,.3) 0ms forwards;
    }
    .callout.is-holding .terminal {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-family: "Rajdhani", sans-serif;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255, 220, 182, 0.92);
      opacity: 0;
      transform: translateY(8px);
    }
    .eyebrow::before {
      content: "";
      width: 42px;
      height: 2px;
      background: linear-gradient(90deg, rgba(255, 210, 162, 0.92), rgba(255, 123, 40, 0));
      box-shadow: 0 0 14px rgba(255, 167, 95, 0.38);
    }
    .message {
      margin: 14px 0 0;
      max-width: 28ch;
      font-family: "Rajdhani", sans-serif;
      font-size: clamp(30px, 3.35vw, 42px);
      font-weight: 700;
      line-height: 1.02;
      letter-spacing: -0.03em;
      color: var(--text);
      text-shadow:
        0 0 24px rgba(255, 122, 47, 0.12),
        0 0 44px rgba(0, 0, 0, 0.14);
      opacity: 0;
      transform: translateY(10px);
    }
    .meta {
      margin-top: 16px;
      max-width: 40ch;
      font-size: 24px;
      line-height: 1.3;
      letter-spacing: 0.01em;
      color: rgba(244, 232, 218, 0.9);
      opacity: 0;
      transform: translateY(8px);
    }
    .callout.is-active .eyebrow,
    .callout.is-active .message,
    .callout.is-active .meta {
      animation: contentReveal 420ms ease 1640ms forwards;
    }
    .callout.is-active .message {
      animation-delay: 1710ms;
    }
    .callout.is-active .meta {
      animation-delay: 1780ms;
    }
    .callout.is-exiting .eyebrow,
    .callout.is-exiting .message,
    .callout.is-exiting .meta {
      animation: contentExit 340ms cubic-bezier(.4,0,.2,1) forwards;
    }
    .callout.is-holding .eyebrow,
    .callout.is-holding .message,
    .callout.is-holding .meta {
      opacity: 1;
      transform: translateY(0);
    }
    @keyframes coreBarFlash {
      0% {
        opacity: 0;
        transform: translateX(-50%) scaleX(0.14);
      }
      22% {
        opacity: 1;
        transform: translateX(-50%) scaleX(1);
      }
      100% {
        opacity: 0;
        transform: translateX(-50%) scaleX(1.12);
      }
    }
    @keyframes splitBar {
      0% {
        opacity: 0;
        transform: translateX(0) scaleX(0.12);
      }
      100% {
        opacity: 1;
        transform: translateX(0) scaleX(1);
      }
    }
    @keyframes splitBarCollapse {
      0% {
        opacity: 1;
        transform: translateX(0) scaleX(1);
      }
      52% {
        opacity: 1;
        transform: translateX(0) scaleX(0.62);
      }
      100% {
        opacity: 0;
        transform: translateX(0) scaleX(0.12);
      }
    }
    @keyframes coreBarReturn {
      0% {
        opacity: 0;
        transform: translateX(-50%) scaleX(1.08);
      }
      30% {
        opacity: 1;
        transform: translateX(-50%) scaleX(0.88);
      }
      100% {
        opacity: 0;
        transform: translateX(-50%) scaleX(0.14);
      }
    }
    @keyframes drawSide {
      0% {
        opacity: 0;
        transform: scaleY(0.08);
      }
      100% {
        opacity: 1;
        transform: scaleY(1);
      }
    }
    @keyframes drawSideCollapse {
      0% {
        opacity: 1;
        transform: scaleY(1);
      }
      36% {
        opacity: 0.82;
        transform: scaleY(0.68);
      }
      100% {
        opacity: 0;
        transform: scaleY(0.1);
      }
    }
    @keyframes terminalReveal {
      0% {
        opacity: 0;
        transform: translateY(14px);
        filter: blur(8px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
      }
    }
    @keyframes terminalCollapse {
      0% {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
      }
      46% {
        opacity: 0.82;
        transform: translateY(8px) scaleY(0.95);
        filter: blur(2px);
      }
      100% {
        opacity: 0;
        transform: translateY(18px) scaleY(0.82);
        filter: blur(8px);
      }
    }
    @keyframes contentReveal {
      0% {
        opacity: 0;
        transform: translateY(10px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes contentExit {
      0% {
        opacity: 1;
        transform: translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateY(-12px);
      }
    }
    @media (max-width: 780px) {
      .overlay-root {
        padding: 14px;
      }
      .callout {
        min-height: 268px;
      }
      .terminal {
        inset: 14px 10px 0;
        padding: 20px 20px 18px;
      }
      .message {
        max-width: none;
        font-size: clamp(24px, 7.2vw, 36px);
      }
      .eyebrow {
        font-size: 18px;
      }
      .meta {
        max-width: none;
        font-size: 20px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .callout.is-active .frame::before,
      .callout.is-active .bar-left,
      .callout.is-active .bar-right,
      .callout.is-active .side-left,
      .callout.is-active .side-right,
      .callout.is-active .terminal,
      .callout.is-active .eyebrow,
      .callout.is-active .message,
      .callout.is-active .meta,
      .callout.is-holding .frame::before,
      .callout.is-holding .bar-left,
      .callout.is-holding .bar-right,
      .callout.is-holding .side-left,
      .callout.is-holding .side-right,
      .callout.is-holding .terminal,
      .callout.is-holding .eyebrow,
      .callout.is-holding .message,
      .callout.is-holding .meta,
      .callout.is-exiting .frame::before,
      .callout.is-exiting .terminal,
      .callout.is-exiting .eyebrow,
      .callout.is-exiting .message,
      .callout.is-exiting .meta {
        animation: none !important;
      }
      .callout,
      .callout.is-active,
      .callout.is-holding,
      .callout.is-exiting {
        opacity: 1;
        visibility: visible;
      }
    }
  </style>
</head>
<body>
  <main class="overlay-root">
    <section class="callout" id="callout" aria-live="polite" aria-label="${escapeHtml("Overlay de aviso da Sentinela")}">
      <div class="frame" aria-hidden="true">
        <span class="bar bar-left"></span>
        <span class="bar bar-right"></span>
        <span class="side side-left"></span>
        <span class="side side-right"></span>
      </div>
      <article class="terminal">
        <div class="eyebrow" id="callout-label">SENTINELA ONLINE</div>
        <h1 class="message" id="callout-message">${escapeHtml("Vincule-se a Sentinela para participar das interacoes da live.")}</h1>
        <p class="meta" id="callout-meta">${escapeHtml("Use o link da comunidade para conectar Twitch e Discord e liberar os atalhos do chat.")}</p>
      </article>
    </section>
  </main>
  <script>
    (() => {
      const MIN_VISIBLE_MS = ${CALLOUT_MIN_VISIBLE_MS};
      const MAX_VISIBLE_MS = ${CALLOUT_MAX_VISIBLE_MS};
      const EXIT_DURATION_MS = ${CALLOUT_EXIT_MS};
      const ENTRY_DURATION_MS = ${CALLOUT_ENTRY_MS};
      const CONTENT_REVEAL_MS = ${CALLOUT_CONTENT_REVEAL_MS};
      const HOLD_STATE_DELAY_MS = ${CALLOUT_HOLD_STATE_DELAY_MS};
      const params = new URLSearchParams(window.location.search);
      const callout = document.getElementById("callout");
      const labelNode = document.getElementById("callout-label");
      const messageNode = document.getElementById("callout-message");
      const metaNode = document.getElementById("callout-meta");
      const queue = [];
      let activeItem = null;
      let activeTimer = null;
      let exitTimer = null;
      function randomBetween(min, max) {
        return Math.round(min + Math.random() * Math.max(0, max - min));
      }

      function readNumberParam(name, fallback) {
        const raw = Number(params.get(name));
        return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
      }

      const autoplayEnabled = params.get("autoplay") === "1";
      const visibleMinMs = readNumberParam("visibleMinMs", MIN_VISIBLE_MS);
      const visibleMaxMs = readNumberParam("visibleMaxMs", MAX_VISIBLE_MS);

      function buildLabel(payload) {
        if (payload.title) {
          return payload.title;
        }
        if (payload.tone === "reward") {
          return "CHAMADO DE RECOMPENSA";
        }
        if (payload.tone === "event") {
          return "EVENTO DA LIVE";
        }
        return "TERMINAL DA SENTINELA";
      }

      function buildMeta(payload) {
        return payload.detail || "Conecte sua conta para liberar interacoes, atalhos e participacao nas dinamicas da live.";
      }

      function clearTimers() {
        if (activeTimer) {
          window.clearTimeout(activeTimer);
          activeTimer = null;
        }
        if (exitTimer) {
          window.clearTimeout(exitTimer);
          exitTimer = null;
        }
      }

      function resetState() {
        callout.classList.remove("is-active", "is-holding", "is-exiting");
      }

      function finishCycle() {
        activeItem = null;
        resetState();
        if (queue.length) {
          startNext();
        }
      }

      function startExit() {
        if (!activeItem) {
          return;
        }

        callout.classList.remove("is-active", "is-holding");
        void callout.offsetWidth;
        callout.classList.add("is-exiting");

        exitTimer = window.setTimeout(() => {
          finishCycle();
        }, EXIT_DURATION_MS);
      }

      function showPayload(payload) {
        labelNode.textContent = buildLabel(payload);
        messageNode.textContent = payload.message;
        metaNode.textContent = buildMeta(payload);

        resetState();
        void callout.offsetWidth;
        callout.classList.add("is-active");

        window.setTimeout(() => {
          if (!activeItem || activeItem !== payload) {
            return;
          }

          callout.classList.add("is-holding");
        }, HOLD_STATE_DELAY_MS);

        const visibleForMs = payload.visibleForMs || randomBetween(visibleMinMs, visibleMaxMs);
        activeTimer = window.setTimeout(() => {
          startExit();
        }, Math.max(ENTRY_DURATION_MS, CONTENT_REVEAL_MS) + visibleForMs);
      }

      function startNext() {
        if (activeItem || !queue.length) {
          return;
        }

        activeItem = queue.shift();
        clearTimers();
        showPayload(activeItem);
      }

      function enqueuePayload(payload) {
        if (activeItem) {
          queue.splice(0, queue.length, payload);
        } else {
          queue.push(payload);
        }

        startNext();
      }

      function normalizePayload(raw) {
        if (!raw || typeof raw.message !== "string") {
          return null;
        }

        return {
          title: typeof raw.title === "string" ? raw.title.trim() : "",
          message: raw.message.trim(),
          detail: typeof raw.detail === "string" ? raw.detail.trim() : "",
          visibleForMs: typeof raw.visibleForMs === "number" ? raw.visibleForMs : null,
          tone: raw.tone === "info" || raw.tone === "reward" || raw.tone === "event"
            ? raw.tone
            : "info"
        };
      }

      function connect() {
        const events = new EventSource("/api/overlays/sentinel/callout/stream");

        events.addEventListener("sentinel-callout", (event) => {
          try {
            const payload = normalizePayload(JSON.parse(event.data));
            if (!payload || !payload.message) {
              return;
            }

            enqueuePayload(payload);
          } catch (error) {
            console.error("[SentinelCallout] Falha ao processar payload:", error);
          }
        });

        events.onerror = () => {
          events.close();
          window.setTimeout(connect, 1500);
        };
      }

      connect();
      if (autoplayEnabled) {
        enqueuePayload({
          title: "SENTINELA ONLINE",
          message: "Vincule-se a Sentinela para participar das interacoes da live.",
          detail: "Conecte Twitch e Discord para liberar os atalhos da comunidade e entrar nas dinamicas da transmissao."
        });
      }
    })();
  </script>
</body>
</html>`;
}
