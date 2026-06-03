const OVERLAY_WIDTH_PX = 180;
const ENTRY_DURATION_MS = 560;
const EXIT_DURATION_MS = 480;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderMouseAxesInvertOverlayPage() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml("Sentinela // Inversao dos Eixos do Mouse")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=swap_vert" />
  <style>
    :root {
      color-scheme: dark;
      --overlay-width: ${OVERLAY_WIDTH_PX}px;
      --ink: rgba(6, 7, 10, 0.88);
      --panel: rgba(12, 13, 18, 0.7);
      --line: rgba(255, 146, 68, 0.34);
      --line-soft: rgba(255, 168, 92, 0.18);
      --lava: #ff7a2f;
      --flare: #ffd39d;
      --text: rgba(248, 240, 230, 0.96);
      --text-soft: rgba(239, 224, 207, 0.72);
    }
    * { box-sizing: border-box; }
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
      width: 100vw;
      height: 100vh;
      padding: 22px;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      pointer-events: none;
    }
    .callout {
      position: relative;
      width: min(var(--overlay-width), calc(100vw - 24px));
      min-height: 156px;
      opacity: 0;
      visibility: hidden;
    }
    .callout.is-active,
    .callout.is-holding,
    .callout.is-exiting {
      opacity: 1;
      visibility: visible;
    }
    .frame {
      position: absolute;
      inset: 22px 0 0;
    }
    .frame::before {
      content: "";
      position: absolute;
      left: 20px;
      right: 20px;
      top: 0;
      height: 1px;
      background: linear-gradient(90deg, rgba(255, 145, 70, 0), rgba(255, 211, 158, 0.96), rgba(255, 145, 70, 0));
      opacity: 0;
      transform: scaleX(0.24);
      transform-origin: center;
    }
    .callout.is-active .frame::before { animation: lineReveal ${ENTRY_DURATION_MS}ms cubic-bezier(.16,.86,.22,1) forwards; }
    .callout.is-holding .frame::before {
      opacity: 1;
      transform: scaleX(1);
    }
    .callout.is-exiting .frame::before { animation: lineExit ${EXIT_DURATION_MS}ms cubic-bezier(.68,.06,.82,.24) forwards; }
    .panel {
      position: absolute;
      inset: 14px 0 auto;
      padding: 18px 16px 16px;
      background:
        linear-gradient(180deg, rgba(16, 18, 24, 0.74), rgba(6, 7, 10, 0.86)),
        linear-gradient(90deg, rgba(255, 132, 46, 0.08), transparent 14%, transparent 86%, rgba(255, 132, 46, 0.06));
      border: 1px solid rgba(255, 140, 58, 0.12);
      clip-path: polygon(0 18px, 18px 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
      backdrop-filter: blur(12px) saturate(130%);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.04),
        0 18px 38px rgba(0, 0, 0, 0.22);
      opacity: 0;
      transform: translateY(-16px) scale(0.96);
    }
    .panel::before {
      content: "";
      position: absolute;
      inset: 0;
      clip-path: inherit;
      border: 1px solid rgba(255, 196, 132, 0.14);
      mask: linear-gradient(180deg, rgba(0,0,0,0.8), rgba(0,0,0,0.18));
      pointer-events: none;
    }
    .panel::after {
      content: "";
      position: absolute;
      left: 20px;
      right: 20px;
      top: 14px;
      height: 1px;
      background: linear-gradient(90deg, rgba(255, 182, 106, 0), rgba(255, 182, 106, 0.74), rgba(255, 182, 106, 0));
      opacity: 0.7;
    }
    .callout.is-active .panel { animation: panelReveal ${ENTRY_DURATION_MS}ms cubic-bezier(.18,.84,.18,1) forwards; }
    .callout.is-holding .panel {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .callout.is-exiting .panel { animation: panelExit ${EXIT_DURATION_MS}ms cubic-bezier(.68,.04,.82,.3) forwards; }
    .layout {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .icon-shell {
      width: 66px;
      height: 66px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      border: 1px solid rgba(255, 180, 114, 0.18);
      background: radial-gradient(circle at 50% 35%, rgba(255, 172, 102, 0.16), rgba(255, 122, 47, 0.03) 64%);
      box-shadow: inset 0 0 20px rgba(255, 128, 49, 0.06);
      opacity: 0;
      transform: translateY(10px);
    }
    .callout.is-active .icon-shell,
    .callout.is-active .timer { animation: contentReveal 360ms ease 150ms forwards; }
    .callout.is-holding .icon-shell,
    .callout.is-holding .timer {
      opacity: 1;
      transform: translateY(0);
    }
    .callout.is-exiting .icon-shell,
    .callout.is-exiting .timer { animation: contentExit 280ms cubic-bezier(.4,0,.2,1) forwards; }
    .icon {
      font-family: "Material Symbols Outlined";
      font-size: 42px;
      font-weight: 400;
      font-style: normal;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      color: var(--flare);
      font-variation-settings:
        "FILL" 0,
        "wght" 500,
        "GRAD" 0,
        "opsz" 48;
      filter: drop-shadow(0 0 14px rgba(255, 149, 75, 0.2));
    }
    .timer {
      margin-top: 2px;
      text-align: center;
      opacity: 0;
      transform: translateY(10px);
    }
    .timer-value {
      display: block;
      font-family: "Rajdhani", sans-serif;
      font-size: 36px;
      font-weight: 700;
      line-height: 1;
      color: var(--flare);
      text-shadow: 0 0 18px rgba(255, 136, 56, 0.16);
      font-variant-numeric: tabular-nums;
    }
    @keyframes lineReveal {
      0% { opacity: 0; transform: scaleX(0.24); }
      100% { opacity: 1; transform: scaleX(1); }
    }
    @keyframes lineExit {
      0% { opacity: 1; transform: scaleX(1); }
      100% { opacity: 0; transform: scaleX(0.24); }
    }
    @keyframes panelReveal {
      0% { opacity: 0; transform: translateY(-16px) scale(0.96); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes panelExit {
      0% { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-12px) scale(0.95); }
    }
    @keyframes contentReveal {
      0% { opacity: 0; transform: translateY(10px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes contentExit {
      0% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-8px); }
    }
    @media (max-width: 680px) {
      .overlay-root {
        padding: 12px;
        justify-content: center;
      }
      .callout { min-height: 146px; }
      .panel { padding: 16px 14px 14px; }
      .icon-shell {
        width: 54px;
        height: 54px;
      }
      .icon {
        width: 36px;
        height: 36px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .callout.is-active .frame::before,
      .callout.is-active .panel,
      .callout.is-active .icon-shell,
      .callout.is-active .timer,
      .callout.is-exiting .frame::before,
      .callout.is-exiting .panel,
      .callout.is-exiting .icon-shell,
      .callout.is-exiting .timer { animation: none !important; }
      .callout.is-active,
      .callout.is-holding,
      .callout.is-exiting {
        opacity: 1;
        visibility: visible;
      }
      .callout.is-active .panel,
      .callout.is-holding .panel,
      .callout.is-exiting .panel,
      .callout.is-active .icon-shell,
      .callout.is-holding .icon-shell,
      .callout.is-exiting .icon-shell,
      .callout.is-active .timer,
      .callout.is-holding .timer,
      .callout.is-exiting .timer,
      .callout.is-active .frame::before,
      .callout.is-holding .frame::before,
      .callout.is-exiting .frame::before {
        opacity: 1;
        transform: none;
      }
    }
  </style>
</head>
<body>
  <main class="overlay-root">
    <section class="callout" id="overlay" aria-live="polite" aria-label="${escapeHtml("Overlay de inversao dos eixos do mouse")}">
      <div class="frame" aria-hidden="true"></div>
      <article class="panel">
        <div class="layout">
          <div class="icon-shell" aria-hidden="true">
            <span class="icon">swap_vert</span>
          </div>
          <div class="timer">
          <strong class="timer-value" id="timer">00:00</strong>
          </div>
        </div>
      </article>
    </section>
  </main>
  <script>
    (() => {
      const ENTRY_DURATION_MS = ${ENTRY_DURATION_MS};
      const EXIT_DURATION_MS = ${EXIT_DURATION_MS};
      const overlay = document.getElementById("overlay");
      const timerNode = document.getElementById("timer");
      const params = new URLSearchParams(window.location.search);
      const autoplayEnabled = params.get("autoplay") === "1";
      const audioEnabled = params.get("sound") !== "0";
      const pageLoadTimestamp = Date.now();
      let activeState = null;
      let renderTimer = null;
      let holdTimer = null;
      let exitTimer = null;
      let audioContext = null;
      let streamInitialized = false;

      function playStartChime() {
        if (!audioEnabled) {
          return;
        }

        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
          return;
        }

        if (!audioContext) {
          audioContext = new AudioContextCtor();
        }

        if (audioContext.state === "suspended") {
          audioContext.resume().catch(() => {});
        }

        const startAt = audioContext.currentTime + 0.01;
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(0.12, startAt + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.34);
        gainNode.connect(audioContext.destination);

        const toneA = audioContext.createOscillator();
        toneA.type = "triangle";
        toneA.frequency.setValueAtTime(620, startAt);
        toneA.frequency.exponentialRampToValueAtTime(860, startAt + 0.18);
        toneA.connect(gainNode);

        const toneB = audioContext.createOscillator();
        toneB.type = "sine";
        toneB.frequency.setValueAtTime(940, startAt + 0.06);
        toneB.frequency.exponentialRampToValueAtTime(1180, startAt + 0.24);
        toneB.connect(gainNode);

        toneA.start(startAt);
        toneA.stop(startAt + 0.34);
        toneB.start(startAt + 0.06);
        toneB.stop(startAt + 0.24);
      }

      function formatRemaining(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
      }

      function clearTimers() {
        if (renderTimer) {
          window.clearInterval(renderTimer);
          renderTimer = null;
        }
        if (holdTimer) {
          window.clearTimeout(holdTimer);
          holdTimer = null;
        }
        if (exitTimer) {
          window.clearTimeout(exitTimer);
          exitTimer = null;
        }
      }

      function resetClasses() {
        overlay.classList.remove("is-active", "is-holding", "is-exiting");
      }

      function finishHide() {
        activeState = null;
        clearTimers();
        resetClasses();
        timerNode.textContent = "00:00";
      }

      function startExit() {
        clearTimers();
        overlay.classList.remove("is-active", "is-holding");
        void overlay.offsetWidth;
        overlay.classList.add("is-exiting");
        exitTimer = window.setTimeout(() => {
          finishHide();
        }, EXIT_DURATION_MS);
      }

      function startTicker() {
        if (renderTimer) {
          window.clearInterval(renderTimer);
        }

        renderTimer = window.setInterval(() => {
          if (!activeState || !activeState.expiresAt) {
            startExit();
            return;
          }

          const remainingMs = new Date(activeState.expiresAt).getTime() - Date.now();
          if (remainingMs <= 0) {
            timerNode.textContent = "00:00";
            startExit();
            return;
          }

          timerNode.textContent = formatRemaining(remainingMs);
        }, 250);
      }

      function showPayload(payload) {
        activeState = payload;
        timerNode.textContent = formatRemaining(new Date(payload.expiresAt).getTime() - Date.now());

        clearTimers();
        resetClasses();
        void overlay.offsetWidth;
        overlay.classList.add("is-active");

        holdTimer = window.setTimeout(() => {
          if (!activeState || activeState !== payload) {
            return;
          }
          overlay.classList.add("is-holding");
        }, ENTRY_DURATION_MS);

        startTicker();
      }

      function isSameSession(payload) {
        return Boolean(
          activeState &&
          payload &&
          activeState.startedAt === payload.startedAt &&
          activeState.expiresAt === payload.expiresAt
        );
      }

      function applyPayload(payload) {
        if (!payload || payload.active !== true || !payload.expiresAt) {
          if (activeState) {
            startExit();
          } else {
            finishHide();
          }
          return;
        }

        if (isSameSession(payload)) {
          activeState = payload;
          timerNode.textContent = formatRemaining(new Date(payload.expiresAt).getTime() - Date.now());
          if (!renderTimer) {
            startTicker();
          }
          return;
        }

        const shouldPlayStartChime =
          !activeState ||
          activeState.startedAt !== payload.startedAt ||
          activeState.expiresAt !== payload.expiresAt;

        if (shouldPlayStartChime) {
          playStartChime();
        }

        showPayload(payload);
      }

      function normalizePayload(raw) {
        if (!raw || typeof raw !== "object") {
          return null;
        }

        return {
          id: typeof raw.id === "string" ? raw.id.trim() : null,
          active: raw.active === true,
          requesterName: typeof raw.requesterName === "string" ? raw.requesterName.trim() : null,
          startedAt: typeof raw.startedAt === "string" ? raw.startedAt.trim() : null,
          expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt.trim() : null,
          timestamp: typeof raw.timestamp === "number" ? raw.timestamp : 0,
        };
      }

      function connect() {
        const events = new EventSource("/api/overlays/mouse-axes-invert/stream");

        events.addEventListener("mouse-axes-invert", (event) => {
          try {
            const payload = normalizePayload(JSON.parse(event.data));
            if (!streamInitialized) {
              streamInitialized = true;
              if (payload && payload.active === true && payload.timestamp > 0 && payload.timestamp < pageLoadTimestamp) {
                return;
              }
            }
            applyPayload(payload);
          } catch (error) {
            console.error("[MouseAxesInvertOverlay] Falha ao processar payload:", error);
          }
        });

        events.onerror = () => {
          events.close();
          window.setTimeout(connect, 1500);
        };
      }

      connect();

      if (autoplayEnabled) {
        applyPayload({
          active: true,
          requesterName: "viewer_mock",
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        });
      }
    })();
  </script>
</body>
</html>`;
}
