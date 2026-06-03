const OVERLAY_WIDTH_PX = 720;
const ENTRY_DURATION_MS = 820;
const EXIT_DURATION_MS = 560;
const VISIBLE_MS = 3400;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderChaosAlertOverlayPage() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml("Sentinela // Chaos Alert")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=keyboard,mouse" />
  <style>
    :root {
      color-scheme: dark;
      --overlay-width: ${OVERLAY_WIDTH_PX}px;
      --ink: rgba(7, 8, 12, 0.92);
      --panel: rgba(14, 16, 22, 0.72);
      --text: rgba(249, 239, 227, 0.98);
      --text-soft: rgba(240, 227, 210, 0.76);
      --accent: #ff8b39;
      --accent-soft: rgba(255, 139, 57, 0.22);
      --accent-glow: rgba(255, 132, 48, 0.38);
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
      width: 100vw;
      height: 100vh;
      padding: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .callout {
      position: relative;
      width: min(var(--overlay-width), calc(100vw - 24px));
      min-height: 242px;
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
      inset: 0;
    }
    .beam {
      position: absolute;
      right: 18px;
      top: 18px;
      bottom: 18px;
      width: 3px;
      transform: scaleY(0.12);
      transform-origin: top center;
      opacity: 0;
      background: linear-gradient(180deg, rgba(255, 215, 170, 0), rgba(255, 222, 188, 0.98) 16%, rgba(255, 132, 48, 0.92) 56%, rgba(255, 132, 48, 0));
      box-shadow:
        0 0 18px var(--accent-glow),
        0 0 36px rgba(255, 120, 40, 0.24),
        0 0 72px rgba(255, 120, 40, 0.12);
    }
    .spine {
      position: absolute;
      left: 18px;
      right: 42px;
      top: 0;
      height: 1px;
      opacity: 0;
      background: linear-gradient(90deg, rgba(255, 215, 170, 0.08), rgba(255, 190, 134, 0.62), rgba(255, 126, 42, 0.94));
      box-shadow: 0 0 18px rgba(255, 150, 70, 0.18);
      transform: scaleX(0.08);
      transform-origin: left center;
    }
    .panel {
      position: relative;
      margin-top: 18px;
      padding: 28px 42px 30px 32px;
      background:
        radial-gradient(circle at 50% 0, rgba(255, 155, 84, 0.18), transparent 38%),
        linear-gradient(180deg, rgba(18, 20, 27, 0.76), rgba(7, 8, 12, 0.9)),
        linear-gradient(90deg, rgba(255, 132, 46, 0.06), transparent 10%, transparent 90%, rgba(255, 132, 46, 0.06));
      border: 1px solid rgba(255, 146, 68, 0.14);
      clip-path: polygon(0 26px, 26px 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 0 100%);
      backdrop-filter: blur(14px) saturate(132%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 26px 60px rgba(0, 0, 0, 0.34);
      opacity: 0;
      transform: translateY(18px) scale(0.96);
      overflow: hidden;
    }
    .panel::before {
      content: "";
      position: absolute;
      inset: 0;
      clip-path: inherit;
      border: 1px solid rgba(255, 196, 132, 0.16);
      mask: linear-gradient(180deg, rgba(0, 0, 0, 0.88), rgba(0, 0, 0, 0.16));
      pointer-events: none;
    }
    .panel::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, transparent 0, rgba(255,255,255,0.08) 48%, transparent 58%),
        linear-gradient(180deg, rgba(255,255,255,0.08), transparent 22%);
      mix-blend-mode: screen;
      opacity: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: 128px minmax(0, 1fr);
      gap: 24px;
      align-items: center;
    }
    .sigil {
      position: relative;
      width: 128px;
      height: 128px;
      display: grid;
      place-items: center;
      border-radius: 30px;
      border: 1px solid rgba(255, 184, 124, 0.16);
      background:
        radial-gradient(circle at 50% 38%, rgba(255, 182, 117, 0.22), rgba(255, 122, 47, 0.06) 58%, transparent 76%),
        rgba(255, 255, 255, 0.02);
      box-shadow:
        inset 0 0 32px rgba(255, 127, 49, 0.08),
        0 0 0 1px rgba(255, 170, 104, 0.04);
      opacity: 0;
      transform: translateY(12px);
    }
    .sigil-ring,
    .sigil-ring::before,
    .sigil-ring::after {
      position: absolute;
      content: "";
      inset: 20px;
      border-radius: 26px;
      border: 1px solid rgba(255, 194, 138, 0.12);
    }
    .sigil-ring::before {
      inset: 10px;
      border-radius: 20px;
      opacity: 0.65;
    }
    .sigil-ring::after {
      inset: 34px;
      border-radius: 14px;
      opacity: 0.4;
    }
    .sigil-mark {
      position: relative;
      font-family: "Material Symbols Outlined";
      font-size: 58px;
      font-weight: 400;
      line-height: 1;
      letter-spacing: normal;
      color: rgba(255, 233, 205, 0.96);
      text-shadow: 0 0 24px rgba(255, 131, 45, 0.28);
      font-variation-settings:
        "FILL" 0,
        "wght" 500,
        "GRAD" 0,
        "opsz" 48;
    }
    .content {
      min-width: 0;
    }
    .eyebrow,
    .title,
    .meta,
    .detail {
      opacity: 0;
      transform: translateY(12px);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-family: "Rajdhani", sans-serif;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(255, 221, 183, 0.88);
    }
    .eyebrow::before {
      content: "";
      width: 42px;
      height: 2px;
      background: linear-gradient(90deg, rgba(255, 221, 183, 0.92), rgba(255, 122, 47, 0));
      box-shadow: 0 0 12px rgba(255, 155, 86, 0.28);
    }
    .title {
      margin: 10px 0 0;
      font-family: "Rajdhani", sans-serif;
      font-size: clamp(34px, 4.2vw, 54px);
      font-weight: 700;
      line-height: 0.95;
      letter-spacing: -0.04em;
      text-transform: uppercase;
      text-wrap: balance;
      text-shadow: 0 0 24px rgba(255, 122, 47, 0.14);
    }
    .meta {
      margin-top: 12px;
      font-size: clamp(16px, 1.75vw, 22px);
      line-height: 1.32;
      color: var(--text-soft);
    }
    .detail {
      margin-top: 18px;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 185, 119, 0.14);
      background: rgba(255, 255, 255, 0.03);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 226, 194, 0.82);
    }
    .detail::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 14px var(--accent-glow);
    }
    .callout.is-active .beam {
      animation: beamReveal ${ENTRY_DURATION_MS}ms cubic-bezier(.16,.88,.18,1) forwards;
    }
    .callout.is-active .spine {
      animation: spineReveal 440ms cubic-bezier(.2,.86,.2,1) 220ms forwards;
    }
    .callout.is-active .panel {
      animation: panelReveal ${ENTRY_DURATION_MS}ms cubic-bezier(.18,.84,.18,1) 110ms forwards;
    }
    .callout.is-active .panel::after {
      animation: panelSheen 540ms ease 340ms forwards;
    }
    .callout.is-active .sigil {
      animation: contentReveal 420ms ease 420ms forwards;
    }
    .callout.is-active .eyebrow {
      animation: contentReveal 380ms ease 460ms forwards;
    }
    .callout.is-active .title {
      animation: contentReveal 420ms ease 520ms forwards;
    }
    .callout.is-active .meta {
      animation: contentReveal 420ms ease 590ms forwards;
    }
    .callout.is-active .detail {
      animation: contentReveal 420ms ease 660ms forwards;
    }
    .callout.is-holding .beam {
      opacity: 1;
      transform: scaleY(1);
    }
    .callout.is-holding .spine {
      opacity: 1;
      transform: scaleX(1);
    }
    .callout.is-holding .panel {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .callout.is-holding .panel::after {
      opacity: 0;
    }
    .callout.is-holding .sigil,
    .callout.is-holding .eyebrow,
    .callout.is-holding .title,
    .callout.is-holding .meta,
    .callout.is-holding .detail {
      opacity: 1;
      transform: translateY(0);
    }
    .callout.is-exiting .beam {
      animation: beamExit ${EXIT_DURATION_MS}ms cubic-bezier(.72,.06,.84,.24) forwards;
    }
    .callout.is-exiting .spine {
      animation: spineExit 320ms cubic-bezier(.62,.04,.84,.34) 80ms forwards;
    }
    .callout.is-exiting .panel {
      animation: panelExit ${EXIT_DURATION_MS}ms cubic-bezier(.68,.04,.82,.3) forwards;
    }
    .callout.is-exiting .sigil,
    .callout.is-exiting .eyebrow,
    .callout.is-exiting .title,
    .callout.is-exiting .meta,
    .callout.is-exiting .detail {
      animation: contentExit 260ms cubic-bezier(.4,0,.2,1) forwards;
    }
    .callout[data-kind="mouse"] {
      --accent: #63d6ff;
      --accent-soft: rgba(99, 214, 255, 0.22);
      --accent-glow: rgba(91, 212, 255, 0.34);
    }
    .callout[data-kind="mouse"] .detail::before {
      background: #9eeaff;
    }
    @keyframes beamReveal {
      0% {
        opacity: 0;
        transform: scaleY(0.12);
      }
      100% {
        opacity: 1;
        transform: scaleY(1);
      }
    }
    @keyframes beamExit {
      0% {
        opacity: 1;
        transform: scaleY(1);
      }
      100% {
        opacity: 0;
        transform: scaleY(0.12);
      }
    }
    @keyframes spineReveal {
      0% {
        opacity: 0;
        transform: scaleX(0.08);
      }
      100% {
        opacity: 1;
        transform: scaleX(1);
      }
    }
    @keyframes spineExit {
      0% {
        opacity: 1;
        transform: scaleX(1);
      }
      100% {
        opacity: 0;
        transform: scaleX(0.08);
      }
    }
    @keyframes panelReveal {
      0% {
        opacity: 0;
        transform: translateY(18px) scale(0.96);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes panelExit {
      0% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      100% {
        opacity: 0;
        transform: translateY(16px) scale(0.97);
      }
    }
    @keyframes panelSheen {
      0% {
        opacity: 0;
        transform: translateX(-24%);
      }
      28% {
        opacity: 0.54;
      }
      100% {
        opacity: 0;
        transform: translateX(26%);
      }
    }
    @keyframes contentReveal {
      0% {
        opacity: 0;
        transform: translateY(12px);
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
        transform: translateY(-8px);
      }
    }
    @media (max-width: 780px) {
      .overlay-root {
        padding: 14px;
        align-items: center;
      }
      .callout {
        min-height: 288px;
      }
      .panel {
        padding: 22px 24px 22px 18px;
      }
      .grid {
        grid-template-columns: 1fr;
        gap: 16px;
        justify-items: center;
        text-align: center;
      }
      .sigil {
        width: 92px;
        height: 92px;
        border-radius: 24px;
      }
      .sigil-ring,
      .sigil-ring::before,
      .sigil-ring::after {
        inset: 14px;
      }
      .sigil-ring::before {
        inset: 8px;
      }
      .sigil-ring::after {
        inset: 24px;
      }
      .sigil-mark {
        font-size: 42px;
      }
      .eyebrow {
        justify-content: center;
      }
      .detail {
        justify-content: center;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .callout.is-active .beam,
      .callout.is-active .spine,
      .callout.is-active .panel,
      .callout.is-active .panel::after,
      .callout.is-active .sigil,
      .callout.is-active .eyebrow,
      .callout.is-active .title,
      .callout.is-active .meta,
      .callout.is-active .detail,
      .callout.is-exiting .beam,
      .callout.is-exiting .spine,
      .callout.is-exiting .panel,
      .callout.is-exiting .sigil,
      .callout.is-exiting .eyebrow,
      .callout.is-exiting .title,
      .callout.is-exiting .meta,
      .callout.is-exiting .detail {
        animation: none !important;
      }
      .callout.is-active,
      .callout.is-holding,
      .callout.is-exiting {
        opacity: 1;
        visibility: visible;
      }
      .callout.is-active .beam,
      .callout.is-holding .beam,
      .callout.is-exiting .beam,
      .callout.is-active .spine,
      .callout.is-holding .spine,
      .callout.is-exiting .spine,
      .callout.is-active .panel,
      .callout.is-holding .panel,
      .callout.is-exiting .panel,
      .callout.is-active .sigil,
      .callout.is-holding .sigil,
      .callout.is-exiting .sigil,
      .callout.is-active .eyebrow,
      .callout.is-holding .eyebrow,
      .callout.is-exiting .eyebrow,
      .callout.is-active .title,
      .callout.is-holding .title,
      .callout.is-exiting .title,
      .callout.is-active .meta,
      .callout.is-holding .meta,
      .callout.is-exiting .meta,
      .callout.is-active .detail,
      .callout.is-holding .detail,
      .callout.is-exiting .detail {
        opacity: 1;
        transform: none;
      }
    }
  </style>
</head>
<body>
  <main class="overlay-root">
    <section class="callout" id="overlay" data-kind="controls" aria-live="polite" aria-label="${escapeHtml("Overlay de alerta de caos")}">
      <div class="frame" aria-hidden="true">
        <span class="beam"></span>
        <span class="spine"></span>
      </div>
      <article class="panel">
        <div class="grid">
          <div class="sigil" aria-hidden="true">
            <span class="sigil-ring"></span>
            <span class="sigil-mark" id="alert-mark">keyboard</span>
          </div>
          <div class="content">
            <div class="eyebrow" id="alert-label">CHAOS ALERT</div>
            <h1 class="title" id="alert-title">${escapeHtml("Controles Invertidos")}</h1>
            <p class="meta" id="alert-meta">${escapeHtml("O chat assumiu o comando por alguns instantes.")}</p>
            <div class="detail" id="alert-detail">${escapeHtml("Resgatado por viewer_mock")}</div>
          </div>
        </div>
      </article>
    </section>
  </main>
  <script>
    (() => {
      const ENTRY_DURATION_MS = ${ENTRY_DURATION_MS};
      const EXIT_DURATION_MS = ${EXIT_DURATION_MS};
      const VISIBLE_MS = ${VISIBLE_MS};
      const overlay = document.getElementById("overlay");
      const labelNode = document.getElementById("alert-label");
      const titleNode = document.getElementById("alert-title");
      const metaNode = document.getElementById("alert-meta");
      const detailNode = document.getElementById("alert-detail");
      const markNode = document.getElementById("alert-mark");
      const params = new URLSearchParams(window.location.search);
      const autoplayEnabled = params.get("autoplay") === "1";
      const audioEnabled = params.get("sound") !== "0";
      const pageLoadTimestamp = Date.now();
      const queue = [];
      const seenIds = new Set();
      let activeItem = null;
      let holdTimer = null;
      let exitTimer = null;
      let nextTimer = null;
      let audioContext = null;
      const processedSignatures = new Set();
      const lastSignatureByKind = {
        controls: "",
        mouse: "",
      };
      const streamState = {
        controls: { initialized: false },
        mouse: { initialized: false },
      };

      function clearTimers() {
        if (holdTimer) {
          window.clearTimeout(holdTimer);
          holdTimer = null;
        }
        if (exitTimer) {
          window.clearTimeout(exitTimer);
          exitTimer = null;
        }
        if (nextTimer) {
          window.clearTimeout(nextTimer);
          nextTimer = null;
        }
      }

      function resetState() {
        overlay.classList.remove("is-active", "is-holding", "is-exiting");
      }

      function playAlertChime(kind) {
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

        const isMouse = kind === "mouse";
        const startAt = audioContext.currentTime + 0.01;
        const masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(0.0001, startAt);
        masterGain.gain.exponentialRampToValueAtTime(0.075, startAt + 0.05);
        masterGain.gain.exponentialRampToValueAtTime(0.055, startAt + 0.22);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.2);

        const highpass = audioContext.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.setValueAtTime(38, startAt);

        const softCompressor = audioContext.createDynamicsCompressor();
        softCompressor.threshold.setValueAtTime(-20, startAt);
        softCompressor.knee.setValueAtTime(16, startAt);
        softCompressor.ratio.setValueAtTime(2.4, startAt);
        softCompressor.attack.setValueAtTime(0.004, startAt);
        softCompressor.release.setValueAtTime(0.2, startAt);

        highpass.connect(softCompressor);
        softCompressor.connect(masterGain);
        masterGain.connect(audioContext.destination);

        const noiseBuffer = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * 0.8), audioContext.sampleRate);
        const channel = noiseBuffer.getChannelData(0);
        for (let index = 0; index < channel.length; index += 1) {
          const progress = index / channel.length;
          channel[index] = (Math.random() * 2 - 1) * (1 - progress * 0.72);
        }

        const noiseSource = audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        const noiseFilter = audioContext.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(isMouse ? 1680 : 1220, startAt);
        noiseFilter.Q.setValueAtTime(isMouse ? 1.2 : 0.95, startAt);

        const noiseGain = audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.0001, startAt);
        noiseGain.gain.exponentialRampToValueAtTime(0.042, startAt + 0.03);
        noiseGain.gain.exponentialRampToValueAtTime(0.012, startAt + 0.32);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.82);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(highpass);

        const drone = audioContext.createOscillator();
        drone.type = "triangle";
        drone.frequency.setValueAtTime(isMouse ? 142 : 118, startAt);
        drone.frequency.exponentialRampToValueAtTime(isMouse ? 188 : 162, startAt + 0.26);
        drone.frequency.exponentialRampToValueAtTime(isMouse ? 124 : 104, startAt + 1.0);

        const droneGain = audioContext.createGain();
        droneGain.gain.setValueAtTime(0.0001, startAt);
        droneGain.gain.exponentialRampToValueAtTime(0.038, startAt + 0.06);
        droneGain.gain.exponentialRampToValueAtTime(0.026, startAt + 0.28);
        droneGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.1);

        drone.connect(droneGain);
        droneGain.connect(highpass);

        const sub = audioContext.createOscillator();
        sub.type = "sine";
        sub.frequency.setValueAtTime(isMouse ? 61 : 54, startAt);
        sub.frequency.linearRampToValueAtTime(isMouse ? 69 : 62, startAt + 0.2);
        sub.frequency.linearRampToValueAtTime(isMouse ? 57 : 49, startAt + 0.92);

        const subGain = audioContext.createGain();
        subGain.gain.setValueAtTime(0.0001, startAt);
        subGain.gain.exponentialRampToValueAtTime(0.026, startAt + 0.07);
        subGain.gain.exponentialRampToValueAtTime(0.018, startAt + 0.24);
        subGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.96);

        sub.connect(subGain);
        subGain.connect(highpass);

        const shimmer = audioContext.createOscillator();
        shimmer.type = "sine";
        shimmer.frequency.setValueAtTime(isMouse ? 1240 : 980, startAt + 0.08);
        shimmer.frequency.exponentialRampToValueAtTime(isMouse ? 1760 : 1420, startAt + 0.34);
        shimmer.frequency.exponentialRampToValueAtTime(isMouse ? 1320 : 1120, startAt + 0.62);

        const shimmerGain = audioContext.createGain();
        shimmerGain.gain.setValueAtTime(0.0001, startAt);
        shimmerGain.gain.exponentialRampToValueAtTime(0.012, startAt + 0.12);
        shimmerGain.gain.exponentialRampToValueAtTime(0.007, startAt + 0.34);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.72);

        shimmer.connect(shimmerGain);
        shimmerGain.connect(highpass);

        noiseSource.start(startAt);
        noiseSource.stop(startAt + 0.82);
        drone.start(startAt);
        drone.stop(startAt + 1.1);
        sub.start(startAt + 0.01);
        sub.stop(startAt + 0.96);
        shimmer.start(startAt + 0.08);
        shimmer.stop(startAt + 0.72);
      }

      function finishCycle() {
        activeItem = null;
        resetState();

        if (queue.length) {
          startNext();
        }
      }

      function startExit() {
        clearTimers();
        overlay.classList.remove("is-active", "is-holding");
        void overlay.offsetWidth;
        overlay.classList.add("is-exiting");
        exitTimer = window.setTimeout(finishCycle, EXIT_DURATION_MS);
      }

      function buildPresentation(item) {
        const requesterLabel = item.requesterName ? "Resgatado por " + item.requesterName : "Resgate disparado pelo chat";

        if (item.kind === "mouse") {
          return {
            label: "CHAOS ALERT",
            title: "Mouse Invertido",
            meta: "Os eixos do mouse foram sabotados temporariamente.",
            detail: requesterLabel,
            mark: "mouse",
          };
        }

        return {
          label: "CHAOS ALERT",
          title: "Teclas Invertidas",
          meta: "O teclado entrou em modo de caos por alguns instantes.",
          detail: requesterLabel,
          mark: "keyboard",
        };
      }

      function showItem(item) {
        const presentation = buildPresentation(item);
        overlay.dataset.kind = item.kind;
        labelNode.textContent = presentation.label;
        titleNode.textContent = presentation.title;
        metaNode.textContent = presentation.meta;
        detailNode.textContent = presentation.detail;
        markNode.textContent = presentation.mark;

        clearTimers();
        resetState();
        void overlay.offsetWidth;
        overlay.classList.add("is-active");

        holdTimer = window.setTimeout(() => {
          if (activeItem !== item) {
            return;
          }
          overlay.classList.add("is-holding");
        }, ENTRY_DURATION_MS);

        nextTimer = window.setTimeout(() => {
          if (activeItem !== item) {
            return;
          }
          startExit();
        }, ENTRY_DURATION_MS + VISIBLE_MS);
      }

      function startNext() {
        if (activeItem || !queue.length) {
          return;
        }

        activeItem = queue.shift();
        playAlertChime(activeItem.kind);
        showItem(activeItem);
      }

      function enqueueItem(item) {
        if (seenIds.has(item.id)) {
          return;
        }

        seenIds.add(item.id);
        queue.push(item);
        startNext();
      }

      function normalizePayload(raw, kind) {
        if (!raw || typeof raw !== "object") {
          return null;
        }

        return {
          id: typeof raw.id === "string" ? raw.id.trim() : "",
          kind,
          active: raw.active === true,
          requesterName: typeof raw.requesterName === "string" ? raw.requesterName.trim() : "",
          startedAt: typeof raw.startedAt === "string" ? raw.startedAt.trim() : "",
          expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt.trim() : "",
          timestamp: typeof raw.timestamp === "number" ? raw.timestamp : 0,
        };
      }

      function buildPayloadSignature(payload) {
        return [
          payload.kind,
          payload.active ? "1" : "0",
          payload.requesterName || "",
          payload.startedAt || "",
          payload.expiresAt || "",
        ].join("|");
      }

      function shouldIgnoreInitialPayload(payload, kind) {
        const stream = streamState[kind];
        if (stream.initialized) {
          return false;
        }

        stream.initialized = true;
        return payload.active && payload.timestamp > 0 && payload.timestamp < pageLoadTimestamp;
      }

      function handleStreamPayload(kind, raw) {
        const payload = normalizePayload(raw, kind);
        if (!payload || !payload.id) {
          return;
        }

        if (shouldIgnoreInitialPayload(payload, kind)) {
          return;
        }

        if (!payload.active || !payload.startedAt || !payload.expiresAt) {
          return;
        }

        const signature = buildPayloadSignature(payload);
        if (!signature || processedSignatures.has(signature) || lastSignatureByKind[kind] === signature) {
          return;
        }

        lastSignatureByKind[kind] = signature;
        processedSignatures.add(signature);
        enqueueItem(payload);
      }

      function connect(url, eventName, kind) {
        const events = new EventSource(url);

        events.addEventListener(eventName, (event) => {
          try {
            handleStreamPayload(kind, JSON.parse(event.data));
          } catch (error) {
            console.error("[ChaosAlertOverlay] Falha ao processar payload:", error);
          }
        });

        events.onerror = () => {
          events.close();
          window.setTimeout(() => connect(url, eventName, kind), 1500);
        };
      }

      connect("/api/overlays/controls-invert/stream", "controls-invert", "controls");
      connect("/api/overlays/mouse-axes-invert/stream", "mouse-axes-invert", "mouse");

      if (autoplayEnabled) {
        enqueueItem({
          id: "preview-" + Date.now(),
          kind: params.get("kind") === "mouse" ? "mouse" : "controls",
          active: true,
          requesterName: "viewer_mock",
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 5000).toISOString(),
          timestamp: Date.now(),
        });
      }
    })();
  </script>
</body>
</html>`;
}
