import type { WebProfilePayload } from "../types.js";
import {
  renderProfileSpotifyRealtimeScript,
  renderProfileSpotifyRequestScript,
  renderSpotifyQueueSection,
  renderSpotifyRequestModal,
  renderSpotifyRewardCard,
} from "./spotify/profile.js";
import {
  buildProfileLoginUrl,
  escapeHtml,
  formatWatchedHours,
  getSiteDocument,
  renderSiteFooter,
  renderSiteHeader,
} from "./shared.js";

const FIRECOIN_ICON_URL = "/assets/images/firecoin.png";
const REWARD_CARD_BASE_CLASS = "group relative min-h-[11.5rem] w-full max-w-[18.5rem] overflow-hidden rounded-[22px] border p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition";

function renderFirecoinLabel(amount?: number) {
  const amountMarkup = typeof amount === "number" ? `<span>${amount}</span>` : "";
  return `<span class="inline-flex items-center gap-2"><img src="${FIRECOIN_ICON_URL}" alt="Firecoin" class="h-4 w-4 rounded-full object-cover" />${amountMarkup}</span>`;
}

function formatQueueTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRemainingDuration(value: string) {
  const remainingMs = Math.max(0, new Date(value).getTime() - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatRemainingMs(value: number) {
  const totalSeconds = Math.max(0, Math.ceil(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildVoicePlaceholderLabel(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "VO";
}

function renderVoicemodQueueMarkup(queueItems: WebProfilePayload["voicemodQueue"]) {
  if (!queueItems.length) {
    return `<p class="text-sm leading-7 text-white/54">Nenhuma voz aguardando na fila.</p>`;
  }

  return `
    <div>
      <div class="flex items-center justify-between gap-3">
        <strong class="text-sm font-semibold text-white">Fila atual</strong>
        <span class="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">${queueItems.length} aguardando</span>
      </div>
      <ul class="mt-4 grid gap-3 sm:grid-cols-2">
        ${queueItems.map((item) => `
          <li class="rounded-[18px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(8,18,24,0.96),rgba(10,14,18,0.96))] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.24)]">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <span class="section-kicker text-[10px] font-semibold uppercase text-cyan-100/70">fila ${item.position}</span>
                <strong class="mt-2 block truncate text-sm font-semibold text-white">${escapeHtml(item.displayName)}</strong>
              </div>
              <span class="text-[11px] text-white/42">${escapeHtml(formatQueueTime(item.createdAt))}</span>
            </div>
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

function getControlsInvertStateLabel(effect: WebProfilePayload["controlsInvertEffect"]) {
  if (effect.cooldownUntil && new Date(effect.cooldownUntil).getTime() > Date.now()) {
    return "cooldown";
  }

  return effect.state;
}

function renderControlsInvertRewardCard(
  reward: WebProfilePayload["rewards"][number] | null,
  effect: WebProfilePayload["controlsInvertEffect"]
) {
  if (!reward) {
    return "";
  }

  const isCoolingDown = Boolean(effect.cooldownUntil && new Date(effect.cooldownUntil).getTime() > Date.now());
  const clickable = Boolean(reward.enabled && reward.status === "available" && !isCoolingDown);
  const stateLabel = getControlsInvertStateLabel(effect);
  const cooldownLabel = isCoolingDown && effect.cooldownUntil
    ? formatRemainingDuration(effect.cooldownUntil)
    : null;
  const effectLine = isCoolingDown && cooldownLabel
    ? `Cooldown ativo: <strong class="text-white">${escapeHtml(cooldownLabel)}</strong> restantes.`
    : effect.state === "active" && effect.expiresAt
    ? `Ativo ate <strong class="text-white">${escapeHtml(new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(effect.expiresAt)))}</strong>.`
    : effect.state === "paused"
      ? "O Agent reportou o efeito como pausado."
      : "Nenhum efeito ativo no momento. Enquanto estiver ativo, as teclas trocam sozinhas a cada 1 minuto.";

  return `
    <article
      id="reward-card-chaos"
      data-reward-card="chaos"
      class="${REWARD_CARD_BASE_CLASS} ${clickable ? "cursor-pointer border-fuchsia-400/16 bg-[radial-gradient(circle_at_88%_50%,rgba(236,72,153,0.12),transparent_0_24%),linear-gradient(180deg,rgba(28,11,25,0.98),rgba(18,9,17,0.98))] hover:border-fuchsia-400/28 hover:-translate-y-0.5" : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"}"
      ${clickable ? 'role="button" tabindex="0" data-redeem-chaos="true"' : 'aria-disabled="true"'}
    >
      <div class="relative flex h-full flex-col">
        <div class="flex items-center justify-between gap-3">
          <span data-reward-badge="chaos" class="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${clickable ? "border-fuchsia-400/24 bg-fuchsia-500/10 text-fuchsia-100" : "border-white/10 bg-white/[0.03] text-white/54"}">Teclado</span>
          <span data-reward-cost="chaos" class="inline-flex items-center gap-2 text-xs font-semibold text-white/78">${renderFirecoinLabel(reward.cost)}</span>
        </div>
        <h3 data-reward-title="chaos" class="mt-3 text-lg font-semibold leading-7 text-white">${escapeHtml(reward.title)}</h3>
        <p data-reward-description="chaos" class="mt-2 text-sm leading-6 text-white/58">${escapeHtml(reward.description)}</p>
        <p data-chaos-effect-inline class="mt-3 text-sm leading-6 text-fuchsia-100/76">${effectLine}</p>
        <div class="mt-auto pt-4 flex items-center justify-between gap-3">
          <span data-reward-state="chaos" class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${effect.state === "active" ? "bg-fuchsia-500/12 text-fuchsia-100" : effect.state === "paused" ? "bg-amber-500/12 text-amber-100" : !reward.enabled ? "bg-white/[0.04] text-white/52" : reward.affordable ? "bg-emerald-400/12 text-emerald-300" : "bg-ember-500/10 text-amber-200"}">${stateLabel}</span>
          <span data-reward-action="chaos" class="text-[11px] font-semibold uppercase tracking-[0.16em] ${clickable ? "text-fuchsia-100/76" : "text-white/42"}">${isCoolingDown && cooldownLabel ? `Disponivel em ${escapeHtml(cooldownLabel)}` : clickable ? "Clique para resgatar" : "Indisponivel"}</span>
        </div>
      </div>
    </article>
  `;
}

function renderControlsInvertRewardScript(
  reward: WebProfilePayload["rewards"][number] | null,
  effect: WebProfilePayload["controlsInvertEffect"]
) {
  if (!reward) {
    return "";
  }

  return `
    <script>
      (() => {
        const rewardCard = document.getElementById("reward-card-chaos");
        const feedback = document.getElementById("reward-redeem-feedback");
        const balanceValue = document.getElementById("profile-balance-value");
        const rewardCost = document.querySelector('[data-reward-cost="chaos"]');
        const rewardState = document.querySelector('[data-reward-state="chaos"]');
        const rewardAction = document.querySelector('[data-reward-action="chaos"]');
        const effectInline = document.querySelector('[data-chaos-effect-inline]');
        const firecoinIcon = ${JSON.stringify(FIRECOIN_ICON_URL)};
        let currentReward = ${JSON.stringify(reward)};
        let currentEffect = ${JSON.stringify(effect)};

        function escapeClientHtml(value) {
          return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        }

        function firecoinMarkup(amount) {
          return '<span class="inline-flex items-center gap-2"><img src="' + firecoinIcon + '" alt="Firecoin" class="h-4 w-4 rounded-full object-cover" /><span>' + amount + "</span></span>";
        }

        function uniqueValues(values) {
          const result = [];
          for (const value of values) {
            if (typeof value === "string" && value && !result.includes(value)) {
              result.push(value);
            }
          }
          return result;
        }

        function parseImageCandidates(value) {
          if (typeof value !== "string" || !value) {
            return [];
          }

          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item) : [];
          } catch {
            return [];
          }
        }

        function buildPlaceholderLabel(name) {
          return String(name || "VO")
            .split(/\\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => (part[0] || "").toUpperCase())
            .join("") || "VO";
        }

        function applyVoiceImage(button, preferSelected) {
          if (!(button instanceof HTMLElement)) {
            return;
          }

          const imageNode = button.querySelector(".voicemod-voice-image");
          const placeholderNode = button.querySelector(".voicemod-voice-placeholder");
          const baseCandidates = parseImageCandidates(button.dataset.voiceImages);
          const selectedCandidates = parseImageCandidates(button.dataset.voiceSelectedImages);
          const candidates = uniqueValues(preferSelected ? [...selectedCandidates, ...baseCandidates] : [...baseCandidates, ...selectedCandidates]);

          if (!(imageNode instanceof HTMLImageElement) || !(placeholderNode instanceof HTMLElement)) {
            return;
          }

          const showPlaceholder = () => {
            imageNode.classList.add("hidden");
            imageNode.removeAttribute("src");
            placeholderNode.textContent = buildPlaceholderLabel(button.dataset.voiceName || "VO");
            placeholderNode.classList.remove("hidden");
          };

          if (!candidates.length) {
            showPlaceholder();
            return;
          }

          let candidateIndex = 0;
          const applyCandidate = () => {
            const candidate = candidates[candidateIndex];
            if (!candidate) {
              showPlaceholder();
              return;
            }

            placeholderNode.classList.add("hidden");
            imageNode.classList.remove("hidden");
            imageNode.src = candidate;
          };

          imageNode.onerror = () => {
            candidateIndex += 1;
            if (candidateIndex >= candidates.length) {
              imageNode.onerror = null;
              showPlaceholder();
              return;
            }
            applyCandidate();
          };

          applyCandidate();
        }

        function formatRemaining(value) {
          const remainingMs = Math.max(0, new Date(value).getTime() - Date.now());
          const totalSeconds = Math.ceil(remainingMs / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
        }

        function formatRemaining(value) {
          const remainingMs = Math.max(0, new Date(value).getTime() - Date.now());
          const totalSeconds = Math.ceil(remainingMs / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
        }

        function effectLabel(effectPayload) {
          if (effectPayload?.cooldownUntil && new Date(effectPayload.cooldownUntil).getTime() > Date.now()) return "cooldown";
          if (effectPayload?.state === "active") return "active";
          if (effectPayload?.state === "paused") return "paused";
          return "idle";
        }

        function effectDescription(effectPayload) {
          if (effectPayload?.cooldownUntil && new Date(effectPayload.cooldownUntil).getTime() > Date.now()) {
            return 'Cooldown ativo: <strong class="text-white">' + escapeClientHtml(formatRemaining(effectPayload.cooldownUntil)) + "</strong> restantes.";
          }

          if (effectPayload?.state === "active" && effectPayload?.expiresAt) {
            const expiresAt = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(effectPayload.expiresAt));
            return 'Ativo ate <strong class="text-white">' + escapeClientHtml(expiresAt) + "</strong>.";
          }

          if (effectPayload?.state === "paused") {
            return "O Agent reportou o efeito como pausado.";
          }

          return "Nenhum efeito ativo no momento.";
        }

        function setFeedback(message, type) {
          if (!feedback) return;
          feedback.innerHTML = escapeClientHtml(message);
          feedback.className = "mt-5 rounded-[18px] border px-4 py-3 text-sm";
          feedback.classList.remove("hidden");
          if (type === "success") {
            feedback.classList.add("border-emerald-400/30", "bg-emerald-400/10", "text-emerald-200");
          } else {
            feedback.classList.add("border-red-400/30", "bg-red-400/10", "text-red-200");
          }
        }

        function applyReward(nextReward, nextEffect) {
          currentReward = nextReward || currentReward;
          currentEffect = nextEffect || currentEffect;
          const isCoolingDown = Boolean(currentEffect?.cooldownUntil && new Date(currentEffect.cooldownUntil).getTime() > Date.now());
          const clickable = Boolean(currentReward?.enabled && currentReward?.status === "available" && !isCoolingDown);

          if (rewardCard) {
            rewardCard.className = "${REWARD_CARD_BASE_CLASS} " + (
              clickable
                ? "cursor-pointer border-fuchsia-400/16 bg-[radial-gradient(circle_at_88%_50%,rgba(236,72,153,0.12),transparent_0_24%),linear-gradient(180deg,rgba(28,11,25,0.98),rgba(18,9,17,0.98))] hover:border-fuchsia-400/28 hover:-translate-y-0.5"
                : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"
            );
            if (clickable) {
              rewardCard.setAttribute("data-redeem-chaos", "true");
              rewardCard.setAttribute("role", "button");
              rewardCard.setAttribute("tabindex", "0");
              rewardCard.removeAttribute("aria-disabled");
            } else {
              rewardCard.removeAttribute("data-redeem-chaos");
              rewardCard.removeAttribute("role");
              rewardCard.removeAttribute("tabindex");
              rewardCard.setAttribute("aria-disabled", "true");
            }
          }

          if (rewardCost && typeof currentReward?.cost === "number") {
            rewardCost.innerHTML = firecoinMarkup(currentReward.cost);
          }

          if (rewardState) {
            rewardState.textContent = effectLabel(currentEffect);
            rewardState.className = "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold " + (
              currentEffect?.cooldownUntil && new Date(currentEffect.cooldownUntil).getTime() > Date.now()
                ? "bg-white/[0.08] text-white/76"
                : currentEffect?.state === "active"
                ? "bg-fuchsia-500/12 text-fuchsia-100"
                : currentEffect?.state === "paused"
                  ? "bg-amber-500/12 text-amber-100"
                  : !currentReward?.enabled
                    ? "bg-white/[0.04] text-white/52"
                    : currentReward?.affordable
                      ? "bg-emerald-400/12 text-emerald-300"
                      : "bg-ember-500/10 text-amber-200"
            );
          }

          if (rewardAction) {
            const cooldownLabel = isCoolingDown && currentEffect?.cooldownUntil
              ? formatRemaining(currentEffect.cooldownUntil)
              : null;
            rewardAction.textContent = isCoolingDown
              ? "Disponivel em " + cooldownLabel
              : clickable
                ? "Clique para resgatar"
                : "Indisponivel";
            rewardAction.className = "text-[11px] font-semibold uppercase tracking-[0.16em] " + (clickable ? "text-fuchsia-100/76" : "text-white/42");
          }

          if (effectInline) {
            effectInline.innerHTML = effectDescription(currentEffect);
          }

          const moderationSummary = document.getElementById("moderation-chaos-summary");
          const moderationState = document.getElementById("moderation-chaos-state");
          const moderationAgentState = document.getElementById("moderation-chaos-agent-state");
          const moderationSession = document.getElementById("moderation-chaos-session");
          const moderationAgent = document.getElementById("moderation-chaos-agent");
          const moderationStarted = document.getElementById("moderation-chaos-started-at");
          const moderationPaused = document.getElementById("moderation-chaos-paused-at");
          const moderationEnds = document.getElementById("moderation-chaos-expires-at");

          if (moderationSummary) {
            moderationSummary.textContent = "Estado atual: " + effectLabel(currentEffect);
          }
          if (moderationState) {
            moderationState.textContent = effectLabel(currentEffect);
          }
          if (moderationAgentState) {
            moderationAgentState.textContent = effectLabel({ state: currentEffect?.agentState || "idle" });
          }
          if (moderationSession) {
            moderationSession.textContent = currentEffect?.sessionId || "Nenhuma";
          }
          if (moderationAgent) {
            moderationAgent.textContent = currentEffect?.agentId || "Nenhum";
          }
          if (moderationStarted) {
            moderationStarted.textContent = currentEffect?.startedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(currentEffect.startedAt)) : "Nao iniciado";
          }
          if (moderationPaused) {
            moderationPaused.textContent = currentEffect?.pausedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(currentEffect.pausedAt)) : "Nao pausado";
          }
          if (moderationEnds) {
            moderationEnds.textContent = currentEffect?.expiresAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(currentEffect.expiresAt)) : "Sem expiracao";
          }
        }

        async function redeem() {
          if (!currentReward?.enabled || currentReward?.status !== "available") {
            return;
          }

          if (!rewardCard || !(rewardCard instanceof HTMLElement)) {
            return;
          }

          rewardCard.setAttribute("aria-busy", "true");
          try {
            const response = await fetch("/api/rewards/redeem", {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "content-type": "application/json"
              },
              body: JSON.stringify({
                rewardId: "controls.invert",
                rewardType: "chaos_controls_invert"
              })
            });

            const payload = await response.json();
            if (!response.ok) {
              setFeedback(payload.message || "Falha ao resgatar a inversao de controles.", "error");
              return;
            }

            if (balanceValue && typeof payload.balanceAfter === "number") {
              balanceValue.textContent = String(payload.balanceAfter);
            }

            applyReward(currentReward, payload.effect || currentEffect);
            setFeedback("Aleatorizacao de controles ativada com sucesso.", "success");
            window.__vulkanProfileSync?.refresh?.();
          } catch {
            setFeedback("Falha ao ativar aleatorizacao de controles.", "error");
          } finally {
            rewardCard.removeAttribute("aria-busy");
          }
        }

        rewardCard?.addEventListener("click", () => {
          if (rewardCard.getAttribute("data-redeem-chaos") === "true") {
            void redeem();
          }
        });

        rewardCard?.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          if (rewardCard.getAttribute("data-redeem-chaos") === "true") {
            event.preventDefault();
            void redeem();
          }
        });

        window.__vulkanChaosProfile = {
          applySnapshot(snapshot) {
            applyReward(snapshot?.reward || currentReward, snapshot?.effect || currentEffect);
          }
        };

        applyReward(currentReward, currentEffect);
        window.setInterval(() => {
          applyReward(currentReward, currentEffect);
        }, 1000);
      })();
    </script>
  `;
}

function getMouseAxesInvertStateLabel(effect: WebProfilePayload["mouseAxesInvertEffect"]) {
  if (effect.cooldownUntil && new Date(effect.cooldownUntil).getTime() > Date.now()) {
    return "cooldown";
  }

  return effect.state;
}

function renderMouseAxesInvertRewardCard(
  reward: WebProfilePayload["rewards"][number] | null,
  effect: WebProfilePayload["mouseAxesInvertEffect"]
) {
  if (!reward) {
    return "";
  }

  const isCoolingDown = Boolean(effect.cooldownUntil && new Date(effect.cooldownUntil).getTime() > Date.now());
  const clickable = Boolean(reward.enabled && reward.status === "available" && !isCoolingDown);
  const stateLabel = getMouseAxesInvertStateLabel(effect);
  const cooldownLabel = isCoolingDown && effect.cooldownUntil
    ? formatRemainingDuration(effect.cooldownUntil)
    : null;
  const effectLine = isCoolingDown && cooldownLabel
    ? `Cooldown ativo: <strong class="text-white">${escapeHtml(cooldownLabel)}</strong> restantes.`
    : effect.state === "active" && effect.expiresAt
    ? `Ativo ate <strong class="text-white">${escapeHtml(new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(effect.expiresAt)))}</strong>.`
    : effect.state === "paused"
      ? "O Agent reportou o efeito como pausado."
      : "Nenhum efeito ativo no momento.";

  return `
    <article
      id="reward-card-mouse-axes-invert"
      data-reward-card="mouseAxesInvert"
      class="${REWARD_CARD_BASE_CLASS} ${clickable ? "cursor-pointer border-sky-400/16 bg-[radial-gradient(circle_at_88%_50%,rgba(56,189,248,0.14),transparent_0_24%),linear-gradient(180deg,rgba(8,18,32,0.98),rgba(7,12,22,0.98))] hover:border-sky-400/28 hover:-translate-y-0.5" : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"}"
      ${clickable ? 'role="button" tabindex="0" data-redeem-mouse-axes-invert="true"' : 'aria-disabled="true"'}
    >
      <div class="relative flex h-full flex-col">
        <div class="flex items-center justify-between gap-3">
          <span data-reward-badge="mouseAxesInvert" class="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${clickable ? "border-sky-400/24 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/[0.03] text-white/54"}">Mouse</span>
          <span data-reward-cost="mouseAxesInvert" class="inline-flex items-center gap-2 text-xs font-semibold text-white/78">${renderFirecoinLabel(reward.cost)}</span>
        </div>
        <h3 data-reward-title="mouseAxesInvert" class="mt-3 text-lg font-semibold leading-7 text-white">${escapeHtml(reward.title)}</h3>
        <p data-reward-description="mouseAxesInvert" class="mt-2 text-sm leading-6 text-white/58">${escapeHtml(reward.description)}</p>
        <p data-mouse-axes-effect-inline class="mt-3 text-sm leading-6 text-sky-100/76">${effectLine}</p>
        <div class="mt-auto pt-4 flex items-center justify-between gap-3">
          <span data-reward-state="mouseAxesInvert" class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${effect.state === "active" ? "bg-sky-500/12 text-sky-100" : effect.state === "paused" ? "bg-amber-500/12 text-amber-100" : !reward.enabled ? "bg-white/[0.04] text-white/52" : reward.affordable ? "bg-emerald-400/12 text-emerald-300" : "bg-ember-500/10 text-amber-200"}">${stateLabel}</span>
          <span data-reward-action="mouseAxesInvert" class="text-[11px] font-semibold uppercase tracking-[0.16em] ${clickable ? "text-sky-100/76" : "text-white/42"}">${isCoolingDown && cooldownLabel ? `Disponivel em ${escapeHtml(cooldownLabel)}` : clickable ? "Clique para resgatar" : "Indisponivel"}</span>
        </div>
      </div>
    </article>
  `;
}

function renderMouseAxesInvertRewardScript(
  reward: WebProfilePayload["rewards"][number] | null,
  effect: WebProfilePayload["mouseAxesInvertEffect"]
) {
  if (!reward) {
    return "";
  }

  return `
    <script>
      (() => {
        const rewardCard = document.getElementById("reward-card-mouse-axes-invert");
        const feedback = document.getElementById("reward-redeem-feedback");
        const balanceValue = document.getElementById("profile-balance-value");
        const rewardCost = document.querySelector('[data-reward-cost="mouseAxesInvert"]');
        const rewardState = document.querySelector('[data-reward-state="mouseAxesInvert"]');
        const rewardAction = document.querySelector('[data-reward-action="mouseAxesInvert"]');
        const effectInline = document.querySelector('[data-mouse-axes-effect-inline]');
        const firecoinIcon = ${JSON.stringify(FIRECOIN_ICON_URL)};
        let currentReward = ${JSON.stringify(reward)};
        let currentEffect = ${JSON.stringify(effect)};

        function escapeClientHtml(value) {
          return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        }

        function firecoinMarkup(amount) {
          return '<span class="inline-flex items-center gap-2"><img src="' + firecoinIcon + '" alt="Firecoin" class="h-4 w-4 rounded-full object-cover" /><span>' + amount + "</span></span>";
        }

        function formatRemaining(value) {
          const remainingMs = Math.max(0, new Date(value).getTime() - Date.now());
          const totalSeconds = Math.ceil(remainingMs / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
        }

        function effectLabel(effectPayload) {
          if (effectPayload?.cooldownUntil && new Date(effectPayload.cooldownUntil).getTime() > Date.now()) return "cooldown";
          if (effectPayload?.state === "active") return "active";
          if (effectPayload?.state === "paused") return "paused";
          return "idle";
        }

        function effectDescription(effectPayload) {
          if (effectPayload?.cooldownUntil && new Date(effectPayload.cooldownUntil).getTime() > Date.now()) {
            return 'Cooldown ativo: <strong class="text-white">' + escapeClientHtml(formatRemaining(effectPayload.cooldownUntil)) + "</strong> restantes.";
          }

          if (effectPayload?.state === "active" && effectPayload?.expiresAt) {
            const expiresAt = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(effectPayload.expiresAt));
            return 'Ativo ate <strong class="text-white">' + escapeClientHtml(expiresAt) + "</strong>.";
          }

          if (effectPayload?.state === "paused") {
            return "O Agent reportou o efeito como pausado.";
          }

          return "Nenhum efeito ativo no momento.";
        }

        function setFeedback(message, type) {
          if (!feedback) return;
          feedback.innerHTML = escapeClientHtml(message);
          feedback.className = "mt-5 rounded-[18px] border px-4 py-3 text-sm";
          feedback.classList.remove("hidden");
          if (type === "success") {
            feedback.classList.add("border-emerald-400/30", "bg-emerald-400/10", "text-emerald-200");
          } else {
            feedback.classList.add("border-red-400/30", "bg-red-400/10", "text-red-200");
          }
        }

        function applyReward(nextReward, nextEffect) {
          currentReward = nextReward || currentReward;
          currentEffect = nextEffect || currentEffect;
          const isCoolingDown = Boolean(currentEffect?.cooldownUntil && new Date(currentEffect.cooldownUntil).getTime() > Date.now());
          const clickable = Boolean(currentReward?.enabled && currentReward?.status === "available" && !isCoolingDown);

          if (rewardCard) {
            rewardCard.className = "${REWARD_CARD_BASE_CLASS} " + (
              clickable
                ? "cursor-pointer border-sky-400/16 bg-[radial-gradient(circle_at_88%_50%,rgba(56,189,248,0.14),transparent_0_24%),linear-gradient(180deg,rgba(8,18,32,0.98),rgba(7,12,22,0.98))] hover:border-sky-400/28 hover:-translate-y-0.5"
                : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"
            );
            if (clickable) {
              rewardCard.setAttribute("data-redeem-mouse-axes-invert", "true");
              rewardCard.setAttribute("role", "button");
              rewardCard.setAttribute("tabindex", "0");
              rewardCard.removeAttribute("aria-disabled");
            } else {
              rewardCard.removeAttribute("data-redeem-mouse-axes-invert");
              rewardCard.removeAttribute("role");
              rewardCard.removeAttribute("tabindex");
              rewardCard.setAttribute("aria-disabled", "true");
            }
          }

          if (rewardCost && typeof currentReward?.cost === "number") {
            rewardCost.innerHTML = firecoinMarkup(currentReward.cost);
          }

          if (rewardState) {
            rewardState.textContent = effectLabel(currentEffect);
            rewardState.className = "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold " + (
              currentEffect?.cooldownUntil && new Date(currentEffect.cooldownUntil).getTime() > Date.now()
                ? "bg-white/[0.08] text-white/76"
                : currentEffect?.state === "active"
                ? "bg-sky-500/12 text-sky-100"
                : currentEffect?.state === "paused"
                  ? "bg-amber-500/12 text-amber-100"
                  : !currentReward?.enabled
                    ? "bg-white/[0.04] text-white/52"
                    : currentReward?.affordable
                      ? "bg-emerald-400/12 text-emerald-300"
                      : "bg-ember-500/10 text-amber-200"
            );
          }

          if (rewardAction) {
            const cooldownLabel = isCoolingDown && currentEffect?.cooldownUntil
              ? formatRemaining(currentEffect.cooldownUntil)
              : null;
            rewardAction.textContent = currentEffect?.cooldownUntil && new Date(currentEffect.cooldownUntil).getTime() > Date.now()
              ? "Disponivel em " + cooldownLabel
              : clickable
                ? "Clique para resgatar"
                : "Indisponivel";
            rewardAction.className = "text-[11px] font-semibold uppercase tracking-[0.16em] " + (clickable ? "text-sky-100/76" : "text-white/42");
          }

          if (effectInline) {
            effectInline.innerHTML = effectDescription(currentEffect);
          }

          const moderationSummary = document.getElementById("moderation-mouse-axes-summary");
          const moderationState = document.getElementById("moderation-mouse-axes-state");
          const moderationAgentState = document.getElementById("moderation-mouse-axes-agent-state");
          const moderationSession = document.getElementById("moderation-mouse-axes-session");
          const moderationAgent = document.getElementById("moderation-mouse-axes-agent");
          const moderationStarted = document.getElementById("moderation-mouse-axes-started-at");
          const moderationPaused = document.getElementById("moderation-mouse-axes-paused-at");
          const moderationEnds = document.getElementById("moderation-mouse-axes-expires-at");

          if (moderationSummary) {
            moderationSummary.textContent = "Estado atual: " + effectLabel(currentEffect);
          }
          if (moderationState) {
            moderationState.textContent = effectLabel(currentEffect);
          }
          if (moderationAgentState) {
            moderationAgentState.textContent = effectLabel({ state: currentEffect?.agentState || "idle" });
          }
          if (moderationSession) {
            moderationSession.textContent = currentEffect?.sessionId || "Nenhuma";
          }
          if (moderationAgent) {
            moderationAgent.textContent = currentEffect?.agentId || "Nenhum";
          }
          if (moderationStarted) {
            moderationStarted.textContent = currentEffect?.startedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(currentEffect.startedAt)) : "Nao iniciado";
          }
          if (moderationPaused) {
            moderationPaused.textContent = currentEffect?.pausedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(currentEffect.pausedAt)) : "Nao pausado";
          }
          if (moderationEnds) {
            moderationEnds.textContent = currentEffect?.expiresAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(currentEffect.expiresAt)) : "Sem expiracao";
          }
        }

        async function redeem() {
          if (!currentReward?.enabled || currentReward?.status !== "available") {
            return;
          }

          if (!rewardCard || !(rewardCard instanceof HTMLElement)) {
            return;
          }

          rewardCard.setAttribute("aria-busy", "true");
          try {
            const response = await fetch("/api/rewards/redeem", {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "content-type": "application/json"
              },
              body: JSON.stringify({
                rewardId: "mouse.axes.invert.xy",
                rewardType: "mouse_axes_invert"
              })
            });

            const payload = await response.json();
            if (!response.ok) {
              setFeedback(payload.message || "Falha ao resgatar a inversao dos eixos do mouse.", "error");
              return;
            }

            if (balanceValue && typeof payload.balanceAfter === "number") {
              balanceValue.textContent = String(payload.balanceAfter);
            }

            applyReward(currentReward, payload.effect || currentEffect);
            setFeedback("Inverter eixo X + Y do mouse ativado com sucesso.", "success");
            window.__vulkanProfileSync?.refresh?.();
          } catch {
            setFeedback("Falha ao ativar a inversao dos eixos do mouse.", "error");
          } finally {
            rewardCard.removeAttribute("aria-busy");
          }
        }

        rewardCard?.addEventListener("click", () => {
          if (rewardCard.getAttribute("data-redeem-mouse-axes-invert") === "true") {
            void redeem();
          }
        });

        rewardCard?.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          if (rewardCard.getAttribute("data-redeem-mouse-axes-invert") === "true") {
            event.preventDefault();
            void redeem();
          }
        });

        window.__vulkanMouseAxesProfile = {
          applySnapshot(snapshot) {
            applyReward(snapshot?.reward || currentReward, snapshot?.effect || currentEffect);
          }
        };

        applyReward(currentReward, currentEffect);
        window.setInterval(() => {
          applyReward(currentReward, currentEffect);
        }, 1000);
      })();
    </script>
  `;
}

function renderModeratorOverlayHubMarkup() {
  const overlays = [
    {
      key: "chat",
      title: "Chat Vulkan Terminal",
      path: "/overlays/chat/vulkan-terminal",
      description: "Overlay principal do chat para usar no OBS.",
    },
    {
      key: "callout",
      title: "Sentinel Callout",
      path: "/overlays/sentinel/callout",
      description: "Overlay de avisos automáticos e callouts da Sentinela.",
    },
    {
      key: "chaos-alert",
      title: "Chaos Alert",
      path: "/overlays/chaos/alert",
      description: "Overlay cinematica curta para avisar resgates de inverter teclas ou mouse.",
    },
    {
      key: "controls-invert",
      title: "Controls Invert Timer",
      path: "/overlays/chaos/controls-invert",
      description: "Overlay com icone e contador regressivo da inversao de controles.",
    },
    {
      key: "mouse-axes-invert",
      title: "Mouse Axes Invert Timer",
      path: "/overlays/chaos/mouse-axes-invert",
      description: "Overlay com icone e contador regressivo da inversao dos eixos do mouse.",
    },
  ];

  return `
    <section class="site-panel-soft rounded-[30px] p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span class="section-kicker text-[10px] font-semibold uppercase text-cyan-100/70">Overlays</span>
          <h3 class="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Mini hub de links</h3>
        </div>
        <p class="max-w-xl text-sm leading-7 text-white/56">Atalhos rápidos para abrir no navegador ou copiar direto para o OBS.</p>
      </div>
      <div class="mt-5 grid gap-3 lg:grid-cols-2">
        ${overlays.map((overlay) => `
          <article class="rounded-[22px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(9,18,28,0.88),rgba(8,10,16,0.96))] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <span class="section-kicker text-[10px] font-semibold uppercase text-cyan-100/70">${escapeHtml(overlay.key)}</span>
                <h4 class="mt-2 text-base font-semibold text-white">${escapeHtml(overlay.title)}</h4>
                <p class="mt-2 text-sm leading-6 text-white/56">${escapeHtml(overlay.description)}</p>
              </div>
            </div>
            <div class="mt-4 rounded-[16px] border border-white/8 bg-black/20 px-3 py-2.5">
              <a
                href="${escapeHtml(overlay.path)}"
                target="_blank"
                rel="noreferrer"
                class="block truncate text-sm text-cyan-100/86 transition hover:text-cyan-100"
                data-overlay-link="${escapeHtml(overlay.path)}"
              >${escapeHtml(overlay.path)}</a>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <a
                href="${escapeHtml(overlay.path)}"
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center justify-center rounded-[14px] border border-cyan-400/18 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/30"
                data-overlay-open="${escapeHtml(overlay.path)}"
              >Abrir</a>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-[14px] border border-white/10 bg-black/18 px-4 py-2.5 text-sm font-semibold text-white/78 transition hover:border-cyan-400/22 hover:text-white"
                data-overlay-copy="${escapeHtml(overlay.path)}"
              >Copiar link</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderModeratorModuleSettingsMarkup(payload: WebProfilePayload) {
  return `
    <section class="site-panel-soft rounded-[30px] p-5 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span class="section-kicker text-[10px] font-semibold uppercase text-cyan-100/70">Modulos</span>
          <h3 class="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Chaves operacionais</h3>
        </div>
        <p class="max-w-xl text-sm leading-7 text-white/56">Ative ou desative funcoes do bot direto pela tabela de modulos.</p>
      </div>
      <div id="module-settings-feedback" class="mt-5 hidden rounded-[18px] border px-4 py-3 text-sm"></div>
      <div class="mt-5 grid gap-3">
        ${payload.moduleSettings.map((moduleSetting) => `
          <form class="module-setting-form rounded-[22px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(9,18,28,0.88),rgba(8,10,16,0.96))] px-4 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)]" data-module-key="${escapeHtml(moduleSetting.key)}" data-module-title="${escapeHtml(moduleSetting.title)}">
            <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
              <div class="min-w-0 xl:flex-1">
                <h3 class="truncate text-base font-semibold text-white">${escapeHtml(moduleSetting.title)}</h3>
                <p class="mt-1 text-xs leading-6 text-white/56">${escapeHtml(moduleSetting.description)}</p>
              </div>
              <div class="flex items-center gap-2 xl:w-[18%] xl:justify-start">
                <span class="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/76">${escapeHtml(moduleSetting.key)}</span>
              </div>
              <div class="flex items-center justify-between gap-3 rounded-[16px] border border-cyan-400/10 bg-black/16 px-3 py-2.5 xl:w-[22%]">
                <span class="text-xs font-medium text-white/62">Status</span>
                <button
                  type="button"
                  id="module-enabled-toggle-${escapeHtml(moduleSetting.key)}"
                  data-toggle-module="${escapeHtml(moduleSetting.key)}"
                  aria-pressed="${moduleSetting.enabled ? "true" : "false"}"
                  class="module-enabled-toggle inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${moduleSetting.enabled ? "bg-emerald-400/14 text-emerald-200" : "bg-white/[0.06] text-white/52"}"
                >
                  <span class="h-2.5 w-2.5 rounded-full ${moduleSetting.enabled ? "bg-emerald-300" : "bg-white/24"}"></span>
                  <span>${moduleSetting.enabled ? "Ativo" : "Inativo"}</span>
                </button>
                <input id="module-enabled-${escapeHtml(moduleSetting.key)}" name="enabled" type="checkbox" ${moduleSetting.enabled ? "checked" : ""} class="hidden" />
              </div>
              <div class="xl:w-[12%] xl:text-right">
                <button type="submit" class="inline-flex w-full items-center justify-center rounded-[14px] border border-cyan-400/18 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/30 xl:w-auto">Salvar</button>
              </div>
            </div>
          </form>
        `).join("")}
      </div>
    </section>
  `;
}

function renderVoicemodRewardCard(
  reward: WebProfilePayload["rewards"][number] | null,
  activeReward: WebProfilePayload["activeVoicemodReward"],
  queueItems: WebProfilePayload["voicemodQueue"]
) {
  if (!reward) {
    return `<p class="rounded-[20px] border border-white/8 bg-black/16 px-4 py-4 text-sm leading-7 text-white/54">Nenhum resgate de voz configurado no momento.</p>`;
  }

  const clickable = Boolean(reward.enabled && reward.status === "available");
  const stateLabel = activeReward
    ? `Voz ativa${queueItems.length ? ` +${queueItems.length} na fila` : ""}`
    : queueItems.length
      ? `${queueItems.length} na fila`
    : !reward.enabled
      ? "Indisponivel"
      : reward.affordable
        ? "Pronto para escolher"
        : "Saldo insuficiente";
  const activeInline = activeReward
    ? `Ativa agora: <strong class="text-white">${escapeHtml(activeReward.displayName)}</strong> por mais <strong class="text-white">${escapeHtml(formatRemainingMs(activeReward.remainingMs))}</strong>.`
    : "Nenhuma voz ativa no momento.";
  const queueInline = queueItems.length
    ? queueItems.length === 1
      ? "1 voz aguardando na fila."
      : `${queueItems.length} vozes aguardando na fila.`
    : "Ao confirmar, a voz entra na fila automaticamente se outra ja estiver ativa.";

  return `
    <article
      id="reward-card-voicemod"
      data-reward-card="voicemod"
      class="${REWARD_CARD_BASE_CLASS} ${clickable ? "cursor-pointer border-cyan-400/16 bg-[radial-gradient(circle_at_88%_50%,rgba(93,239,255,0.12),transparent_0_24%),linear-gradient(180deg,rgba(10,21,28,0.98),rgba(9,16,22,0.98))] hover:border-cyan-400/28 hover:-translate-y-0.5" : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"}"
      ${clickable ? 'role="button" tabindex="0" data-open-voicemod-modal="true"' : 'aria-disabled="true"'}
    >
      <div data-reward-orb="voicemod" class="hidden"></div>
      <div class="relative flex h-full flex-col">
        <div class="flex items-center justify-between gap-3">
          <span data-reward-badge="voicemod" class="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${clickable ? "border-cyan-400/24 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-white/54"}">Voicemod</span>
          <span data-reward-cost="voicemod" class="inline-flex items-center gap-2 text-xs font-semibold text-white/78">${renderFirecoinLabel(reward.cost)}</span>
        </div>
        <h3 data-reward-title="voicemod" class="mt-3 text-lg font-semibold leading-7 text-white">${escapeHtml(reward.title)}</h3>
        <p data-reward-description="voicemod" class="mt-2 text-sm leading-6 text-white/58">${escapeHtml(reward.description)}</p>
        <p data-voicemod-active-inline class="mt-3 text-sm leading-6 text-cyan-100/76">${activeInline}</p>
        <p data-voicemod-queue-inline class="mt-1 text-sm leading-6 text-white/56">${queueInline}</p>
        <div class="mt-auto pt-4 flex items-center justify-between gap-3">
          <span data-reward-state="voicemod" class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${activeReward || queueItems.length ? "bg-cyan-500/12 text-cyan-200" : !reward.enabled ? "bg-white/[0.04] text-white/52" : reward.affordable ? "bg-emerald-400/12 text-emerald-300" : "bg-ember-500/10 text-amber-200"}">${stateLabel}</span>
          <span data-reward-action="voicemod" class="text-[11px] font-semibold uppercase tracking-[0.16em] ${clickable ? "text-cyan-100/76" : "text-white/42"}">${clickable ? "Abrir vozes" : "Indisponivel"}</span>
        </div>
      </div>
    </article>
  `;
}

function renderSoundAlertRewardCard(
  reward: WebProfilePayload["rewards"][number] | null,
  soundAlerts: WebProfilePayload["voicemodSoundAlerts"],
  soundboard: WebProfilePayload["voicemodSoundboard"],
) {
  if (!reward) {
    return `<p class="rounded-[20px] border border-white/8 bg-black/16 px-4 py-4 text-sm leading-7 text-white/54">Nenhum sound alert configurado no momento.</p>`;
  }

  const clickable = Boolean(reward.enabled && reward.status === "available");
  const enabledCount = soundAlerts.filter((soundAlert) => soundAlert.enabled).length;
  const stateLabel = !reward.enabled
    ? "Indisponivel"
    : soundAlerts.length
      ? `${enabledCount}/${soundAlerts.length} ativos`
      : "Sem sounds";
  const boardLabel = soundboard?.name
    ? `Soundboard atual: ${soundboard.name}.`
    : "Nenhuma soundboard identificada no momento.";
  const countLabel = soundAlerts.length
    ? `${soundAlerts.length} sound alerts sincronizados para teste.`
    : "Nenhum sound alert sincronizado pelo agent.";

  return `
    <article
      id="reward-card-soundalert"
      data-reward-card="soundalert"
      class="${REWARD_CARD_BASE_CLASS} ${clickable ? "cursor-pointer border-amber-400/18 bg-[radial-gradient(circle_at_12%_22%,rgba(251,191,36,0.16),transparent_0_28%),linear-gradient(180deg,rgba(30,21,9,0.98),rgba(20,13,8,0.98))] hover:border-amber-400/30 hover:-translate-y-0.5" : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"}"
      ${clickable ? 'role="button" tabindex="0" data-open-soundalert-modal="true"' : 'aria-disabled="true"'}
    >
      <div data-reward-orb="soundalert" class="hidden"></div>
      <div class="relative flex h-full flex-col">
        <div class="flex items-center justify-between gap-3">
          <span data-reward-badge="soundalert" class="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${clickable ? "border-amber-400/24 bg-amber-500/10 text-amber-100" : "border-white/10 bg-white/[0.03] text-white/54"}">Sound Alerts</span>
          <span data-reward-cost="soundalert" class="inline-flex items-center gap-2 text-xs font-semibold text-white/78">${renderFirecoinLabel(reward.cost)}</span>
        </div>
        <h3 data-reward-title="soundalert" class="mt-3 text-lg font-semibold leading-7 text-white">${escapeHtml(reward.title)}</h3>
        <p data-reward-description="soundalert" class="mt-2 text-sm leading-6 text-white/58">${escapeHtml(reward.description)}</p>
        <p data-soundalert-board-inline class="mt-3 text-sm leading-6 text-amber-100/76">${escapeHtml(boardLabel)}</p>
        <p data-soundalert-count-inline class="mt-1 text-sm leading-6 text-white/56">${escapeHtml(countLabel)}</p>
        <div class="mt-auto pt-4 flex items-center justify-between gap-3">
          <span data-reward-state="soundalert" class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${clickable && soundAlerts.length ? "bg-amber-500/12 text-amber-100" : !reward.enabled ? "bg-white/[0.04] text-white/52" : "bg-white/[0.04] text-white/52"}">${escapeHtml(stateLabel)}</span>
          <span data-reward-action="soundalert" class="text-[11px] font-semibold uppercase tracking-[0.16em] ${clickable ? "text-amber-100/76" : "text-white/42"}">${clickable ? "Abrir sounds" : "Indisponivel"}</span>
        </div>
      </div>
    </article>
  `;
}

function renderVoicemodVoiceGrid(voiceRewards: WebProfilePayload["voicemodVoices"]) {
  return `
    <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      ${voiceRewards.length
        ? voiceRewards.map((voice) => `
          <button
            type="button"
            class="voicemod-menu-item group relative aspect-[0.76] overflow-hidden rounded-[18px] border ${voice.enabled ? "border-cyan-400/10 bg-[linear-gradient(180deg,rgba(10,24,32,0.82),rgba(8,12,18,0.96))] hover:border-cyan-400/24" : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-60 grayscale"} text-left transition"
            data-voice-id="${escapeHtml(voice.id)}"
            data-voice-name="${escapeHtml(voice.title)}"
            data-voice-state="${voice.isActive ? "active" : voice.isQueued ? "queued" : "available"}"
            data-voice-enabled="${voice.enabled ? "true" : "false"}"
            data-voice-images='${escapeHtml(JSON.stringify(voice.imageCandidates))}'
            data-voice-selected-images='${escapeHtml(JSON.stringify(voice.selectedImageCandidates))}'
          >
            <img src="${escapeHtml(voice.thumbnailUrl || voice.selectedThumbnailUrl || voice.fallbackThumbnailUrl || "")}" alt="${escapeHtml(voice.title)}" class="${voice.thumbnailUrl || voice.selectedThumbnailUrl || voice.fallbackThumbnailUrl ? "voicemod-voice-image" : "voicemod-voice-image hidden"} absolute inset-0 h-full w-full object-cover" />
            <span class="${voice.thumbnailUrl || voice.selectedThumbnailUrl || voice.fallbackThumbnailUrl ? "voicemod-voice-placeholder hidden" : "voicemod-voice-placeholder"} absolute inset-0 flex items-center justify-center bg-cyan-950/80 text-lg font-semibold uppercase tracking-[0.22em] text-cyan-100/72">${escapeHtml(buildVoicePlaceholderLabel(voice.title))}</span>
            <span class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10"></span>
            <span class="relative flex h-full flex-col justify-end p-3">
              <strong class="block truncate text-sm font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">${escapeHtml(voice.title)}</strong>
              <span class="mt-1 block text-[11px] text-white/78 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">${!voice.enabled ? "Desativada no agent" : voice.isActive ? "Tocando agora" : voice.isQueued ? "Ja entrou na fila" : "Disponivel para resgate"}</span>
              <span class="mt-2 inline-flex w-fit rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase backdrop-blur-sm ${!voice.enabled ? "text-white/58" : voice.isActive ? "text-cyan-100" : voice.isQueued ? "text-amber-100" : "text-emerald-200"}">${!voice.enabled ? "Inativa" : voice.isActive ? "Ao vivo" : voice.isQueued ? "Na fila" : "Livre"}</span>
            </span>
          </button>
        `).join("")
        : `<p class="rounded-[18px] border border-cyan-400/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">Nenhuma voz sincronizada pelo agent no momento.</p>`}
    </div>
  `;
}

function renderVoicemodSoundAlertList(
  soundAlerts: WebProfilePayload["voicemodSoundAlerts"],
  soundboard: WebProfilePayload["voicemodSoundboard"],
) {
  if (!soundAlerts.length) {
    return `<p class="rounded-[18px] border border-cyan-400/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">Nenhum sound alert sincronizado pelo agent no momento.</p>`;
  }

  return `
    <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      ${soundAlerts.map((soundAlert) => `
        <article class="soundalert-menu-item group relative aspect-[0.76] overflow-hidden rounded-[18px] border ${soundAlert.enabled ? "border-amber-400/12 bg-[linear-gradient(180deg,rgba(36,24,10,0.82),rgba(22,14,8,0.96))] hover:border-amber-400/24" : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-60 grayscale"} text-left transition" data-sound-id="${escapeHtml(soundAlert.id)}" data-sound-name="${escapeHtml(soundAlert.title)}" data-sound-enabled="${soundAlert.enabled ? "true" : "false"}">
          <img src="${escapeHtml(soundAlert.thumbnailUrl || soundAlert.fallbackThumbnailUrl || "")}" alt="${escapeHtml(soundAlert.title)}" class="${soundAlert.thumbnailUrl || soundAlert.fallbackThumbnailUrl ? "soundalert-image" : "soundalert-image hidden"} absolute inset-0 h-full w-full object-cover" />
          <span class="${soundAlert.thumbnailUrl || soundAlert.fallbackThumbnailUrl ? "soundalert-placeholder hidden" : "soundalert-placeholder"} absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(251,191,36,0.16),rgba(36,24,10,0.94)_68%)] text-lg font-semibold uppercase tracking-[0.22em] text-amber-100/72">${escapeHtml(buildVoicePlaceholderLabel(soundAlert.title || "SFX"))}</span>
          <span class="absolute inset-0 bg-gradient-to-t from-black via-black/44 to-black/10"></span>
          <span class="relative flex h-full flex-col justify-between p-3">
            <span class="flex items-start justify-between gap-2">
              ${soundAlert.soundboardName || soundboard?.name ? `<span class="rounded-full border border-white/10 bg-black/32 px-2 py-1 text-[10px] font-semibold uppercase text-white/56">${escapeHtml(soundAlert.soundboardName || soundboard?.name || "")}</span>` : `<span></span>`}
              <span class="inline-flex rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase backdrop-blur-sm ${soundAlert.enabled ? "text-emerald-200" : "text-white/58"}">${soundAlert.enabled ? "Ativo" : "Inativo"}</span>
            </span>
            <span class="block">
              <strong class="block truncate text-sm font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">${escapeHtml(soundAlert.title)}</strong>
              <span class="mt-1 block text-[11px] text-white/78 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">${escapeHtml(soundAlert.playbackMode || "PlayStop")}${soundAlert.loop ? " • loop" : ""}${soundAlert.stopOtherSounds ? " • para outros sons" : ""}</span>
            </span>
          </span>
        </article>
      `).join("")}
    </div>
  `;
}

function renderVoicemodRequestModal(
  reward: WebProfilePayload["rewards"][number] | null,
  voiceRewards: WebProfilePayload["voicemodVoices"],
  activeReward: WebProfilePayload["activeVoicemodReward"],
  queueItems: WebProfilePayload["voicemodQueue"]
) {
  if (!reward) {
    return "";
  }

  return `
    <div id="voicemod-request-modal" class="fixed inset-0 z-50 hidden">
      <div class="absolute inset-0 bg-[#030509]/90 backdrop-blur-md" data-close-voicemod-modal="true"></div>
      <div class="relative flex min-h-screen items-center justify-center p-4">
        <section class="site-panel noise-mask relative w-full max-w-4xl overflow-hidden rounded-[34px] border border-cyan-400/20 p-6 shadow-[0_32px_90px_rgba(0,0,0,0.72)] sm:p-8">
          <div class="absolute left-[-2rem] top-[-2rem] h-32 w-32 rounded-full bg-cyan-400/16 blur-2xl"></div>
          <div class="absolute right-[-1rem] top-[10%] h-24 w-24 rounded-full bg-sky-300/12 blur-2xl"></div>
          <div class="relative">
            <div class="flex items-start justify-between gap-4">
              <div>
                <span class="section-kicker text-[10px] font-semibold uppercase text-cyan-100/76">Troca de voz</span>
                <h2 class="hero-title mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Escolha a voz do Vulkan Agent</h2>
                <p class="mt-3 max-w-2xl text-sm leading-7 text-white/58">Cada troca custa <span id="voicemod-request-cost" class="inline-flex items-center gap-2 font-semibold text-white">${renderFirecoinLabel(reward.cost)}</span> e fica ativa por 5 minutos. Se outra voz ja estiver rodando, sua escolha entra na fila automaticamente.</p>
              </div>
              <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xl text-white/72 transition hover:border-cyan-400/30 hover:text-white" data-close-voicemod-modal="true" aria-label="Fechar">&times;</button>
            </div>
            <div id="voicemod-request-feedback" class="mt-5 hidden rounded-[18px] border px-4 py-3 text-sm"></div>
            <div id="voicemod-active-state" class="mt-5 rounded-[22px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(8,18,24,0.96),rgba(10,14,18,0.96))] px-4 py-4 text-sm leading-7 text-white/62">
                ${activeReward
                  ? `Voz ativa agora: <strong class="text-white">${escapeHtml(activeReward.displayName)}</strong>. Tempo restante: <strong class="text-white">${escapeHtml(formatRemainingMs(activeReward.remainingMs))}</strong>.`
                  : "Nenhuma voz ativa no momento. Escolha uma voz abaixo para aplicar agora ou entrar na fila."}
            </div>
            <div class="mt-5 rounded-[24px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(10,18,24,0.96),rgba(8,12,18,0.96))] p-4">
              <div class="flex items-center justify-between gap-3">
                <span class="section-kicker text-[10px] font-semibold uppercase text-cyan-100/72">Lista de vozes</span>
                <span class="text-[11px] text-white/42">${voiceRewards.length ? `${voiceRewards.length} opcoes` : "Sem opcoes"}</span>
              </div>
              <div id="voicemod-voice-list" class="scrollbar-fire mt-3 max-h-[24rem] overflow-y-auto pr-1">
                ${renderVoicemodVoiceGrid(voiceRewards)}
              </div>
              <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-sm leading-7 text-white/48">Selecione uma voz e confirme. Se ja houver uma ativa, seu pedido guarda a posicao automaticamente.</p>
                <button type="button" id="voicemod-request-submit" class="inline-flex items-center justify-center rounded-[18px] bg-gradient-to-r from-cyan-300 via-sky-400 to-sky-600 px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50" data-voice-id="" data-voice-name="" data-voice-state="" disabled>${voiceRewards.length ? "Escolha uma voz" : "Nenhuma voz disponivel"}</button>
              </div>
            </div>
            <div id="voicemod-queue-state" class="mt-4 rounded-[22px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(8,18,24,0.96),rgba(10,14,18,0.96))] px-4 py-4 text-sm leading-7 text-white/62">
              ${renderVoicemodQueueMarkup(queueItems)}
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderVoicemodRewardScript(
  reward: WebProfilePayload["rewards"][number] | null,
  queueItems: WebProfilePayload["voicemodQueue"]
) {
  if (!reward) {
    return "";
  }

  return `
    <script>
      (() => {
        const modal = document.getElementById("voicemod-request-modal");
        const rewardCard = document.getElementById("reward-card-voicemod");
        const feedback = document.getElementById("voicemod-request-feedback");
        const activeState = document.getElementById("voicemod-active-state");
        const queueState = document.getElementById("voicemod-queue-state");
        const voiceList = document.getElementById("voicemod-voice-list");
        const menuItems = Array.from(document.querySelectorAll(".voicemod-menu-item"));
        const submitButton = document.getElementById("voicemod-request-submit");
        const balanceValue = document.getElementById("profile-balance-value");
        const closers = Array.from(document.querySelectorAll("[data-close-voicemod-modal='true']"));
        const rewardBadge = document.querySelector('[data-reward-badge="voicemod"]');
        const rewardCost = document.querySelector('[data-reward-cost="voicemod"]');
        const rewardState = document.querySelector('[data-reward-state="voicemod"]');
        const rewardAction = document.querySelector('[data-reward-action="voicemod"]');
        const rewardOrb = document.querySelector('[data-reward-orb="voicemod"]');
        const firecoinIcon = ${JSON.stringify(FIRECOIN_ICON_URL)};
        let requestCost = ${reward.cost};

        function escapeClientHtml(value) {
          return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        }

        function firecoinMarkup(amount) {
          return '<span class="inline-flex items-center gap-2"><img src="' + firecoinIcon + '" alt="Firecoin" class="h-4 w-4 rounded-full object-cover" /><span>' + amount + "</span></span>";
        }

        function uniqueValues(values) {
          const result = [];
          for (const value of values) {
            if (typeof value === "string" && value && !result.includes(value)) {
              result.push(value);
            }
          }
          return result;
        }

        function parseImageCandidates(value) {
          if (typeof value !== "string" || !value) {
            return [];
          }

          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item) : [];
          } catch {
            return [];
          }
        }

        function buildPlaceholderLabel(name) {
          return String(name || "VO")
            .split(/\\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => (part[0] || "").toUpperCase())
            .join("") || "VO";
        }

        function applyVoiceImage(button, preferSelected) {
          if (!(button instanceof HTMLElement)) {
            return;
          }

          const imageNode = button.querySelector(".voicemod-voice-image");
          const placeholderNode = button.querySelector(".voicemod-voice-placeholder");
          const baseCandidates = parseImageCandidates(button.dataset.voiceImages);
          const selectedCandidates = parseImageCandidates(button.dataset.voiceSelectedImages);
          const candidates = uniqueValues(preferSelected ? [...selectedCandidates, ...baseCandidates] : [...baseCandidates, ...selectedCandidates]);

          if (!(imageNode instanceof HTMLImageElement) || !(placeholderNode instanceof HTMLElement)) {
            return;
          }

          const showPlaceholder = () => {
            imageNode.classList.add("hidden");
            imageNode.removeAttribute("src");
            if (placeholderNode instanceof HTMLElement) {
              placeholderNode.textContent = buildPlaceholderLabel(button.dataset.voiceName || "VO");
              placeholderNode.classList.remove("hidden");
            }
          };

          if (!candidates.length) {
            showPlaceholder();
            return;
          }

          let candidateIndex = 0;
          const applyCandidate = () => {
            const candidate = candidates[candidateIndex];
            if (!candidate) {
              showPlaceholder();
              return;
            }

            if (placeholderNode instanceof HTMLElement) {
              placeholderNode.classList.add("hidden");
            }
            imageNode.classList.remove("hidden");
            imageNode.src = candidate;
          };

          imageNode.onerror = () => {
            candidateIndex += 1;
            if (candidateIndex >= candidates.length) {
              imageNode.onerror = null;
              showPlaceholder();
              return;
            }
            applyCandidate();
          };

          applyCandidate();
        }

        function formatRemaining(value) {
          const remainingMs = Math.max(0, new Date(value).getTime() - Date.now());
          const totalSeconds = Math.ceil(remainingMs / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
        }

        function formatQueueTime(value) {
          if (!value) {
            return "Aguardando";
          }

          try {
            return new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short"
            }).format(new Date(value));
          } catch {
            return "Aguardando";
          }
        }

        function queueMarkup(queueItems) {
          if (!Array.isArray(queueItems) || !queueItems.length) {
            return '<p class="text-sm leading-7 text-white/54">Nenhuma voz aguardando na fila.</p>';
          }

          return '<div>' +
            '<div class="flex items-center justify-between gap-3">' +
              '<strong class="text-sm font-semibold text-white">Fila atual</strong>' +
              '<span class="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">' + queueItems.length + ' aguardando</span>' +
            '</div>' +
            '<ul class="mt-4 grid gap-3 sm:grid-cols-2">' +
              queueItems.map((item) => (
                '<li class="rounded-[18px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(8,18,24,0.96),rgba(10,14,18,0.96))] px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.24)]">' +
                  '<div class="flex items-start justify-between gap-3">' +
                    '<div class="min-w-0">' +
                      '<span class="section-kicker text-[10px] font-semibold uppercase text-cyan-100/70">fila ' + escapeClientHtml(item.position) + '</span>' +
                      '<strong class="mt-2 block truncate text-sm font-semibold text-white">' + escapeClientHtml(item.displayName || "Voz") + '</strong>' +
                    '</div>' +
                    '<span class="text-[11px] text-white/42">' + escapeClientHtml(formatQueueTime(item.createdAt)) + '</span>' +
                  '</div>' +
                '</li>'
              )).join("") +
            '</ul>' +
          '</div>';
        }

        function voiceGridMarkup(voices) {
          return '<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">' + (
            Array.isArray(voices) && voices.length
              ? voices.map((voice) => (
                '<button type="button" class="voicemod-menu-item group relative aspect-[0.76] overflow-hidden rounded-[18px] border ' + (voice.enabled ? 'border-cyan-400/10 bg-[linear-gradient(180deg,rgba(10,24,32,0.82),rgba(8,12,18,0.96))] hover:border-cyan-400/24' : 'border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-60 grayscale') + ' text-left transition" data-voice-id="' + escapeClientHtml(voice.id) + '" data-voice-name="' + escapeClientHtml(voice.title) + '" data-voice-state="' + (voice.isActive ? "active" : voice.isQueued ? "queued" : "available") + '" data-voice-enabled="' + (voice.enabled ? 'true' : 'false') + '" data-voice-images=\\'' + escapeClientHtml(JSON.stringify(Array.isArray(voice.imageCandidates) ? voice.imageCandidates : [])) + '\\' data-voice-selected-images=\\'' + escapeClientHtml(JSON.stringify(Array.isArray(voice.selectedImageCandidates) ? voice.selectedImageCandidates : [])) + '\\'>' +
                  ((voice.thumbnailUrl || voice.selectedThumbnailUrl || voice.fallbackThumbnailUrl)
                    ? '<img src="' + escapeClientHtml(voice.thumbnailUrl || voice.selectedThumbnailUrl || voice.fallbackThumbnailUrl) + '" alt="' + escapeClientHtml(voice.title) + '" class="voicemod-voice-image absolute inset-0 h-full w-full object-cover" />'
                    : '<img src="" alt="' + escapeClientHtml(voice.title) + '" class="voicemod-voice-image hidden absolute inset-0 h-full w-full object-cover" />') +
                  '<span class="' + ((voice.thumbnailUrl || voice.selectedThumbnailUrl || voice.fallbackThumbnailUrl) ? 'voicemod-voice-placeholder hidden' : 'voicemod-voice-placeholder') + ' absolute inset-0 flex items-center justify-center bg-cyan-950/80 text-lg font-semibold uppercase tracking-[0.22em] text-cyan-100/72">' + escapeClientHtml(buildPlaceholderLabel(voice.title)) + '</span>' +
                  '<span class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10"></span>' +
                  '<span class="relative flex h-full flex-col justify-end p-3">' +
                    '<strong class="block truncate text-sm font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">' + escapeClientHtml(voice.title) + '</strong>' +
                    '<span class="mt-1 block text-[11px] text-white/78 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">' + (!voice.enabled ? "Desativada no agent" : voice.isActive ? "Tocando agora" : voice.isQueued ? "Ja entrou na fila" : "Disponivel para resgate") + '</span>' +
                    '<span class="mt-2 inline-flex w-fit rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase backdrop-blur-sm ' + (!voice.enabled ? "text-white/58" : voice.isActive ? "text-cyan-100" : voice.isQueued ? "text-amber-100" : "text-emerald-200") + '">' + (!voice.enabled ? "Inativa" : voice.isActive ? "Ao vivo" : voice.isQueued ? "Na fila" : "Livre") + '</span>' +
                  '</span>' +
                '</button>'
              )).join("")
              : '<p class="rounded-[18px] border border-cyan-400/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">Nenhuma voz sincronizada pelo agent no momento.</p>'
          ) + '</div>';
        }

        function activeMarkup(activeReward) {
          if (activeReward && activeReward.displayName) {
            const remaining = activeReward.expiresAt ? formatRemaining(activeReward.expiresAt) : "05:00";
            return 'Voz ativa agora: <strong class="text-white">' + escapeClientHtml(activeReward.displayName) + '</strong>. Tempo restante: <strong class="text-white">' + escapeClientHtml(remaining) + '</strong>.';
          }

          return "Nenhuma voz ativa no momento. Escolha uma voz abaixo para aplicar agora ou entrar na fila.";
        }

        function getRewardStateLabel(rewardPayload, activeReward, queueItems) {
          if (activeReward) {
            const queuedCount = (Array.isArray(queueItems) && queueItems.length) || 0;
            return "Voz ativa" + (queuedCount ? " +" + queuedCount + " na fila" : "");
          }

          if (Array.isArray(queueItems) && queueItems.length) {
            return queueItems.length + " na fila";
          }

          if (!rewardPayload || !rewardPayload.enabled) {
            return "Indisponivel";
          }

          return rewardPayload.affordable ? "Pronto para escolher" : "Saldo insuficiente";
        }

        function setFeedback(message, type) {
          if (!feedback) return;
          feedback.textContent = message;
          feedback.className = "mt-5 rounded-[18px] border px-4 py-3 text-sm";
          feedback.classList.remove("hidden");
          if (type === "success") {
            feedback.classList.add("border-emerald-400/30", "bg-emerald-400/10", "text-emerald-200");
          } else {
            feedback.classList.add("border-red-400/30", "bg-red-400/10", "text-red-200");
          }
        }

        function clearFeedback() {
          if (!feedback) return;
          feedback.textContent = "";
          feedback.className = "mt-5 hidden rounded-[18px] border px-4 py-3 text-sm";
        }

        function resetVoiceSelection() {
          for (const item of Array.from(document.querySelectorAll(".voicemod-menu-item"))) {
            item.classList.remove("border-cyan-400/30", "bg-cyan-500/10");
            if (item.getAttribute("data-voice-enabled") === "true") {
              item.classList.add("border-cyan-400/10");
              item.classList.remove("border-white/8");
            } else {
              item.classList.add("border-white/8");
              item.classList.remove("border-cyan-400/10");
            }
            item.classList.remove("bg-white/[0.03]");
            applyVoiceImage(item, false);
          }

          if (submitButton instanceof HTMLButtonElement) {
            submitButton.dataset.voiceId = "";
            submitButton.dataset.voiceName = "";
            submitButton.dataset.voiceState = "";
            submitButton.disabled = true;
            submitButton.textContent = menuItems.length ? "Escolha uma voz" : "Nenhuma voz disponivel";
          }
        }

        function isModalOpen() {
          return Boolean(modal && !modal.classList.contains("hidden"));
        }

        async function syncCatalog() {
          try {
            await fetch("/api/voicemod/catalog/sync", {
              method: "POST",
              credentials: "same-origin"
            });
          } catch {
          } finally {
            window.__vulkanProfileSync?.refresh?.();
          }
        }

        function openModal() {
          if (!modal || rewardCard?.getAttribute("data-open-voicemod-modal") !== "true") return;
          modal.classList.remove("hidden");
          document.body.style.overflow = "hidden";
          clearFeedback();
          resetVoiceSelection();
          void syncCatalog();
        }

        function closeModal() {
          if (!modal) return;
          modal.classList.add("hidden");
          document.body.style.overflow = "";
        }

        function selectVoice(button) {
          if (!(button instanceof HTMLButtonElement)) {
            return;
          }

          if (button.dataset.voiceEnabled !== "true") {
            if (submitButton instanceof HTMLButtonElement) {
              submitButton.disabled = true;
            }
            setFeedback("Essa voz foi marcada como desativada pelo agent e nao pode ser selecionada agora.", "error");
            return;
          }

          clearFeedback();

          for (const item of menuItems) {
            item.classList.remove("border-cyan-400/30", "bg-cyan-500/10");
            if (item.getAttribute("data-voice-enabled") === "true") {
              item.classList.add("border-cyan-400/10");
              item.classList.remove("border-white/8");
            } else {
              item.classList.add("border-white/8");
              item.classList.remove("border-cyan-400/10");
            }
            item.classList.remove("bg-white/[0.03]");
            applyVoiceImage(item, false);
          }

          button.classList.remove("border-white/8", "border-cyan-400/10");
          button.classList.add("border-cyan-400/30", "bg-cyan-500/10");
          applyVoiceImage(button, true);

          const voiceName = button.dataset.voiceName || "voz";
          const voiceId = button.dataset.voiceId || "";
          const voiceState = button.dataset.voiceState || "available";

          if (submitButton instanceof HTMLButtonElement) {
            submitButton.dataset.voiceId = voiceId;
            submitButton.dataset.voiceName = voiceName;
            submitButton.dataset.voiceState = voiceState;
            submitButton.disabled = !voiceId;
            submitButton.textContent = voiceState === "active" ? "Colocar de novo na fila" : voiceState === "queued" ? "Entrar novamente na fila" : "Confirmar voz";
          }

        }

        async function redeemVoice(button) {
          const rewardId = button.getAttribute("data-voice-id");
          const rewardName = button.getAttribute("data-voice-name") || "voz";
          if (!rewardId) {
            return;
          }

          button.disabled = true;
          button.textContent = "Enviando...";

          try {
            const response = await fetch("/api/rewards/redeem", {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "content-type": "application/json"
              },
              body: JSON.stringify({
                rewardId,
                rewardType: "voicemod_voice"
              })
            });

            const payload = await response.json();
            if (!response.ok) {
              setFeedback(payload.message || "Falha ao resgatar a voz.", "error");
              return;
            }

            if (balanceValue && typeof payload.balanceAfter === "number") {
              balanceValue.textContent = String(payload.balanceAfter);
            }

            if (payload.redeem?.status === "active") {
              const expiresAt = payload.redeem?.expiresAt
                ? new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(payload.redeem.expiresAt))
                : "alguns minutos";

              if (activeState) {
                activeState.innerHTML = 'Voz ativa agora: <strong class="text-white">' + escapeClientHtml(rewardName) + '</strong> ate <strong class="text-white">' + escapeClientHtml(expiresAt) + '</strong>.';
              }

               setFeedback("Voz aplicada com sucesso: " + rewardName + ". Custo: " + requestCost + " Firecoins.", "success");
            } else {
              if (queueState) {
                const nextQueue = Array.isArray(window.__vulkanVoicemodProfile?.queueItems)
                  ? window.__vulkanVoicemodProfile.queueItems.slice()
                  : [];
                nextQueue.push({
                  displayName: rewardName,
                  position: Number(payload.redeem?.queuePosition || nextQueue.length + 1),
                  createdAt: new Date().toISOString()
                });
                queueState.innerHTML = queueMarkup(nextQueue);
              }

               setFeedback("Pedido confirmado: " + rewardName + " entrou na fila na posicao " + (payload.redeem?.queuePosition || 1) + ".", "success");
            }
            window.__vulkanProfileSync?.refresh?.();
          } catch {
            setFeedback("Falha ao resgatar a voz.", "error");
          } finally {
            button.disabled = false;
            button.textContent = button.dataset.voiceState === "active" ? "Colocar de novo na fila" : button.dataset.voiceState === "queued" ? "Entrar novamente na fila" : "Confirmar voz";
          }
        }

        function applyReward(rewardPayload, activeReward, queueItems) {
          if (!rewardCard || !rewardPayload) {
            return;
          }

          const clickable = Boolean(rewardPayload.enabled && rewardPayload.status === "available");
          rewardCard.className = "${REWARD_CARD_BASE_CLASS} " + (
            clickable
              ? "cursor-pointer border-cyan-400/16 bg-[radial-gradient(circle_at_88%_50%,rgba(93,239,255,0.12),transparent_0_24%),linear-gradient(180deg,rgba(10,21,28,0.98),rgba(9,16,22,0.98))] hover:border-cyan-400/28 hover:-translate-y-0.5"
              : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"
          );

          rewardCard.setAttribute("data-open-voicemod-modal", clickable ? "true" : "false");
          if (clickable) {
            rewardCard.setAttribute("role", "button");
            rewardCard.setAttribute("tabindex", "0");
            rewardCard.removeAttribute("aria-disabled");
          } else {
            rewardCard.removeAttribute("role");
            rewardCard.removeAttribute("tabindex");
            rewardCard.setAttribute("aria-disabled", "true");
          }

          if (rewardBadge) {
            rewardBadge.className = "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] " + (
              clickable
                ? "border-cyan-400/24 bg-cyan-500/10 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-white/54"
            );
          }

          if (rewardCost) {
            rewardCost.innerHTML = firecoinMarkup(rewardPayload.cost);
          }

          if (rewardState) {
            rewardState.textContent = getRewardStateLabel(rewardPayload, activeReward, queueItems);
            rewardState.className = "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold " + (
              activeReward || (Array.isArray(queueItems) && queueItems.length)
                ? "bg-cyan-500/12 text-cyan-200"
                : !rewardPayload.enabled
                  ? "bg-white/[0.04] text-white/52"
                  : rewardPayload.affordable
                    ? "bg-emerald-400/12 text-emerald-300"
                    : "bg-ember-500/10 text-amber-200"
            );
          }

          if (rewardAction) {
            rewardAction.textContent = clickable ? "Abrir vozes" : "Indisponivel";
            rewardAction.className = "text-[11px] font-semibold uppercase tracking-[0.16em] " + (
              clickable ? "text-cyan-100/76" : "text-white/42"
            );
          }

          if (rewardOrb) {
            rewardOrb.className = "hidden";
          }

          const titleNode = rewardCard.querySelector('[data-reward-title="voicemod"]');
          const descriptionNode = rewardCard.querySelector('[data-reward-description="voicemod"]');
          const activeNode = rewardCard.querySelector('[data-voicemod-active-inline]');
          const queueNode = rewardCard.querySelector('[data-voicemod-queue-inline]');
          if (titleNode) {
            titleNode.textContent = rewardPayload.title;
          }
          if (descriptionNode) {
            descriptionNode.textContent = rewardPayload.description;
          }
          if (activeNode) {
            activeNode.innerHTML = activeReward
              ? 'Ativa agora: <strong class="text-white">' + escapeClientHtml(activeReward.displayName) + '</strong> por mais <strong class="text-white">' + escapeClientHtml(formatRemaining(activeReward.expiresAt)) + "</strong>."
              : "Nenhuma voz ativa no momento.";
          }
          if (queueNode) {
            queueNode.textContent = Array.isArray(queueItems) && queueItems.length
              ? (queueItems.length === 1 ? "1 voz aguardando na fila." : queueItems.length + " vozes aguardando na fila.")
              : "Ao confirmar, a voz entra na fila automaticamente se outra ja estiver ativa.";
          }
        }

        function applySnapshot(snapshot) {
          if (!snapshot) {
            return;
          }

          const currentSelectedVoiceId = submitButton instanceof HTMLButtonElement
            ? (submitButton.dataset.voiceId || "")
            : "";

          requestCost = typeof snapshot.reward?.cost === "number" ? snapshot.reward.cost : requestCost;
          if (activeState) {
            activeState.innerHTML = activeMarkup(snapshot.activeReward);
          }
          if (queueState) {
            queueState.innerHTML = queueMarkup(snapshot.queueItems);
          }
          if (Array.isArray(snapshot.voices) && voiceList) {
            voiceList.innerHTML = voiceGridMarkup(snapshot.voices);
          }

          window.__vulkanVoicemodProfile.queueItems = Array.isArray(snapshot.queueItems) ? snapshot.queueItems : [];
          applyReward(snapshot.reward, snapshot.activeReward, snapshot.queueItems);

          const nextMenuItems = Array.from(document.querySelectorAll(".voicemod-menu-item"));
          for (const button of nextMenuItems) {
            applyVoiceImage(button, false);
            button.addEventListener("click", () => {
              selectVoice(button);
            });
          }
          menuItems.splice(0, menuItems.length, ...nextMenuItems);

          if (isModalOpen() && currentSelectedVoiceId) {
            const selectedButton = nextMenuItems.find((button) => (
              button instanceof HTMLButtonElement &&
              button.dataset.voiceId === currentSelectedVoiceId
            ));

            if (selectedButton instanceof HTMLButtonElement) {
              selectVoice(selectedButton);
              return;
            }
          }

          if (!isModalOpen()) {
            resetVoiceSelection();
          }
        }

        if (rewardCard) {
          rewardCard.addEventListener("click", () => {
            if (rewardCard.getAttribute("data-open-voicemod-modal") === "true") {
              openModal();
            }
          });
          rewardCard.addEventListener("keydown", (event) => {
            if (!(event instanceof KeyboardEvent)) {
              return;
            }

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (rewardCard.getAttribute("data-open-voicemod-modal") === "true") {
                openModal();
              }
            }
          });
        }

        for (const closer of closers) {
          closer.addEventListener("click", closeModal);
        }

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
            closeModal();
          }
        });

        for (const button of menuItems) {
          button.addEventListener("click", () => {
            selectVoice(button);
          });
        }

        if (submitButton instanceof HTMLButtonElement) {
          submitButton.addEventListener("click", () => {
            void redeemVoice(submitButton);
          });
        }

        resetVoiceSelection();

        window.__vulkanVoicemodProfile = {
          queueItems: ${JSON.stringify(queueItems)},
          applySnapshot,
          openModal,
          closeModal
        };
      })();
    </script>
  `;
}

function renderSoundAlertRequestModal(
  reward: WebProfilePayload["rewards"][number] | null,
  soundAlerts: WebProfilePayload["voicemodSoundAlerts"],
  soundboard: WebProfilePayload["voicemodSoundboard"],
) {
  if (!reward) {
    return "";
  }

  return `
    <div id="soundalert-request-modal" class="fixed inset-0 z-50 hidden">
      <div class="absolute inset-0 bg-[#030509]/90 backdrop-blur-md" data-close-soundalert-modal="true"></div>
      <div class="relative flex min-h-screen items-center justify-center p-4">
        <section class="site-panel noise-mask relative w-full max-w-4xl overflow-hidden rounded-[34px] border border-cyan-400/20 p-6 shadow-[0_32px_90px_rgba(0,0,0,0.72)] sm:p-8">
          <div class="absolute left-[-2rem] top-[-2rem] h-32 w-32 rounded-full bg-cyan-400/16 blur-2xl"></div>
          <div class="absolute right-[-1rem] top-[10%] h-24 w-24 rounded-full bg-sky-300/12 blur-2xl"></div>
          <div class="relative">
            <div class="flex items-start justify-between gap-4">
              <div>
                <span class="section-kicker text-[10px] font-semibold uppercase text-cyan-100/76">Sound Alerts</span>
                <h2 class="hero-title mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Escolha um sound alert do Vulkan Agent</h2>
                <p class="mt-3 max-w-2xl text-sm leading-7 text-white/58">Cada teste usa o catalogo sincronizado do agent. Selecione um sound alert abaixo e confirme para disparar o som com voicemod.playSound.</p>
              </div>
              <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xl text-white/72 transition hover:border-cyan-400/30 hover:text-white" data-close-soundalert-modal="true" aria-label="Fechar">&times;</button>
            </div>
            <div id="soundalert-request-feedback" class="mt-5 hidden rounded-[18px] border px-4 py-3 text-sm"></div>
            <div id="soundalert-active-state" class="mt-5 rounded-[22px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(8,18,24,0.96),rgba(10,14,18,0.96))] px-4 py-4 text-sm leading-7 text-white/62">
              ${soundboard?.name
                ? `Soundboard principal identificada: <strong class="text-white">${escapeHtml(soundboard.name)}</strong>. Escolha um sound alert abaixo para testar agora.`
                : "Nenhuma soundboard principal identificada no momento. Escolha um sound alert abaixo para testar agora."}
            </div>
            <div class="mt-5 rounded-[24px] border border-cyan-400/10 bg-[linear-gradient(180deg,rgba(10,18,24,0.96),rgba(8,12,18,0.96))] p-4">
              <div class="flex items-center justify-between gap-3">
                <span class="section-kicker text-[10px] font-semibold uppercase text-cyan-100/72">Lista de sounds</span>
                <span class="text-[11px] text-white/42">${soundAlerts.length ? `${soundAlerts.length} itens` : "Sem itens"}</span>
              </div>
              <div id="soundalert-list" class="scrollbar-fire mt-3 max-h-[24rem] overflow-y-auto pr-1">
                ${renderVoicemodSoundAlertList(soundAlerts, soundboard)}
              </div>
              <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-sm leading-7 text-white/48">Selecione um sound alert e confirme para tocar o som imediatamente no agent conectado.</p>
                <span class="inline-flex items-center justify-center rounded-[18px] border border-cyan-400/14 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100/82">${soundAlerts.length ? "Clique no card para testar" : "Nenhum sound disponivel"}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderSoundAlertRewardScript(
  reward: WebProfilePayload["rewards"][number] | null,
  soundboard: WebProfilePayload["voicemodSoundboard"],
  soundAlerts: WebProfilePayload["voicemodSoundAlerts"],
) {
  if (!reward) {
    return "";
  }

  return `
    <script>
      (() => {
        const modal = document.getElementById("soundalert-request-modal");
        const rewardCard = document.getElementById("reward-card-soundalert");
        const feedback = document.getElementById("soundalert-request-feedback");
        const activeState = document.getElementById("soundalert-active-state");
        const soundAlertList = document.getElementById("soundalert-list");
        const closers = Array.from(document.querySelectorAll("[data-close-soundalert-modal='true']"));
        const rewardBadge = document.querySelector('[data-reward-badge="soundalert"]');
        const rewardCost = document.querySelector('[data-reward-cost="soundalert"]');
        const rewardState = document.querySelector('[data-reward-state="soundalert"]');
        const rewardAction = document.querySelector('[data-reward-action="soundalert"]');
        const rewardOrb = document.querySelector('[data-reward-orb="soundalert"]');
        const balanceValue = document.getElementById("profile-balance-value");
        const firecoinIcon = ${JSON.stringify(FIRECOIN_ICON_URL)};

        function escapeClientHtml(value) {
          return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        }

        function firecoinMarkup(amount) {
          return '<span class="inline-flex items-center gap-2"><img src="' + firecoinIcon + '" alt="Firecoin" class="h-4 w-4 rounded-full object-cover" /><span>' + amount + "</span></span>";
        }

        function setFeedback(message, type) {
          if (!feedback) return;
          feedback.textContent = message;
          feedback.className = "mt-5 rounded-[18px] border px-4 py-3 text-sm";
          feedback.classList.remove("hidden");
          if (type === "success") {
            feedback.classList.add("border-emerald-400/30", "bg-emerald-400/10", "text-emerald-200");
          } else {
            feedback.classList.add("border-red-400/30", "bg-red-400/10", "text-red-200");
          }
        }

        function clearFeedback() {
          if (!feedback) return;
          feedback.textContent = "";
          feedback.className = "mt-5 hidden rounded-[18px] border px-4 py-3 text-sm";
        }

        function buildPlaceholderLabel(name) {
          return String(name || "SFX")
            .split(/\\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => (part[0] || "").toUpperCase())
            .join("") || "SFX";
        }

        function parseImageCandidates(value) {
          if (typeof value !== "string" || !value) {
            return [];
          }

          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item) : [];
          } catch {
            return [];
          }
        }

        function applySoundAlertImage(card) {
          if (!(card instanceof HTMLElement)) {
            return;
          }

          const imageNode = card.querySelector(".soundalert-image");
          const placeholderNode = card.querySelector(".soundalert-placeholder");
          const candidates = parseImageCandidates(card.dataset.soundImages);

          if (!(imageNode instanceof HTMLImageElement) || !(placeholderNode instanceof HTMLElement)) {
            return;
          }

          const showPlaceholder = () => {
            imageNode.classList.add("hidden");
            imageNode.removeAttribute("src");
            placeholderNode.textContent = buildPlaceholderLabel(card.dataset.soundName || "SFX");
            placeholderNode.classList.remove("hidden");
          };

          if (!candidates.length) {
            showPlaceholder();
            return;
          }

          let candidateIndex = 0;
          const applyCandidate = () => {
            const candidate = candidates[candidateIndex];
            if (!candidate) {
              showPlaceholder();
              return;
            }

            placeholderNode.classList.add("hidden");
            imageNode.classList.remove("hidden");
            imageNode.src = candidate;
          };

          imageNode.onerror = () => {
            candidateIndex += 1;
            if (candidateIndex >= candidates.length) {
              imageNode.onerror = null;
              showPlaceholder();
              return;
            }
            applyCandidate();
          };

          applyCandidate();
        }

        function soundAlertListMarkup(items, board) {
          if (!Array.isArray(items) || !items.length) {
            return '<p class="rounded-[18px] border border-cyan-400/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">Nenhum sound alert sincronizado pelo agent no momento.</p>';
          }

          return '<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">' + items.map((soundAlert) => (
            '<article class="soundalert-menu-item group relative aspect-[0.76] overflow-hidden rounded-[18px] border ' + (soundAlert.enabled ? 'border-cyan-400/10 bg-[linear-gradient(180deg,rgba(10,24,32,0.82),rgba(8,12,18,0.96))] hover:border-cyan-400/24' : 'border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-60 grayscale') + ' text-left transition" data-sound-id="' + escapeClientHtml(soundAlert.id) + '" data-sound-name="' + escapeClientHtml(soundAlert.title) + '" data-sound-enabled="' + (soundAlert.enabled ? 'true' : 'false') + '" data-sound-images=\\'' + escapeClientHtml(JSON.stringify(Array.isArray(soundAlert.imageCandidates) ? soundAlert.imageCandidates : [])) + '\\'>' +
              ((soundAlert.thumbnailUrl || soundAlert.fallbackThumbnailUrl)
                ? '<img src="' + escapeClientHtml(soundAlert.thumbnailUrl || soundAlert.fallbackThumbnailUrl) + '" alt="' + escapeClientHtml(soundAlert.title) + '" class="soundalert-image absolute inset-0 h-full w-full object-cover" />'
                : '<img src="" alt="' + escapeClientHtml(soundAlert.title) + '" class="soundalert-image hidden absolute inset-0 h-full w-full object-cover" />') +
              '<span class="' + ((soundAlert.thumbnailUrl || soundAlert.fallbackThumbnailUrl) ? 'soundalert-placeholder hidden' : 'soundalert-placeholder') + ' absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_30%,rgba(93,239,255,0.16),rgba(16,28,36,0.94)_68%)] text-lg font-semibold uppercase tracking-[0.22em] text-cyan-100/72">' + escapeClientHtml(buildPlaceholderLabel(soundAlert.title || "SFX")) + '</span>' +
              '<span class="absolute inset-0 bg-gradient-to-t from-black via-black/44 to-black/10"></span>' +
              '<span class="relative flex h-full flex-col justify-between p-3">' +
                '<span class="flex items-start justify-between gap-2">' +
                  ((soundAlert.soundboardName || board?.name)
                    ? '<span class="rounded-full border border-white/10 bg-black/32 px-2 py-1 text-[10px] font-semibold uppercase text-white/56">' + escapeClientHtml(soundAlert.soundboardName || board?.name || "") + '</span>'
                    : '<span></span>') +
                  '<span class="inline-flex rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase backdrop-blur-sm ' + (soundAlert.enabled ? 'text-emerald-200' : 'text-white/58') + '">' + (soundAlert.enabled ? 'Ativo' : 'Inativo') + '</span>' +
                '</span>' +
                '<span class="block">' +
                  '<strong class="block truncate text-sm font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">' + escapeClientHtml(soundAlert.title) + '</strong>' +
                  '<span class="mt-1 block text-[11px] text-white/78 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">' + escapeClientHtml(soundAlert.playbackMode || "PlayStop") + (soundAlert.loop ? ' • loop' : '') + (soundAlert.stopOtherSounds ? ' • para outros sons' : '') + '</span>' +
                '</span>' +
              '</span>' +
            '</article>'
          )).join("") + '</div>';
        }

        function activeMarkup(board) {
          return board?.name
            ? 'Soundboard principal identificada: <strong class="text-white">' + escapeClientHtml(board.name) + '</strong>. Escolha um sound alert abaixo para testar agora.'
            : "Nenhuma soundboard principal identificada no momento. Escolha um sound alert abaixo para testar agora.";
        }

        function applyReward(rewardPayload, items, board) {
          if (!rewardCard || !rewardPayload) {
            return;
          }

          const clickable = Boolean(rewardPayload.enabled && rewardPayload.status === "available");
          const enabledCount = Array.isArray(items) ? items.filter((item) => item && item.enabled).length : 0;

          rewardCard.className = "${REWARD_CARD_BASE_CLASS} " + (
            clickable
              ? "cursor-pointer border-amber-400/18 bg-[radial-gradient(circle_at_12%_22%,rgba(251,191,36,0.16),transparent_0_28%),linear-gradient(180deg,rgba(30,21,9,0.98),rgba(20,13,8,0.98))] hover:border-amber-400/30 hover:-translate-y-0.5"
              : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"
          );

          rewardCard.setAttribute("data-open-soundalert-modal", clickable ? "true" : "false");
          if (clickable) {
            rewardCard.setAttribute("role", "button");
            rewardCard.setAttribute("tabindex", "0");
            rewardCard.removeAttribute("aria-disabled");
          } else {
            rewardCard.removeAttribute("role");
            rewardCard.removeAttribute("tabindex");
            rewardCard.setAttribute("aria-disabled", "true");
          }

          if (rewardBadge) {
            rewardBadge.className = "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] " + (
              clickable ? "border-amber-400/24 bg-amber-500/10 text-amber-100" : "border-white/10 bg-white/[0.03] text-white/54"
            );
          }

          if (rewardCost) {
            rewardCost.innerHTML = firecoinMarkup(rewardPayload.cost);
          }

          if (rewardState) {
            rewardState.textContent = !rewardPayload.enabled ? "Indisponivel" : Array.isArray(items) && items.length ? (enabledCount + "/" + items.length + " ativos") : "Sem sounds";
            rewardState.className = "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold " + (
              clickable && Array.isArray(items) && items.length ? "bg-amber-500/12 text-amber-100" : "bg-white/[0.04] text-white/52"
            );
          }

          if (rewardAction) {
            rewardAction.textContent = clickable ? "Abrir sounds" : "Indisponivel";
            rewardAction.className = "text-[11px] font-semibold uppercase tracking-[0.16em] " + (
              clickable ? "text-amber-100/76" : "text-white/42"
            );
          }

          if (rewardOrb) {
            rewardOrb.className = "hidden";
          }

          const titleNode = rewardCard.querySelector('[data-reward-title="soundalert"]');
          const descriptionNode = rewardCard.querySelector('[data-reward-description="soundalert"]');
          const boardNode = rewardCard.querySelector('[data-soundalert-board-inline]');
          const countNode = rewardCard.querySelector('[data-soundalert-count-inline]');
          if (titleNode) {
            titleNode.textContent = rewardPayload.title;
          }
          if (descriptionNode) {
            descriptionNode.textContent = rewardPayload.description;
          }
          if (boardNode) {
            boardNode.textContent = board?.name ? "Soundboard atual: " + board.name + "." : "Nenhuma soundboard identificada no momento.";
          }
          if (countNode) {
            countNode.textContent = Array.isArray(items) && items.length
              ? items.length + " sound alerts sincronizados para teste."
              : "Nenhum sound alert sincronizado pelo agent.";
          }
        }

        async function testSoundAlert(button) {
          if (!(button instanceof HTMLButtonElement)) {
            return;
          }

          const rewardId = button.dataset.soundId || "";
          const rewardName = button.dataset.soundName || "sound alert";
          if (!rewardId) {
            return;
          }

          const previousLabel = button.textContent || "Testar som";
          button.disabled = true;
          button.textContent = "Tocando...";

          try {
            const response = await fetch("/api/rewards/redeem", {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "content-type": "application/json"
              },
              body: JSON.stringify({
                rewardId,
                rewardType: "voicemod_sounds"
              })
            });

            const payload = await response.json();
            if (!response.ok) {
              setFeedback(payload.message || "Falha ao tocar o sound alert.", "error");
              return;
            }

            if (balanceValue && typeof payload.balanceAfter === "number") {
              balanceValue.textContent = String(payload.balanceAfter);
            }

            const queueStatus = payload.queueStatus === "queued" ? "queued" : "active";
            const queuePosition = typeof payload.queuePosition === "number" ? payload.queuePosition : 0;
            const successMessage = queueStatus === "queued"
              ? "Sound alert entrou na fila: " + rewardName + ". Posicao: " + Math.max(queuePosition, 1) + ". Custo: " + ${reward.cost} + " Firecoins."
              : "Sound alert disparado: " + rewardName + ". Custo: " + ${reward.cost} + " Firecoins.";

            setFeedback(successMessage, "success");
            window.__vulkanProfileSync?.refresh?.();
          } catch {
            setFeedback("Falha ao tocar o sound alert.", "error");
          } finally {
            button.disabled = false;
            button.textContent = previousLabel;
          }
        }

        async function triggerSoundFromCard(item) {
          if (!(item instanceof HTMLElement)) {
            return;
          }

          if (item.dataset.soundEnabled !== "true") {
            setFeedback("Esse sound alert foi marcado como desativado pelo agent e nao pode ser testado agora.", "error");
            return;
          }

          clearFeedback();
          item.classList.add("border-cyan-400/30", "bg-cyan-500/10");
          window.setTimeout(() => {
            item.classList.remove("border-cyan-400/30", "bg-cyan-500/10");
          }, 220);

          const proxyButton = document.createElement("button");
          proxyButton.dataset.soundId = item.dataset.soundId || "";
          proxyButton.dataset.soundName = item.dataset.soundName || "sound alert";
          await testSoundAlert(proxyButton);
        }

        function attachSoundSelectionHandlers() {
          for (const item of Array.from(document.querySelectorAll(".soundalert-menu-item"))) {
            applySoundAlertImage(item);
            item.addEventListener("click", () => {
              void triggerSoundFromCard(item);
            });
          }
        }

        function isModalOpen() {
          return Boolean(modal && !modal.classList.contains("hidden"));
        }

        async function syncCatalog() {
          try {
            await fetch("/api/voicemod/catalog/sync", {
              method: "POST",
              credentials: "same-origin"
            });
          } catch {
          } finally {
            window.__vulkanProfileSync?.refresh?.();
          }
        }

        function openModal() {
          if (!modal || rewardCard?.getAttribute("data-open-soundalert-modal") !== "true") return;
          modal.classList.remove("hidden");
          document.body.style.overflow = "hidden";
          clearFeedback();
          void syncCatalog();
        }

        function closeModal() {
          if (!modal) return;
          modal.classList.add("hidden");
          document.body.style.overflow = "";
        }

        function applySnapshot(snapshot) {
          if (!snapshot) {
            return;
          }

          applyReward(snapshot.reward, snapshot.soundAlerts, snapshot.soundboard);
          if (activeState) {
            activeState.innerHTML = activeMarkup(snapshot.soundboard);
          }
          if (soundAlertList) {
            soundAlertList.innerHTML = soundAlertListMarkup(snapshot.soundAlerts, snapshot.soundboard);
            attachSoundSelectionHandlers();
          }
        }

        if (rewardCard) {
          rewardCard.addEventListener("click", () => {
            if (rewardCard.getAttribute("data-open-soundalert-modal") === "true") {
              openModal();
            }
          });
          rewardCard.addEventListener("keydown", (event) => {
            if (!(event instanceof KeyboardEvent)) {
              return;
            }

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (rewardCard.getAttribute("data-open-soundalert-modal") === "true") {
                openModal();
              }
            }
          });
        }

        for (const closer of closers) {
          closer.addEventListener("click", closeModal);
        }

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isModalOpen()) {
            closeModal();
          }
        });

        attachSoundSelectionHandlers();

        window.__vulkanSoundAlertProfile = {
          soundboard: ${JSON.stringify(soundboard)},
          soundAlerts: ${JSON.stringify(soundAlerts)},
          applySnapshot,
          openModal,
          closeModal
        };
      })();
    </script>
  `;
}

function renderRewardInteractionScript() {
  return `
    <script>
      (() => {
        const ACTIVE_SCALE = "scale(0.985)";
        const IDLE_SCALE = "";
        const ACTIVE_TRANSLATE = "translateY(1px)";
        const IDLE_TRANSLATE = "";
        const ACTIVE_SHADOW = "0 10px 26px rgba(0,0,0,0.34)";
        const IDLE_SHADOW = "";
        const CONFIRM_OUTLINE = "0 0 0 1px rgba(255,255,255,0.12), 0 0 0 6px rgba(255,255,255,0.05)";

        function isInteractiveRewardCard(card) {
          if (!(card instanceof HTMLElement)) {
            return false;
          }

          return card.getAttribute("role") === "button" ||
            card.getAttribute("data-open-spotify-modal") === "true" ||
            card.getAttribute("data-open-voicemod-modal") === "true" ||
            card.getAttribute("data-open-soundalert-modal") === "true" ||
            card.getAttribute("data-redeem-chaos") === "true" ||
            card.getAttribute("data-redeem-mouse-axes-invert") === "true";
        }

        function getRewardCard(target) {
          return target instanceof Element ? target.closest("[data-reward-card]") : null;
        }

        function openRewardModal(card) {
          if (!(card instanceof HTMLElement)) {
            return;
          }

          if (card.id === "reward-card-voicemod" && card.getAttribute("data-open-voicemod-modal") === "true") {
            if (typeof window.__vulkanVoicemodProfile?.openModal === "function") {
              window.__vulkanVoicemodProfile.openModal();
              return;
            }

            const modal = document.getElementById("voicemod-request-modal");
            if (modal) {
              modal.classList.remove("hidden");
              document.body.style.overflow = "hidden";
            }
            return;
          }

          if (card.id === "reward-card-soundalert" && card.getAttribute("data-open-soundalert-modal") === "true") {
            if (typeof window.__vulkanSoundAlertProfile?.openModal === "function") {
              window.__vulkanSoundAlertProfile.openModal();
              return;
            }

            const modal = document.getElementById("soundalert-request-modal");
            if (modal) {
              modal.classList.remove("hidden");
              document.body.style.overflow = "hidden";
            }
            return;
          }

          if (card.id === "reward-card-spotifyQueue" && card.getAttribute("data-open-spotify-modal") === "true") {
            const modal = document.getElementById("spotify-request-modal");
            if (modal) {
              modal.classList.remove("hidden");
              document.body.style.overflow = "hidden";
            }
          }
        }

        function applyPressedState(card) {
          if (!isInteractiveRewardCard(card)) {
            return;
          }

          card.style.transition = "transform 120ms ease, box-shadow 160ms ease, filter 160ms ease";
          card.style.transform = ACTIVE_SCALE + " " + ACTIVE_TRANSLATE;
          card.style.boxShadow = ACTIVE_SHADOW;
          card.style.filter = "brightness(1.04)";
        }

        function clearPressedState(card) {
          if (!(card instanceof HTMLElement)) {
            return;
          }

          card.style.transform = IDLE_SCALE;
          card.style.translate = IDLE_TRANSLATE;
          card.style.boxShadow = IDLE_SHADOW;
          card.style.filter = "";
        }

        function flashConfirmation(card) {
          if (!isInteractiveRewardCard(card)) {
            return;
          }

          clearPressedState(card);
          card.style.boxShadow = CONFIRM_OUTLINE;
          card.style.filter = "brightness(1.08)";
          window.setTimeout(() => {
            if (!(card instanceof HTMLElement)) {
              return;
            }
            card.style.boxShadow = IDLE_SHADOW;
            card.style.filter = "";
          }, 220);
        }

        document.addEventListener("pointerdown", (event) => {
          const card = getRewardCard(event.target);
          if (card instanceof HTMLElement) {
            applyPressedState(card);
          }
        });

        document.addEventListener("pointerup", (event) => {
          const card = getRewardCard(event.target);
          if (card instanceof HTMLElement) {
            clearPressedState(card);
          }
        });

        document.addEventListener("pointercancel", (event) => {
          const card = getRewardCard(event.target);
          if (card instanceof HTMLElement) {
            clearPressedState(card);
          }
        });

        document.addEventListener("pointerleave", (event) => {
          const card = getRewardCard(event.target);
          if (card instanceof HTMLElement) {
            clearPressedState(card);
          }
        }, true);

        document.addEventListener("click", (event) => {
          const card = getRewardCard(event.target);
          if (card instanceof HTMLElement) {
            flashConfirmation(card);
            openRewardModal(card);
          }
        });

        document.addEventListener("keydown", (event) => {
          if (!(event instanceof KeyboardEvent) || (event.key !== "Enter" && event.key !== " ")) {
            return;
          }

          const card = getRewardCard(event.target);
          if (card instanceof HTMLElement) {
            applyPressedState(card);
          }
        });

        document.addEventListener("keyup", (event) => {
          if (!(event instanceof KeyboardEvent) || (event.key !== "Enter" && event.key !== " ")) {
            return;
          }

          const card = getRewardCard(event.target);
          if (card instanceof HTMLElement) {
            flashConfirmation(card);
            openRewardModal(card);
          }
        });
      })();
    </script>
  `;
}

export function renderProfilePage(payload: WebProfilePayload) {
  const user = payload.user;
  const viewer = payload.viewer;
  const live = payload.live;
  const spotifyQueue = payload.spotifyQueue;
  const liveStartedAt = live.startedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(live.startedAt))
    : "Aguardando";

  if (!user) {
    const body = `
      <div class="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        ${renderSiteHeader({ active: "profile", viewerLabel: viewer?.twitchDisplayName ?? null })}
        <main class="mt-5 grid gap-5">
          <section class="site-panel noise-mask reveal-on-load relative overflow-hidden rounded-[36px] px-6 py-8 shadow-ember-xl sm:px-8 sm:py-10 lg:px-10">
            <div class="fire-orb right-[-3rem] top-[-2rem] h-40 w-40 bg-ember-500/26"></div>
            <div class="fire-orb left-[10%] bottom-[-2rem] h-28 w-28 bg-amber-400/14"></div>
            <div class="relative grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_340px] xl:items-center">
              <div>
                <span class="section-kicker inline-flex rounded-full border border-ember-400/18 bg-ember-500/10 px-3 py-1 text-[11px] font-semibold uppercase text-ember-100">Community profile</span>
                <h1 class="hero-title mt-5 max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl">Entre com a Twitch para liberar seu painel da live.</h1>
                <p class="mt-5 max-w-2xl text-[15px] leading-8 text-white/62">Aqui voce acompanha Firecoins, bonus ativos, tempo assistido, status da stream e resgates sem sair do mesmo fluxo visual.</p>
                <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a href="${buildProfileLoginUrl()}" class="glow-button inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-ember-400 to-ember-600 px-6 py-3.5 text-sm font-semibold text-black transition hover:scale-[1.01]">Entrar com Twitch</a>
                  <a href="/" class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white/82 transition hover:border-ember-400/28 hover:text-white">Voltar para a home</a>
                </div>
                ${viewer ? `<p class="mt-5 max-w-2xl text-sm leading-7 text-white/54">A sessao de <strong class="text-white">${escapeHtml(viewer.twitchDisplayName)}</strong> foi reconhecida, mas a conta ainda nao foi vinculada no banco. Use <strong class="text-white">/link</strong> no Discord para liberar o perfil completo.</p>` : ""}
              </div>
              <aside class="grid gap-4">
                <article class="site-panel-soft rounded-[30px] p-5">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">O que libera</span>
                  <ul class="mt-4 grid gap-3 text-sm leading-7 text-white/60">
                    <li class="rounded-[20px] border border-white/8 bg-black/18 px-4 py-3">Saldo e multiplicadores da conta.</li>
                    <li class="rounded-[20px] border border-white/8 bg-black/18 px-4 py-3">Status da live e fila do Spotify.</li>
                    <li class="rounded-[20px] border border-white/8 bg-black/18 px-4 py-3">Resgates e painel de moderacao, quando aplicavel.</li>
                  </ul>
                </article>
                <article class="site-panel-soft rounded-[30px] p-5">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Fluxo</span>
                  <p class="mt-3 text-sm leading-7 text-white/58">Voce conecta Twitch e Discord uma vez e depois acompanha sua jornada na live sem se perder.</p>
                </article>
              </aside>
            </div>
          </section>
        </main>
        ${renderSiteFooter()}
      </div>
    `;

    return getSiteDocument("Perfil | Vulkan Sentinel", body);
  }

  const activeBonuses = user.activeBonuses.length
    ? user.activeBonuses.map((bonus) => `<li class="rounded-[18px] border border-white/8 bg-black/18 px-4 py-3 text-sm text-white/76">${escapeHtml(bonus)}</li>`).join("")
    : `<li class="rounded-[18px] border border-white/8 bg-black/18 px-4 py-3 text-sm text-white/54">Nenhum bonus ativo no momento.</li>`;

  const spotifyReward = payload.rewards.find((reward) => reward.key === "spotifyQueue") ?? null;
  const voicemodReward = payload.rewards.find((reward) => reward.key === "voicemod") ?? null;
  const soundAlertReward = payload.rewards.find((reward) => reward.key === "soundalert") ?? null;
  const chaosReward = payload.rewards.find((reward) => reward.key === "chaos") ?? null;
  const mouseAxesInvertReward = payload.rewards.find((reward) => reward.key === "mouseAxesInvert") ?? null;
  const overlayHubMarkup = user.isModerator ? renderModeratorOverlayHubMarkup() : "";

  const moderatorPricingMarkup = user.isModerator
    ? `
        <section class="site-panel reveal-on-load rounded-[34px] p-6 sm:p-8">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Moderacao</span>
              <h2 class="hero-title mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Precos das recompensas</h2>
            </div>
            <p class="max-w-2xl text-sm leading-7 text-white/58">Lista compacta para ajuste rapido de preco e status.</p>
          </div>
          <div class="mt-6">
            ${renderModeratorModuleSettingsMarkup(payload)}
          </div>
          <div id="reward-price-feedback" class="mt-5 hidden rounded-[18px] border px-4 py-3 text-sm"></div>
          <div class="mt-6 grid gap-3">
            ${payload.rewardSettings.map((reward) => `
              <form class="reward-price-form rounded-[22px] border border-ember-400/10 bg-[linear-gradient(180deg,rgba(36,20,12,0.62),rgba(11,12,17,0.92))] px-4 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)]" data-reward-key="${escapeHtml(reward.key)}" data-reward-title="${escapeHtml(reward.title)}">
                <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
                  <div class="min-w-0 xl:w-[28%]">
                    <h3 class="truncate text-base font-semibold text-white">${escapeHtml(reward.title)}</h3>
                    <p class="mt-1 line-clamp-2 text-xs leading-6 text-white/56">${escapeHtml(reward.description)}</p>
                  </div>
                  <div class="flex items-center gap-2 xl:w-[16%] xl:justify-start">
                    <span class="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ember-100/76">${escapeHtml(reward.key)}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3 rounded-[16px] border border-ember-400/10 bg-black/16 px-3 py-2.5 xl:w-[20%]">
                    <span class="text-xs font-medium text-white/62">Status</span>
                    <button
                      type="button"
                      id="reward-enabled-toggle-${escapeHtml(reward.key)}"
                      data-toggle-reward="${escapeHtml(reward.key)}"
                      aria-pressed="${reward.enabled ? "true" : "false"}"
                      class="reward-enabled-toggle inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${reward.enabled ? "bg-emerald-400/14 text-emerald-200" : "bg-white/[0.06] text-white/52"}"
                    >
                      <span class="h-2.5 w-2.5 rounded-full ${reward.enabled ? "bg-emerald-300" : "bg-white/24"}"></span>
                      <span data-toggle-label="${escapeHtml(reward.key)}">${reward.enabled ? "Ativo" : "Inativo"}</span>
                    </button>
                    <input id="reward-enabled-${escapeHtml(reward.key)}" name="enabled" type="checkbox" ${reward.enabled ? "checked" : ""} class="hidden" />
                  </div>
                  <label class="flex items-center gap-3 xl:w-[18%]" for="reward-price-${escapeHtml(reward.key)}">
                    <span class="text-xs font-medium text-white/62">Preco</span>
                    <input id="reward-price-${escapeHtml(reward.key)}" name="cost" type="number" min="0" step="1" value="${reward.cost}" class="w-full rounded-[14px] border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-ember-400/40" />
                  </label>
                  <div class="xl:w-[12%] xl:text-right">
                    <button type="submit" class="glow-button inline-flex w-full items-center justify-center rounded-[14px] bg-gradient-to-r from-amber-300 via-ember-400 to-ember-600 px-4 py-2.5 text-sm font-semibold text-black transition hover:scale-[1.01] xl:w-auto">Salvar</button>
                  </div>
                </div>
                ${reward.key === "voicemod" ? `
                  <div class="mt-4 border-t border-cyan-400/10 pt-4">
                    <button type="button" class="flex w-full items-center justify-between gap-4 text-left" data-expand-toggle="voicemod" aria-expanded="false">
                      <span class="min-w-0">
                        <strong class="block text-sm font-semibold text-white">Controles da fila de voz</strong>
                        <span id="moderation-voicemod-summary" class="mt-1 block text-xs leading-6 text-white/54">${payload.activeVoicemodReward ? `Ativa: ${escapeHtml(payload.activeVoicemodReward.displayName)}` : payload.voicemodQueue.length ? `${payload.voicemodQueue.length} na fila` : "Sem voz ativa no momento"}</span>
                      </span>
                      <span class="text-lg text-cyan-100/72 transition" data-expand-icon="voicemod">+</span>
                    </button>
                    <div class="mt-4 hidden" data-expand-panel="voicemod">
                      <div id="moderation-voicemod-feedback" class="hidden rounded-[18px] border px-4 py-3 text-sm"></div>
                      <div class="grid gap-3">
                        <div class="rounded-[18px] border border-cyan-400/10 bg-black/16 px-4 py-3 text-sm text-white/62">
                          <div class="flex items-center justify-between gap-3">
                            <span>Voz atual</span>
                            <strong id="moderation-voicemod-active" class="text-white">${payload.activeVoicemodReward ? escapeHtml(payload.activeVoicemodReward.displayName) : "Nenhuma"}</strong>
                          </div>
                          <div class="mt-2 flex items-center justify-between gap-3">
                            <span>Fila pendente</span>
                            <strong id="moderation-voicemod-queue-count" class="text-white">${payload.voicemodQueue.length}</strong>
                          </div>
                          <div class="mt-2 flex items-center justify-between gap-3">
                            <span>Status</span>
                            <strong id="moderation-voicemod-pause-state" class="text-white">Rodando</strong>
                          </div>
                        </div>
                        <div class="grid gap-2 sm:grid-cols-3">
                          <button type="button" class="moderation-action rounded-[16px] border border-cyan-400/14 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400/28" data-control-target="voicemod" data-control-action="skip">Pular voz</button>
                          <button type="button" class="moderation-action rounded-[16px] border border-cyan-400/14 bg-black/18 px-4 py-3 text-sm font-semibold text-white/82 transition hover:border-cyan-400/28" data-control-target="voicemod" data-control-action="clear">Limpar fila</button>
                          <button type="button" class="moderation-action rounded-[16px] border border-cyan-400/14 bg-black/18 px-4 py-3 text-sm font-semibold text-white/82 transition hover:border-cyan-400/28" data-control-target="voicemod" data-control-action="pause-toggle" id="moderation-voicemod-pause-button">Pausar fila</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ` : ""}
                ${reward.key === "spotifyQueue" ? `
                  <div class="mt-4 border-t border-ember-400/10 pt-4">
                    <button type="button" class="flex w-full items-center justify-between gap-4 text-left" data-expand-toggle="spotify" aria-expanded="false">
                      <span class="min-w-0">
                        <strong class="block text-sm font-semibold text-white">Controles do player</strong>
                        <span id="moderation-spotify-summary" class="mt-1 block text-xs leading-6 text-white/54">${payload.spotifyQueue.currentTrack ? `Tocando: ${escapeHtml(payload.spotifyQueue.currentTrack.name)}` : payload.spotifyQueue.message ? escapeHtml(payload.spotifyQueue.message) : "Player sem musica ativa"}</span>
                      </span>
                      <span class="text-lg text-ember-100/72 transition" data-expand-icon="spotify">+</span>
                    </button>
                    <div class="mt-4 hidden" data-expand-panel="spotify">
                      <div id="moderation-spotify-feedback" class="hidden rounded-[18px] border px-4 py-3 text-sm"></div>
                      <div class="grid gap-3">
                        <div class="rounded-[18px] border border-ember-400/10 bg-black/16 px-4 py-3 text-sm text-white/62">
                          <div class="flex items-center justify-between gap-3">
                            <span>Faixa atual</span>
                            <strong id="moderation-spotify-active" class="text-white">${payload.spotifyQueue.currentTrack ? escapeHtml(payload.spotifyQueue.currentTrack.name) : "Nenhuma"}</strong>
                          </div>
                          <div class="mt-2 flex items-center justify-between gap-3">
                            <span>Fila visivel</span>
                            <strong id="moderation-spotify-queue-count" class="text-white">${payload.spotifyQueue.tracks.length}</strong>
                          </div>
                          <div class="mt-2 flex items-center justify-between gap-3">
                            <span>Recurso limpar fila</span>
                            <strong class="text-white/68">Indisponivel na API</strong>
                          </div>
                        </div>
                        <div class="grid gap-2 sm:grid-cols-3">
                          <button type="button" class="moderation-action rounded-[16px] border border-ember-400/14 bg-ember-500/10 px-4 py-3 text-sm font-semibold text-ember-100 transition hover:border-ember-400/28" data-control-target="spotify" data-control-action="skip">Pular musica</button>
                          <button type="button" class="moderation-action rounded-[16px] border border-white/10 bg-black/18 px-4 py-3 text-sm font-semibold text-white/48" data-control-target="spotify" data-control-action="clear">Limpar fila</button>
                          <button type="button" class="moderation-action rounded-[16px] border border-ember-400/14 bg-black/18 px-4 py-3 text-sm font-semibold text-white/82 transition hover:border-ember-400/28" data-control-target="spotify" data-control-action="pause-toggle" id="moderation-spotify-pause-button">Pausar player</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ` : ""}
                ${reward.key === "chaos" ? `
                  <div class="mt-4 border-t border-fuchsia-400/10 pt-4">
                    <button type="button" class="flex w-full items-center justify-between gap-4 text-left" data-expand-toggle="chaos" aria-expanded="false">
                      <span class="min-w-0">
                        <strong class="block text-sm font-semibold text-white">Estado do embaralhamento do teclado</strong>
                        <span id="moderation-chaos-summary" class="mt-1 block text-xs leading-6 text-white/54">Estado atual: ${escapeHtml(getControlsInvertStateLabel(payload.controlsInvertEffect))}</span>
                      </span>
                      <span class="text-lg text-fuchsia-100/72 transition" data-expand-icon="chaos">+</span>
                    </button>
                    <div class="mt-4 hidden" data-expand-panel="chaos">
                      <div class="rounded-[18px] border border-fuchsia-400/10 bg-black/16 px-4 py-3 text-sm text-white/62">
                        <div class="flex items-center justify-between gap-3">
                          <span>Estado Sentinel</span>
                          <strong id="moderation-chaos-state" class="text-white">${escapeHtml(getControlsInvertStateLabel(payload.controlsInvertEffect))}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Estado Agent</span>
                          <strong id="moderation-chaos-agent-state" class="text-white">${escapeHtml(getControlsInvertStateLabel({ ...payload.controlsInvertEffect, state: payload.controlsInvertEffect.agentState }))}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Agent</span>
                          <strong id="moderation-chaos-agent" class="text-white">${escapeHtml(payload.controlsInvertEffect.agentId ?? "Nenhum")}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Session ID</span>
                          <strong id="moderation-chaos-session" class="text-white">${escapeHtml(payload.controlsInvertEffect.sessionId ?? "Nenhuma")}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Iniciado em</span>
                          <strong id="moderation-chaos-started-at" class="text-white">${escapeHtml(payload.controlsInvertEffect.startedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(payload.controlsInvertEffect.startedAt)) : "Nao iniciado")}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Pausado em</span>
                          <strong id="moderation-chaos-paused-at" class="text-white">${escapeHtml(payload.controlsInvertEffect.pausedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(payload.controlsInvertEffect.pausedAt)) : "Nao pausado")}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Expira em</span>
                          <strong id="moderation-chaos-expires-at" class="text-white">${escapeHtml(payload.controlsInvertEffect.expiresAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(payload.controlsInvertEffect.expiresAt)) : "Sem expiracao")}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ` : ""}
                ${reward.key === "mouseAxesInvert" ? `
                  <div class="mt-4 border-t border-cyan-400/10 pt-4">
                    <button type="button" class="flex w-full items-center justify-between gap-4 text-left" data-expand-toggle="mouse-axes" aria-expanded="false">
                      <span class="min-w-0">
                        <strong class="block text-sm font-semibold text-white">Estado da inversao X + Y do mouse</strong>
                        <span id="moderation-mouse-axes-summary" class="mt-1 block text-xs leading-6 text-white/54">Estado atual: ${escapeHtml(getMouseAxesInvertStateLabel(payload.mouseAxesInvertEffect))}</span>
                      </span>
                      <span class="text-lg text-cyan-100/72 transition" data-expand-icon="mouse-axes">+</span>
                    </button>
                    <div class="mt-4 hidden" data-expand-panel="mouse-axes">
                      <div class="rounded-[18px] border border-cyan-400/10 bg-black/16 px-4 py-3 text-sm text-white/62">
                        <div class="flex items-center justify-between gap-3">
                          <span>Estado Sentinel</span>
                          <strong id="moderation-mouse-axes-state" class="text-white">${escapeHtml(getMouseAxesInvertStateLabel(payload.mouseAxesInvertEffect))}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Estado Agent</span>
                          <strong id="moderation-mouse-axes-agent-state" class="text-white">${escapeHtml(getMouseAxesInvertStateLabel({ ...payload.mouseAxesInvertEffect, state: payload.mouseAxesInvertEffect.agentState }))}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Agent</span>
                          <strong id="moderation-mouse-axes-agent" class="text-white">${escapeHtml(payload.mouseAxesInvertEffect.agentId ?? "Nenhum")}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Session ID</span>
                          <strong id="moderation-mouse-axes-session" class="text-white">${escapeHtml(payload.mouseAxesInvertEffect.sessionId ?? "Nenhuma")}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Iniciado em</span>
                          <strong id="moderation-mouse-axes-started-at" class="text-white">${escapeHtml(payload.mouseAxesInvertEffect.startedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(payload.mouseAxesInvertEffect.startedAt)) : "Nao iniciado")}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Pausado em</span>
                          <strong id="moderation-mouse-axes-paused-at" class="text-white">${escapeHtml(payload.mouseAxesInvertEffect.pausedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(payload.mouseAxesInvertEffect.pausedAt)) : "Nao pausado")}</strong>
                        </div>
                        <div class="mt-2 flex items-center justify-between gap-3">
                          <span>Expira em</span>
                          <strong id="moderation-mouse-axes-expires-at" class="text-white">${escapeHtml(payload.mouseAxesInvertEffect.expiresAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(payload.mouseAxesInvertEffect.expiresAt)) : "Sem expiracao")}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ` : ""}
              </form>
            `).join("")}
          </div>
        </section>
      `
    : "";

  const profileRealtimeScript = `
    <script>
      (() => {
        const balanceValue = document.getElementById("profile-balance-value");
        const liveStatusTitle = document.getElementById("live-status-title");
        const liveStatusDescription = document.getElementById("live-status-description");
        const liveMetricStatus = document.getElementById("live-metric-status");
        const liveMetricCategory = document.getElementById("live-metric-category");
        const liveMetricViewers = document.getElementById("live-metric-viewers");
        const liveMetricStartedAt = document.getElementById("live-metric-started-at");
        const activeBonusesList = document.getElementById("active-bonuses-list");
        let refreshInFlight = false;

        function formatStartedAt(value) {
          if (!value) {
            return "Aguardando";
          }

          try {
            return new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short"
            }).format(new Date(value));
          } catch {
            return "Aguardando";
          }
        }

        function renderActiveBonuses(user) {
          const bonuses = Array.isArray(user?.activeBonuses) ? user.activeBonuses : [];
          if (bonuses.length) {
            return bonuses.map((bonus) => (
              '<li class="rounded-[18px] border border-white/8 bg-black/18 px-4 py-3 text-sm text-white/76">' +
              String(bonus)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#39;") +
              "</li>"
            )).join("");
          }

          return '<li class="rounded-[18px] border border-white/8 bg-black/18 px-4 py-3 text-sm text-white/54">Nenhum bonus ativo no momento.</li>';
        }

        function applyLiveSnapshot(live) {
          if (!live) {
            return;
          }

          if (liveStatusTitle) {
            liveStatusTitle.textContent = live.isLive ? "A live esta no ar" : "A live esta offline";
          }

          if (liveStatusDescription) {
            liveStatusDescription.textContent = live.isLive
              ? (live.title || "Sem titulo informado no momento.")
              : "Quando a live comecar, esta area mostra titulo, categoria e contexto em tempo real.";
          }

          if (liveMetricStatus) {
            liveMetricStatus.textContent = live.isLive ? "Ao vivo" : "Offline";
          }

          if (liveMetricCategory) {
            liveMetricCategory.textContent = live.category || "Nao informada";
          }

          if (liveMetricViewers) {
            liveMetricViewers.textContent = String(typeof live.viewerCount === "number" ? live.viewerCount : 0);
          }

          if (liveMetricStartedAt) {
            liveMetricStartedAt.textContent = formatStartedAt(live.startedAt);
          }
        }

        function applyActiveBonuses(user) {
          if (activeBonusesList) {
            activeBonusesList.innerHTML = renderActiveBonuses(user);
          }
        }

        function applyRewardInputs(rewards) {
          if (!Array.isArray(rewards)) {
            return;
          }

          for (const reward of rewards) {
            if (!reward || typeof reward.key !== "string") {
              continue;
            }

            const input = document.getElementById("reward-price-" + reward.key);
            const enabledInput = document.getElementById("reward-enabled-" + reward.key);
            const enabledToggle = document.getElementById("reward-enabled-toggle-" + reward.key);
            const enabledLabel = document.querySelector('[data-toggle-label="' + reward.key + '"]');
            if (input instanceof HTMLInputElement && document.activeElement !== input) {
              input.value = String(reward.cost);
            }

            if (enabledInput instanceof HTMLInputElement && document.activeElement !== enabledInput) {
              enabledInput.checked = Boolean(reward.enabled);
            }

            if (enabledToggle instanceof HTMLButtonElement) {
              enabledToggle.setAttribute("aria-pressed", reward.enabled ? "true" : "false");
              enabledToggle.className = "reward-enabled-toggle inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] " + (
                reward.enabled ? "bg-emerald-400/14 text-emerald-200" : "bg-white/[0.06] text-white/52"
              );
              enabledToggle.innerHTML = '<span class="h-2.5 w-2.5 rounded-full ' + (reward.enabled ? "bg-emerald-300" : "bg-white/24") + '"></span><span data-toggle-label="' + reward.key + '">' + (reward.enabled ? "Ativo" : "Inativo") + "</span>";
            } else if (enabledLabel) {
              enabledLabel.textContent = reward.enabled ? "Ativo" : "Inativo";
            }
          }
        }

        async function refreshProfileSnapshot() {
          if (refreshInFlight) {
            return;
          }

          refreshInFlight = true;

          try {
            const response = await fetch("/api/profile", {
              credentials: "same-origin"
            });

            if (!response.ok) {
              return;
            }

            const payload = await response.json();

            if (balanceValue && payload.user && typeof payload.user.balance === "number") {
              balanceValue.textContent = String(payload.user.balance);
            }

            applyLiveSnapshot(payload.live);
            applyActiveBonuses(payload.user);
            window.__vulkanSpotifyProfile?.applyQueue?.(payload.spotifyQueue);
            applyRewardInputs(payload.rewardSettings);

            const spotifyReward = Array.isArray(payload.rewards)
              ? payload.rewards.find((reward) => reward && reward.key === "spotifyQueue")
              : null;
            const voicemodReward = Array.isArray(payload.rewards)
              ? payload.rewards.find((reward) => reward && reward.key === "voicemod")
              : null;
            const soundAlertReward = Array.isArray(payload.rewards)
              ? payload.rewards.find((reward) => reward && reward.key === "soundalert")
              : null;
            const chaosReward = Array.isArray(payload.rewards)
              ? payload.rewards.find((reward) => reward && reward.key === "chaos")
              : null;
            const mouseAxesInvertReward = Array.isArray(payload.rewards)
              ? payload.rewards.find((reward) => reward && reward.key === "mouseAxesInvert")
              : null;

            if (spotifyReward) {
              window.__vulkanSpotifyProfile?.applyReward?.(spotifyReward);
            }

            window.__vulkanVoicemodProfile?.applySnapshot?.({
              reward: voicemodReward,
              voices: payload.voicemodVoices,
              activeReward: payload.activeVoicemodReward,
              queueItems: payload.voicemodQueue
            });
            window.__vulkanSoundAlertProfile?.applySnapshot?.({
              reward: soundAlertReward,
              soundboard: payload.voicemodSoundboard,
              soundAlerts: payload.voicemodSoundAlerts
            });
            window.__vulkanChaosProfile?.applySnapshot?.({
              reward: chaosReward,
              effect: payload.controlsInvertEffect
            });
            window.__vulkanMouseAxesProfile?.applySnapshot?.({
              reward: mouseAxesInvertReward,
              effect: payload.mouseAxesInvertEffect
            });
          } catch {
          } finally {
            refreshInFlight = false;
          }
        }

        window.__vulkanProfileSync = {
          refresh: refreshProfileSnapshot,
          applyRewardSetting(setting) {
            if (setting && typeof setting.key === "string") {
              const input = document.getElementById("reward-price-" + setting.key);
              if (input instanceof HTMLInputElement && document.activeElement !== input) {
                input.value = String(setting.cost);
              }

              const enabledInput = document.getElementById("reward-enabled-" + setting.key);
              if (enabledInput instanceof HTMLInputElement && document.activeElement !== enabledInput && typeof setting.enabled === "boolean") {
                enabledInput.checked = setting.enabled;
              }

              const enabledToggle = document.getElementById("reward-enabled-toggle-" + setting.key);
              if (enabledToggle instanceof HTMLButtonElement && typeof setting.enabled === "boolean") {
                enabledToggle.setAttribute("aria-pressed", setting.enabled ? "true" : "false");
              }

              if (setting.key === "spotifyQueue" && typeof setting.cost === "number") {
                window.dispatchEvent(new CustomEvent("vulkan:spotify-reward-sync", {
                  detail: {
                    reward: {
                      key: setting.key,
                      cost: setting.cost
                    }
                  }
                }));
              }
            }

            void refreshProfileSnapshot();
          }
        };

        window.setInterval(() => {
          void refreshProfileSnapshot();
        }, 15000);

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            void refreshProfileSnapshot();
          }
        });
      })();
    </script>
  `;

  const moderatorPricingScript = user.isModerator
    ? `
      <script>
        (() => {
          const feedback = document.getElementById("reward-price-feedback");
          const forms = Array.from(document.querySelectorAll(".reward-price-form"));
          const moduleFeedback = document.getElementById("module-settings-feedback");
          const moduleForms = Array.from(document.querySelectorAll(".module-setting-form"));
          const overlayCopyButtons = Array.from(document.querySelectorAll("[data-overlay-copy]"));

          function buildAbsoluteOverlayUrl(path) {
            try {
              return new URL(path, window.location.origin).toString();
            } catch {
              return path;
            }
          }

          function syncToggleVisual(button, input) {
            if (!(button instanceof HTMLButtonElement) || !(input instanceof HTMLInputElement)) {
              return;
            }

            button.setAttribute("aria-pressed", input.checked ? "true" : "false");
            button.className = "reward-enabled-toggle inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] " + (
              input.checked ? "bg-emerald-400/14 text-emerald-200" : "bg-white/[0.06] text-white/52"
            );
            button.innerHTML = '<span class="h-2.5 w-2.5 rounded-full ' + (input.checked ? "bg-emerald-300" : "bg-white/24") + '"></span><span data-toggle-label="' + (input.id.replace("reward-enabled-", "")) + '">' + (input.checked ? "Ativo" : "Inativo") + "</span>";
          }

          function setFeedback(message, type) {
            if (!feedback) return;
            feedback.textContent = message;
            feedback.className = "mt-5 rounded-[18px] border px-4 py-3 text-sm";
            if (type === "success") {
              feedback.classList.add("border-emerald-400/30", "bg-emerald-400/10", "text-emerald-200");
            } else {
              feedback.classList.add("border-red-400/30", "bg-red-400/10", "text-red-200");
            }
          }

          function setModuleFeedback(message, type) {
            if (!moduleFeedback) return;
            moduleFeedback.textContent = message;
            moduleFeedback.className = "mt-5 rounded-[18px] border px-4 py-3 text-sm";
            if (type === "success") {
              moduleFeedback.classList.add("border-emerald-400/30", "bg-emerald-400/10", "text-emerald-200");
            } else {
              moduleFeedback.classList.add("border-red-400/30", "bg-red-400/10", "text-red-200");
            }
          }

          function setInlineFeedback(target, message, type) {
            const node = document.getElementById("moderation-" + target + "-feedback");
            if (!node) {
              return;
            }

            node.textContent = message;
            node.className = "rounded-[18px] border px-4 py-3 text-sm";
            if (type === "success") {
              node.classList.add("border-emerald-400/30", "bg-emerald-400/10", "text-emerald-200");
            } else {
              node.classList.add("border-red-400/30", "bg-red-400/10", "text-red-200");
            }
          }

          function syncModuleToggleVisual(button, input) {
            if (!(button instanceof HTMLButtonElement) || !(input instanceof HTMLInputElement)) {
              return;
            }

            button.setAttribute("aria-pressed", input.checked ? "true" : "false");
            button.className = "module-enabled-toggle inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] " + (
              input.checked ? "bg-emerald-400/14 text-emerald-200" : "bg-white/[0.06] text-white/52"
            );
            button.innerHTML = '<span class="h-2.5 w-2.5 rounded-full ' + (input.checked ? "bg-emerald-300" : "bg-white/24") + '"></span><span>' + (input.checked ? "Ativo" : "Inativo") + "</span>";
          }

          function applyVoicemodModerationSnapshot(snapshot) {
            const summary = document.getElementById("moderation-voicemod-summary");
            const active = document.getElementById("moderation-voicemod-active");
            const queueCount = document.getElementById("moderation-voicemod-queue-count");
            const pauseState = document.getElementById("moderation-voicemod-pause-state");
            const pauseButton = document.getElementById("moderation-voicemod-pause-button");

            if (summary) {
              summary.textContent = snapshot.activeDisplayName
                ? (snapshot.paused ? "Pausada: " : "Ativa: ") + snapshot.activeDisplayName
                : snapshot.pendingCount
                  ? snapshot.pendingCount + " na fila"
                  : "Sem voz ativa no momento";
            }

            if (active) {
              active.textContent = snapshot.activeDisplayName || "Nenhuma";
            }

            if (queueCount) {
              queueCount.textContent = String(snapshot.pendingCount || 0);
            }

            if (pauseState) {
              pauseState.textContent = snapshot.paused ? "Pausada" : "Rodando";
            }

            if (pauseButton instanceof HTMLButtonElement) {
              pauseButton.textContent = snapshot.paused ? "Retomar fila" : "Pausar fila";
            }
          }

          function applySpotifyModerationSnapshot(snapshot) {
            const summary = document.getElementById("moderation-spotify-summary");
            const active = document.getElementById("moderation-spotify-active");
            const queueCount = document.getElementById("moderation-spotify-queue-count");
            const pauseButton = document.getElementById("moderation-spotify-pause-button");

            if (summary) {
              summary.textContent = snapshot.currentTrackName
                ? "Tocando: " + snapshot.currentTrackName
                : snapshot.available
                  ? "Player sem musica ativa"
                  : "Spotify indisponivel no momento";
            }

            if (active) {
              active.textContent = snapshot.currentTrackName || "Nenhuma";
            }

            if (queueCount) {
              queueCount.textContent = String(snapshot.queueCount || 0);
            }

            if (pauseButton instanceof HTMLButtonElement) {
              pauseButton.textContent = snapshot.isPlaying ? "Pausar player" : "Retomar player";
            }
          }

          async function refreshModerationSnapshot(target) {
            try {
              const response = await fetch("/api/moderation/" + target, {
                credentials: "same-origin"
              });
              const payload = await response.json();
              if (!response.ok) {
                return;
              }

              if (target === "voicemod") {
                applyVoicemodModerationSnapshot(payload);
              } else {
                applySpotifyModerationSnapshot(payload);
              }
            } catch {
            }
          }

          for (const form of forms) {
            form.addEventListener("submit", async (event) => {
              event.preventDefault();
              const rewardKey = form.getAttribute("data-reward-key");
              const rewardTitle = form.getAttribute("data-reward-title") || rewardKey || "recompensa";
              const input = form.querySelector("input[name='cost']");
              const enabledInput = form.querySelector("input[name='enabled']");
              const button = form.querySelector("button[type='submit']");

              if (!(input instanceof HTMLInputElement) || !(enabledInput instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement) || !rewardKey) {
                return;
              }

              const cost = Number(input.value);
              const enabled = enabledInput.checked;
              if (!Number.isInteger(cost) || cost < 0) {
                setFeedback("Informe um valor inteiro maior ou igual a zero.", "error");
                return;
              }

              button.disabled = true;
              button.textContent = "Salvando...";

              try {
                const response = await fetch("/api/reward-settings", {
                  method: "POST",
                  headers: {
                    "content-type": "application/json"
                  },
                  body: JSON.stringify({
                    key: rewardKey,
                    cost,
                    enabled
                  })
                });

                const payload = await response.json();
                if (!response.ok) {
                  setFeedback(payload.message || "Falha ao atualizar o preco.", "error");
                  return;
                }

                input.value = String(payload.setting.cost);
                enabledInput.checked = Boolean(payload.setting.enabled);
                window.__vulkanProfileSync?.applyRewardSetting?.(payload.setting);
                setFeedback(rewardTitle + " atualizado para " + payload.setting.cost + " e " + (payload.setting.enabled ? "ativo" : "desativado") + ".", "success");
              } catch {
                setFeedback("Falha ao atualizar o preco.", "error");
              } finally {
                button.disabled = false;
                button.textContent = "Salvar";
              }
            });
          }

          for (const form of moduleForms) {
            form.addEventListener("submit", async (event) => {
              event.preventDefault();
              const moduleKey = form.getAttribute("data-module-key");
              const moduleTitle = form.getAttribute("data-module-title") || moduleKey || "modulo";
              const enabledInput = form.querySelector("input[name='enabled']");
              const button = form.querySelector("button[type='submit']");

              if (!(enabledInput instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement) || !moduleKey) {
                return;
              }

              button.disabled = true;
              button.textContent = "Salvando...";

              try {
                const response = await fetch("/api/module-settings", {
                  method: "POST",
                  headers: {
                    "content-type": "application/json"
                  },
                  body: JSON.stringify({
                    key: moduleKey,
                    enabled: enabledInput.checked
                  })
                });

                const payload = await response.json();
                if (!response.ok) {
                  setModuleFeedback(payload.message || "Falha ao atualizar o modulo.", "error");
                  return;
                }

                enabledInput.checked = Boolean(payload.setting.enabled);
                const toggle = document.getElementById("module-enabled-toggle-" + moduleKey);
                if (toggle instanceof HTMLButtonElement) {
                  syncModuleToggleVisual(toggle, enabledInput);
                }
                setModuleFeedback(moduleTitle + " agora esta " + (payload.setting.enabled ? "ativo" : "inativo") + ".", "success");
              } catch {
                setModuleFeedback("Falha ao atualizar o modulo.", "error");
              } finally {
                button.disabled = false;
                button.textContent = "Salvar";
              }
            });
          }

          for (const toggle of Array.from(document.querySelectorAll(".reward-enabled-toggle"))) {
            toggle.addEventListener("click", () => {
              const rewardKey = toggle.getAttribute("data-toggle-reward");
              if (!rewardKey) {
                return;
              }

              const input = document.getElementById("reward-enabled-" + rewardKey);
              if (!(input instanceof HTMLInputElement)) {
                return;
              }

              input.checked = !input.checked;
              syncToggleVisual(toggle, input);
            });

            const rewardKey = toggle.getAttribute("data-toggle-reward");
            const input = rewardKey ? document.getElementById("reward-enabled-" + rewardKey) : null;
            if (input instanceof HTMLInputElement && toggle instanceof HTMLButtonElement) {
              syncToggleVisual(toggle, input);
            }
          }

          for (const toggle of Array.from(document.querySelectorAll(".module-enabled-toggle"))) {
            toggle.addEventListener("click", () => {
              const moduleKey = toggle.getAttribute("data-toggle-module");
              if (!moduleKey) {
                return;
              }

              const input = document.getElementById("module-enabled-" + moduleKey);
              if (!(input instanceof HTMLInputElement)) {
                return;
              }

              input.checked = !input.checked;
              syncModuleToggleVisual(toggle, input);
            });

            const moduleKey = toggle.getAttribute("data-toggle-module");
            const input = moduleKey ? document.getElementById("module-enabled-" + moduleKey) : null;
            if (input instanceof HTMLInputElement && toggle instanceof HTMLButtonElement) {
              syncModuleToggleVisual(toggle, input);
            }
          }

          for (const toggle of Array.from(document.querySelectorAll("[data-expand-toggle]"))) {
            toggle.addEventListener("click", async () => {
              const target = toggle.getAttribute("data-expand-toggle");
              if (!target) {
                return;
              }

              const panel = document.querySelector('[data-expand-panel="' + target + '"]');
              const icon = document.querySelector('[data-expand-icon="' + target + '"]');
              const nextOpen = panel?.classList.contains("hidden");

              panel?.classList.toggle("hidden", !nextOpen);
              toggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
              if (icon) {
                icon.textContent = nextOpen ? "−" : "+";
              }

              if (nextOpen) {
                await refreshModerationSnapshot(target);
              }
            });
          }

          for (const button of Array.from(document.querySelectorAll(".moderation-action"))) {
            button.addEventListener("click", async () => {
              const target = button.getAttribute("data-control-target");
              const action = button.getAttribute("data-control-action");
              if (!target || !action || !(button instanceof HTMLButtonElement)) {
                return;
              }

              button.disabled = true;
              const originalLabel = button.textContent || "Executar";
              button.textContent = "Executando...";

              try {
                const response = await fetch("/api/moderation/" + target, {
                  method: "POST",
                  credentials: "same-origin",
                  headers: {
                    "content-type": "application/json"
                  },
                  body: JSON.stringify({ action })
                });

                const payload = await response.json();
                if (!response.ok) {
                  setInlineFeedback(target, payload.message || "Falha ao executar a acao.", "error");
                  return;
                }

                if (target === "voicemod") {
                  applyVoicemodModerationSnapshot(payload.snapshot);
                } else {
                  applySpotifyModerationSnapshot(payload.snapshot);
                }

                setInlineFeedback(target, "Acao executada com sucesso.", "success");
                window.__vulkanProfileSync?.refresh?.();
              } catch {
                setInlineFeedback(target, "Falha ao executar a acao.", "error");
              } finally {
                button.disabled = false;
                button.textContent = originalLabel;
              }
            });
          }

          for (const link of Array.from(document.querySelectorAll("[data-overlay-link], [data-overlay-open]"))) {
            if (!(link instanceof HTMLAnchorElement)) {
              continue;
            }

            const overlayPath = link.getAttribute("data-overlay-link") || link.getAttribute("data-overlay-open");
            if (!overlayPath) {
              continue;
            }

            const absoluteUrl = buildAbsoluteOverlayUrl(overlayPath);
            link.href = absoluteUrl;

            if (link.hasAttribute("data-overlay-link")) {
              link.textContent = absoluteUrl;
              link.title = absoluteUrl;
            }
          }

          for (const button of overlayCopyButtons) {
            button.addEventListener("click", async () => {
              const overlayPath = button.getAttribute("data-overlay-copy");
              if (!overlayPath || !(button instanceof HTMLButtonElement)) {
                return;
              }

              const absoluteUrl = buildAbsoluteOverlayUrl(overlayPath);
              const originalLabel = button.textContent || "Copiar link";

              try {
                await navigator.clipboard.writeText(absoluteUrl);
                button.textContent = "Copiado";
                window.setTimeout(() => {
                  button.textContent = originalLabel;
                }, 1400);
              } catch {
                button.textContent = "Falhou";
                window.setTimeout(() => {
                  button.textContent = originalLabel;
                }, 1400);
              }
            });
          }
        })();
      </script>
    `
    : "";

  const body = `
    <div class="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      ${renderSiteHeader({ active: "profile", viewerLabel: viewer?.twitchDisplayName ?? user.twitchDisplayName })}
      <main class="mt-5 grid gap-5">
        <section class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_320px]">
          <article class="site-panel noise-mask reveal-on-load relative self-start overflow-hidden rounded-[36px] px-6 py-7 sm:px-8 lg:px-10">
            <div class="fire-orb left-[-2rem] top-[-2rem] h-32 w-32 bg-ember-500/24"></div>
            <div class="fire-orb right-[12%] bottom-[-2rem] h-28 w-28 bg-amber-400/14"></div>
            <div class="relative">
              <span class="section-kicker inline-flex rounded-full border border-ember-400/18 bg-ember-500/10 px-3 py-1 text-[11px] font-semibold uppercase text-ember-100">Presenca na comunidade</span>
              <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div class="min-w-0">
                  <h1 class="hero-title max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl">${escapeHtml(user.twitchDisplayName)}</h1>
                  <p class="mt-4 max-w-2xl text-[15px] leading-8 text-white/62">Seu painel centraliza saldo, progresso, resgates e status da live sem desperdiar espaco nem comprometer leitura em telas longas.</p>
                  <div class="mt-6 flex flex-wrap items-center gap-3">
                    <span class="inline-flex rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/82">@${escapeHtml(user.twitchLogin)}</span>
                    <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/68">
                      <span class="h-2 w-2 rounded-full ${user.isTwitchSub ? "bg-amber-300" : "bg-white/20"}"></span>
                      ${user.isTwitchSub ? "Sub ativo" : "Sem sub"}
                    </span>
                    <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/68">
                      <span class="h-2 w-2 rounded-full ${user.isDiscordBooster ? "bg-ember-300" : "bg-white/20"}"></span>
                      ${user.isDiscordBooster ? "Booster ativo" : "Sem boost"}
                    </span>
                    <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/68">
                      <span class="h-2 w-2 rounded-full ${user.isModerator ? "bg-emerald-300" : "bg-white/20"}"></span>
                      ${user.isModerator ? "Moderador" : "Membro"}
                    </span>
                  </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                  <div class="rounded-[24px] border border-white/8 bg-black/20 p-4 text-center">
                    <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Horas</span>
                    <strong class="mt-2 block text-base font-semibold text-white">${formatWatchedHours(user.hoursWatched)}</strong>
                  </div>
                  <div class="rounded-[24px] border border-white/8 bg-black/20 p-4 text-center">
                    <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Multiplicador</span>
                    <strong class="mt-2 block text-base font-semibold text-white">x${user.multiplier}</strong>
                  </div>
                  <div class="rounded-[24px] border border-white/8 bg-black/20 p-4 text-center">
                    <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Warns</span>
                    <strong class="mt-2 block text-base font-semibold text-white">${user.currentWarns}</strong>
                    <span class="mt-1 block text-sm text-white/44">${user.totalWarns} no historico</span>
                  </div>
                  <div class="rounded-[24px] border border-white/8 bg-black/20 p-4 text-center">
                    <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Punicoes</span>
                    <strong class="mt-2 block text-base font-semibold text-white">${user.totalPunishments}</strong>
                    <span class="mt-1 block text-sm text-white/44">Acompanhamento consolidado</span>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <aside class="reveal-on-load relative overflow-hidden rounded-[34px] border border-ember-500/20 bg-gradient-to-br from-ember-500/16 via-[#17110d] to-[#100f13] p-6 shadow-ember-xl backdrop-blur-xl">
            <div class="fire-orb right-[-2rem] bottom-[-2rem] h-24 w-24 bg-amber-400/16"></div>
            <div class="relative">
              <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/76">Saldo atual</span>
              <strong id="profile-balance-value" class="hero-title mt-4 block text-6xl font-semibold tracking-[-0.06em] text-white">${user.balance}</strong>
              <p class="mt-3 text-sm leading-7 text-white/66">Firecoins prontos para pedidos de musica e interacoes da comunidade.</p>
              <div class="ambient-divider my-5"></div>
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-[20px] border border-white/10 bg-black/16 p-4 text-center">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-white/42">Base</span>
                  <strong class="mt-2 block text-xl font-semibold text-white">${user.basePoints}</strong>
                </div>
                <div class="rounded-[20px] border border-white/10 bg-black/16 p-4 text-center">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-white/42">Boost</span>
                  <strong class="mt-2 block text-xl font-semibold text-white">x${user.multiplier}</strong>
                </div>
              </div>
            </div>
          </aside>
        </section>

        ${renderSpotifyQueueSection(spotifyQueue)}

        <section class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article class="site-panel reveal-on-load rounded-[34px] p-6 sm:p-8">
            <div>
              <div>
                <h2 id="live-status-title" class="hero-title text-4xl font-semibold tracking-[-0.04em] text-white">${live.isLive ? "A live esta no ar" : "A live esta offline"}</h2>
                <p id="live-status-description" class="mt-3 max-w-2xl text-sm leading-8 text-white/62">${live.isLive ? escapeHtml(live.title ?? "Sem titulo informado no momento.") : "Quando a live comecar, esta area mostra titulo, categoria e contexto em tempo real."}</p>
              </div>
              <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-[20px] border border-white/8 bg-black/18 p-4 text-center">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Status</span>
                  <strong id="live-metric-status" class="mt-3 block text-base font-semibold text-white">${live.isLive ? "Ao vivo" : "Offline"}</strong>
                </div>
                <div class="rounded-[20px] border border-white/8 bg-black/18 p-4 text-center">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Categoria</span>
                  <strong id="live-metric-category" class="mt-3 block text-sm font-semibold text-white">${escapeHtml(live.category ?? "Nao informada")}</strong>
                </div>
                <div class="rounded-[20px] border border-white/8 bg-black/18 p-4 text-center">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Viewers</span>
                  <strong id="live-metric-viewers" class="mt-3 block text-2xl font-semibold text-white">${live.viewerCount ?? 0}</strong>
                </div>
                <div class="rounded-[20px] border border-white/8 bg-black/18 p-4 text-center">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Inicio</span>
                  <strong id="live-metric-started-at" class="mt-3 block text-sm font-semibold text-white">${escapeHtml(liveStartedAt)}</strong>
                </div>
              </div>
            </div>
          </article>

          <aside class="site-panel-soft reveal-on-load rounded-[34px] p-6">
            <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Bonus ativos</span>
            <h2 class="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">Composicao do ganho</h2>
            <ul id="active-bonuses-list" class="mt-5 grid gap-3">${activeBonuses}</ul>
          </aside>
        </section>

        ${overlayHubMarkup}

        <section class="site-panel reveal-on-load rounded-[34px] p-6 sm:p-8">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Recompensas</span>
              <h2 class="hero-title mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Resgates ativos</h2>
            </div>
            <p class="max-w-2xl text-sm leading-7 text-white/58">Use seus Firecoins para interagir sem sair do perfil.</p>
          </div>
          <div id="reward-redeem-feedback" class="mt-5 hidden rounded-[18px] border px-4 py-3 text-sm"></div>
          <div class="mt-6 grid grid-cols-[repeat(auto-fit,minmax(17rem,18.5rem))] justify-center gap-4">
            ${renderSpotifyRewardCard(spotifyReward)}
            ${renderVoicemodRewardCard(voicemodReward, payload.activeVoicemodReward, payload.voicemodQueue)}
            ${renderSoundAlertRewardCard(soundAlertReward, payload.voicemodSoundAlerts, payload.voicemodSoundboard)}
            ${renderControlsInvertRewardCard(chaosReward, payload.controlsInvertEffect)}
            ${renderMouseAxesInvertRewardCard(mouseAxesInvertReward, payload.mouseAxesInvertEffect)}
          </div>
        </section>
        ${renderSpotifyRequestModal(spotifyReward)}
        ${renderVoicemodRequestModal(voicemodReward, payload.voicemodVoices, payload.activeVoicemodReward, payload.voicemodQueue)}
        ${renderSoundAlertRequestModal(soundAlertReward, payload.voicemodSoundAlerts, payload.voicemodSoundboard)}
        ${moderatorPricingMarkup}
      </main>
      ${renderSiteFooter()}
    </div>
    ${renderProfileSpotifyRealtimeScript()}
    ${profileRealtimeScript}
    ${renderProfileSpotifyRequestScript(spotifyReward)}
    ${renderRewardInteractionScript()}
    ${renderVoicemodRewardScript(voicemodReward, payload.voicemodQueue)}
    ${renderSoundAlertRewardScript(soundAlertReward, payload.voicemodSoundboard, payload.voicemodSoundAlerts)}
    ${renderControlsInvertRewardScript(chaosReward, payload.controlsInvertEffect)}
    ${renderMouseAxesInvertRewardScript(mouseAxesInvertReward, payload.mouseAxesInvertEffect)}
    ${moderatorPricingScript}
  `;

  return getSiteDocument("Perfil | Vulkan Sentinel", body);
}
