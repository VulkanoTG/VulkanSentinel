import type { WebProfilePayload } from "../../types.js";
import { escapeHtml } from "../shared.js";

const FIRECOIN_ICON_URL = "/assets/images/firecoin.png";
const REWARD_CARD_BASE_CLASS = "group relative min-h-[11.5rem] w-full max-w-[18.5rem] overflow-hidden rounded-[22px] border p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition";

type SpotifyQueueView = WebProfilePayload["spotifyQueue"];
type SpotifyRewardView = WebProfilePayload["rewards"][number] | null;

function renderFirecoinLabel(amount?: number, extraClass = "h-4 w-4") {
  const amountMarkup = typeof amount === "number" ? `<span>${amount}</span>` : "";
  return `<span class="inline-flex items-center gap-2"><img src="${FIRECOIN_ICON_URL}" alt="Firecoin" class="${extraClass} rounded-full object-cover" />${amountMarkup}</span>`;
}

function getSpotifyRewardStateLabel(reward: SpotifyRewardView) {
  if (!reward?.enabled) {
    return "Desativado";
  }

  return reward.affordable ? "Saldo suficiente" : "Saldo insuficiente";
}

function renderSpotifyUnavailableNotice(message: string) {
  return `
    <div class="rounded-[28px] border border-emerald-400/14 bg-[linear-gradient(160deg,rgba(16,185,129,0.18),rgba(8,12,18,0.98))] p-6 shadow-ember-xl">
      <span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/70">Spotify indisponivel</span>
      <div class="mt-4 rounded-[22px] border border-emerald-300/12 bg-black/20 px-5 py-6">
        <strong class="block text-xl font-semibold text-white">Recurso temporariamente desativado</strong>
        <p class="mt-3 max-w-3xl text-sm leading-7 text-white/62">${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

export function renderSpotifyQueueSection(spotifyQueue: SpotifyQueueView) {
  if (!spotifyQueue.available) {
    return `
      <section class="site-panel reveal-on-load rounded-[34px] p-6 sm:p-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/80">Spotify live</span>
            <h2 class="hero-title mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Fila da stream</h2>
          </div>
          <p class="max-w-2xl text-sm leading-7 text-white/58">A fila agora fica em uma secao propria, sem quebrar a composicao lateral do perfil.</p>
        </div>
        <div id="spotify-queue-content" class="mt-6">
          ${renderSpotifyUnavailableNotice(spotifyQueue.message ?? "O recurso esta desativado temporariamente.")}
        </div>
      </section>
    `;
  }

  const queueCards = spotifyQueue.tracks.length
    ? spotifyQueue.tracks.map((track, index) => `
        <li class="rounded-[22px] border border-emerald-400/10 bg-[linear-gradient(180deg,rgba(7,18,16,0.96),rgba(10,14,18,0.96))] p-3 shadow-[0_16px_44px_rgba(0,0,0,0.24)]">
          <div class="relative">
            <span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/70">fila ${index + 1}</span>
            ${track.url ? `<a href="${escapeHtml(track.url)}" target="_blank" rel="noreferrer" class="absolute right-0 top-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/72 transition hover:text-white">Spotify</a>` : ""}
          </div>
          <div class="mt-3">
            ${track.artworkUrl
              ? `<img src="${escapeHtml(track.artworkUrl)}" alt="${escapeHtml(track.name)}" class="aspect-square w-full rounded-[18px] object-cover" />`
              : `<div class="flex aspect-square w-full items-center justify-center rounded-[18px] bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-white/42">Sem capa</div>`}
          </div>
          <div class="mt-3">
            <strong class="line-clamp-2 block text-sm font-semibold text-white">${escapeHtml(track.name)}</strong>
            <span class="mt-1 block line-clamp-2 text-sm text-white/50">${escapeHtml(track.artist)}</span>
          </div>
        </li>
      `).join("")
    : `<li class="rounded-[22px] border border-emerald-400/10 bg-[linear-gradient(180deg,rgba(7,18,16,0.96),rgba(10,14,18,0.96))] px-4 py-4 text-sm leading-7 text-white/54 sm:col-span-2 xl:col-span-4">${escapeHtml(spotifyQueue.message ?? "A fila esta vazia no momento.")}</li>`;

  return `
    <section class="site-panel reveal-on-load rounded-[34px] p-6 sm:p-8">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/80">Spotify live</span>
          <h2 class="hero-title mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Fila da stream</h2>
        </div>
        <p class="max-w-2xl text-sm leading-7 text-white/58">A fila agora fica em uma secao propria, sem quebrar a composicao lateral do perfil.</p>
      </div>
      <div id="spotify-queue-content" class="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div id="spotify-current-track-card" class="rounded-[28px] border border-emerald-400/12 bg-[linear-gradient(160deg,rgba(16,185,129,0.16),rgba(8,12,18,0.98))] p-5 shadow-ember-xl">
          ${spotifyQueue.currentTrack
            ? `
              <span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/70">Tocando agora</span>
              <div class="mt-4">
                ${spotifyQueue.currentTrack.artworkUrl
                  ? `<img src="${escapeHtml(spotifyQueue.currentTrack.artworkUrl)}" alt="${escapeHtml(spotifyQueue.currentTrack.name)}" class="aspect-square w-full rounded-[22px] object-cover" />`
                  : `<div class="flex aspect-square w-full items-center justify-center rounded-[22px] bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-white/42">Sem capa</div>`}
                <div class="mt-4 min-w-0">
                  <strong class="block text-lg font-semibold text-white">${escapeHtml(spotifyQueue.currentTrack.name)}</strong>
                  <span class="mt-1 block text-sm text-white/58">${escapeHtml(spotifyQueue.currentTrack.artist)}</span>
                  <span class="mt-1 block text-sm text-white/42">${escapeHtml(spotifyQueue.currentTrack.album)}</span>
                  ${spotifyQueue.currentTrack.url ? `<a href="${escapeHtml(spotifyQueue.currentTrack.url)}" target="_blank" rel="noreferrer" class="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/72 transition hover:text-white">Abrir no Spotify</a>` : ""}
                </div>
              </div>
            `
            : `<p class="rounded-[22px] bg-black/20 px-4 py-4 text-sm leading-7 text-white/54">${escapeHtml(spotifyQueue.message ?? "Nenhuma musica tocando agora.")}</p>`}
        </div>
        <div>
          <span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/70">Proximas da fila</span>
          <ul id="spotify-queue-list" class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            ${queueCards}
          </ul>
        </div>
      </div>
    </section>
  `;
}

export function renderSpotifyRewardCard(reward: SpotifyRewardView) {
  if (!reward) {
    return `<p class="rounded-[20px] border border-white/8 bg-black/16 px-4 py-4 text-sm leading-7 text-white/54">Nenhum resgate de Spotify configurado no momento.</p>`;
  }

  const clickable = Boolean(reward.enabled && reward.status === "available");
  const stateLabel = getSpotifyRewardStateLabel(reward);

  return `
    <article
      id="reward-card-spotifyQueue"
      data-reward-card="spotifyQueue"
      class="${REWARD_CARD_BASE_CLASS} ${clickable ? "cursor-pointer border-emerald-400/18 bg-[radial-gradient(circle_at_88%_50%,rgba(34,197,94,0.16),transparent_0_24%),linear-gradient(180deg,rgba(8,24,16,0.98),rgba(8,14,11,0.98))] hover:border-emerald-400/30 hover:-translate-y-0.5" : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"}"
      ${clickable ? 'data-open-spotify-modal="true" role="button" tabindex="0"' : 'aria-disabled="true"'}
    >
      <div data-reward-orb="spotifyQueue" class="hidden"></div>
      <div class="relative flex h-full flex-col">
        <div class="flex items-center justify-between gap-3">
          <span data-reward-badge="spotifyQueue" class="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${clickable ? "border-emerald-400/24 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-white/54"}">Spotify</span>
          <span data-reward-cost="spotifyQueue" class="inline-flex items-center gap-2 text-xs font-semibold text-white/78">${renderFirecoinLabel(reward.cost)}</span>
        </div>
        <h3 class="mt-3 text-lg font-semibold leading-7 text-white">${escapeHtml(reward.title)}</h3>
        <p class="mt-2 text-sm leading-6 text-white/58">${escapeHtml(reward.description)}</p>
        <div class="mt-auto pt-4 flex items-center justify-between gap-3">
          <span data-reward-state="spotifyQueue" class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${!reward.enabled ? "bg-white/[0.04] text-white/52" : reward.affordable ? "bg-emerald-400/12 text-emerald-300" : "bg-ember-500/10 text-amber-200"}">${stateLabel}</span>
          <span data-reward-action="spotifyQueue" class="text-[11px] font-semibold uppercase tracking-[0.16em] ${clickable ? "text-emerald-100/76" : "text-white/42"}">${clickable ? "Clique para abrir" : "Indisponivel"}</span>
        </div>
      </div>
    </article>
  `;
}

export function renderSpotifyRequestModal(reward: SpotifyRewardView) {
  if (!reward) {
    return "";
  }

  return `
    <div id="spotify-request-modal" class="fixed inset-0 z-50 hidden">
      <div class="absolute inset-0 bg-[#030509]/90 backdrop-blur-md" data-close-spotify-modal="true"></div>
      <div class="relative flex min-h-screen items-center justify-center p-4">
        <section class="site-panel noise-mask relative w-full max-w-4xl overflow-hidden rounded-[34px] border border-ember-400/20 p-6 shadow-[0_32px_90px_rgba(0,0,0,0.72)] sm:p-8">
          <div class="fire-orb left-[-2rem] top-[-2rem] h-32 w-32 bg-ember-500/24"></div>
          <div class="fire-orb right-[-1rem] top-[10%] h-24 w-24 bg-amber-400/14"></div>
          <div class="relative">
            <div class="flex items-start justify-between gap-4">
              <div>
                <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/76">Pedido de musica</span>
                <h2 class="hero-title mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">Busque e resgate sem sair do perfil</h2>
                <p class="mt-3 max-w-2xl text-sm leading-7 text-white/58">Digite o nome da musica e escolha um resultado para gastar <span id="spotify-request-cost" class="inline-flex items-center gap-2 font-semibold text-white">${renderFirecoinLabel(reward.cost)}</span>.</p>
              </div>
              <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xl text-white/72 transition hover:border-ember-400/30 hover:text-white" data-close-spotify-modal="true" aria-label="Fechar">&times;</button>
            </div>
            <div id="music-request-feedback" class="mt-5 hidden rounded-[18px] border px-4 py-3 text-sm"></div>
            <div class="mt-6">
              <label for="music-search-title" class="block text-sm font-semibold text-white/78">Qual musica voce quer ouvir?</label>
              <input id="music-search-title" name="title" type="text" autocomplete="off" placeholder="Digite o nome da musica" class="mt-3 w-full rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-ember-400/40" />
              <p class="mt-3 text-sm text-white/48">A busca acontece automaticamente enquanto voce digita.</p>
            </div>
            <div id="music-search-results" class="scrollbar-fire mt-6 grid max-h-[26rem] gap-4 overflow-y-auto pr-2">
              <p class="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">Digite pelo menos uma musica para ver as opcoes.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

export function renderProfileSpotifyRealtimeScript() {
  return `
    <script>
      (() => {
        const queueContent = document.getElementById("spotify-queue-content");
        const rewardCard = document.getElementById("reward-card-spotifyQueue");
        const rewardBadge = document.querySelector('[data-reward-badge="spotifyQueue"]');
        const rewardCost = document.querySelector('[data-reward-cost="spotifyQueue"]');
        const rewardState = document.querySelector('[data-reward-state="spotifyQueue"]');
        const rewardAction = document.querySelector('[data-reward-action="spotifyQueue"]');
        const rewardOrb = document.querySelector('[data-reward-orb="spotifyQueue"]');
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

        function renderUnavailableNotice(message) {
          return '<div class="rounded-[28px] border border-emerald-400/14 bg-[linear-gradient(160deg,rgba(16,185,129,0.18),rgba(8,12,18,0.98))] p-6 shadow-ember-xl">' +
            '<span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/70">Spotify indisponivel</span>' +
            '<div class="mt-4 rounded-[22px] border border-emerald-300/12 bg-black/20 px-5 py-6">' +
              '<strong class="block text-xl font-semibold text-white">Recurso temporariamente desativado</strong>' +
              '<p class="mt-3 max-w-3xl text-sm leading-7 text-white/62">' + escapeClientHtml(message || "O recurso esta desativado temporariamente.") + '</p>' +
            '</div>' +
          '</div>';
        }

        function renderCurrentTrack(queue) {
          if (queue && queue.currentTrack) {
            return '<span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/70">Tocando agora</span>' +
              '<div class="mt-4">' +
                (queue.currentTrack.artworkUrl
                  ? '<img src="' + escapeClientHtml(queue.currentTrack.artworkUrl) + '" alt="' + escapeClientHtml(queue.currentTrack.name) + '" class="aspect-square w-full rounded-[22px] object-cover" />'
                  : '<div class="flex aspect-square w-full items-center justify-center rounded-[22px] bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-white/42">Sem capa</div>') +
                '<div class="mt-4 min-w-0">' +
                  '<strong class="block text-lg font-semibold text-white">' + escapeClientHtml(queue.currentTrack.name) + '</strong>' +
                  '<span class="mt-1 block text-sm text-white/58">' + escapeClientHtml(queue.currentTrack.artist) + '</span>' +
                  '<span class="mt-1 block text-sm text-white/42">' + escapeClientHtml(queue.currentTrack.album) + '</span>' +
                  (queue.currentTrack.url ? '<a href="' + escapeClientHtml(queue.currentTrack.url) + '" target="_blank" rel="noreferrer" class="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/72 transition hover:text-white">Abrir no Spotify</a>' : "") +
                '</div>' +
              '</div>';
          }

          return '<p class="rounded-[22px] bg-black/20 px-4 py-4 text-sm leading-7 text-white/54">' +
            escapeClientHtml((queue && queue.message) || "Nenhuma musica tocando agora.") +
            "</p>";
        }

        function renderQueueItems(queue) {
          if (queue && Array.isArray(queue.tracks) && queue.tracks.length) {
            return queue.tracks.map((track, index) => {
              const linkMarkup = track.url
                ? '<a href="' + escapeClientHtml(track.url) + '" target="_blank" rel="noreferrer" class="absolute right-0 top-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/72 transition hover:text-white">Spotify</a>'
                : "";
              const artworkMarkup = track.artworkUrl
                ? '<img src="' + escapeClientHtml(track.artworkUrl) + '" alt="' + escapeClientHtml(track.name) + '" class="aspect-square w-full rounded-[18px] object-cover" />'
                : '<div class="flex aspect-square w-full items-center justify-center rounded-[18px] bg-white/[0.03] text-[10px] uppercase tracking-[0.18em] text-white/42">Sem capa</div>';

              return '<li class="rounded-[22px] border border-emerald-400/10 bg-[linear-gradient(180deg,rgba(7,18,16,0.96),rgba(10,14,18,0.96))] p-3 shadow-[0_16px_44px_rgba(0,0,0,0.24)]">' +
                '<div class="relative">' +
                    '<span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/70">fila ' + (index + 1) + '</span>' +
                  linkMarkup +
                '</div>' +
                '<div class="mt-3">' +
                  artworkMarkup +
                '</div>' +
                '<div class="mt-3">' +
                  '<strong class="line-clamp-2 block text-sm font-semibold text-white">' + escapeClientHtml(track.name) + '</strong>' +
                  '<span class="mt-1 block line-clamp-2 text-sm text-white/50">' + escapeClientHtml(track.artist) + '</span>' +
                '</div>' +
              '</li>';
            }).join("");
          }

          return '<li class="rounded-[22px] border border-emerald-400/10 bg-[linear-gradient(180deg,rgba(7,18,16,0.96),rgba(10,14,18,0.96))] px-4 py-4 text-sm leading-7 text-white/54 sm:col-span-2 xl:col-span-4">' +
            escapeClientHtml((queue && queue.message) || "A fila esta vazia no momento.") +
            "</li>";
        }

        function renderQueueContent(queue) {
          if (queue && queue.available === false) {
            return renderUnavailableNotice(queue.message);
          }

          return '<div id="spotify-current-track-card" class="rounded-[28px] border border-emerald-400/12 bg-[linear-gradient(160deg,rgba(16,185,129,0.16),rgba(8,12,18,0.98))] p-5 shadow-ember-xl">' +
              renderCurrentTrack(queue) +
            '</div>' +
            '<div>' +
              '<span class="section-kicker text-[10px] font-semibold uppercase text-emerald-200/70">Proximas da fila</span>' +
              '<ul id="spotify-queue-list" class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">' +
                renderQueueItems(queue) +
              '</ul>' +
            '</div>';
        }

        function getRewardStateLabel(reward) {
          if (!reward || !reward.enabled) {
            return "Desativado";
          }

          return reward.affordable ? "Saldo suficiente" : "Saldo insuficiente";
        }

        window.__vulkanSpotifyProfile = {
          applyQueue(queue) {
            if (queueContent) {
              queueContent.className = queue && queue.available === false
                ? "mt-6"
                : "mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]";
              queueContent.innerHTML = renderQueueContent(queue);
            }
          },
          applyReward(reward) {
            if (!rewardCard || !reward) {
              return;
            }

            const clickable = Boolean(reward.enabled && reward.status === "available");

            rewardCard.className = "${REWARD_CARD_BASE_CLASS} " + (
              clickable
                ? "cursor-pointer border-emerald-400/18 bg-[radial-gradient(circle_at_88%_50%,rgba(34,197,94,0.16),transparent_0_24%),linear-gradient(180deg,rgba(8,24,16,0.98),rgba(8,14,11,0.98))] hover:border-emerald-400/30 hover:-translate-y-0.5"
                : "border-white/8 bg-[linear-gradient(180deg,rgba(24,24,28,0.92),rgba(12,12,16,0.96))] opacity-70 grayscale"
            );

            rewardCard.setAttribute("data-open-spotify-modal", clickable ? "true" : "false");

            if (clickable) {
              rewardCard.setAttribute("role", "button");
              rewardCard.setAttribute("tabindex", "0");
              rewardCard.removeAttribute("aria-disabled");
            } else {
              rewardCard.removeAttribute("role");
              rewardCard.removeAttribute("tabindex");
              rewardCard.setAttribute("aria-disabled", "true");
            }

            if (rewardOrb) {
              rewardOrb.className = "hidden";
            }

            if (rewardBadge) {
              rewardBadge.className = "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] " + (
                clickable
                  ? "border-emerald-400/24 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-white/54"
              );
            }

            if (rewardCost) {
              rewardCost.innerHTML = firecoinMarkup(reward.cost);
            }

            if (rewardState) {
              rewardState.textContent = getRewardStateLabel(reward);
              rewardState.className = "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold " + (
                !reward.enabled
                  ? "bg-white/[0.04] text-white/52"
                  : reward.affordable
                    ? "bg-emerald-400/12 text-emerald-300"
                    : "bg-ember-500/10 text-amber-200"
              );
            }

            if (rewardAction) {
              rewardAction.textContent = clickable ? "Clique para abrir" : "Indisponivel";
              rewardAction.className = "text-[11px] font-semibold uppercase tracking-[0.16em] " + (
                clickable ? "text-emerald-100/76" : "text-white/42"
              );
            }

            window.dispatchEvent(new CustomEvent("vulkan:spotify-reward-sync", {
              detail: { reward }
            }));
          }
        };
      })();
    </script>
  `;
}

export function renderProfileSpotifyRequestScript(reward: SpotifyRewardView) {
  if (!reward) {
    return "";
  }

  return `
    <script>
      (() => {
        const modal = document.getElementById("spotify-request-modal");
        const rewardCard = document.getElementById("reward-card-spotifyQueue");
        const feedback = document.getElementById("music-request-feedback");
        const resultsContainer = document.getElementById("music-search-results");
        const requestCostLabel = document.getElementById("spotify-request-cost");
        const titleInput = document.getElementById("music-search-title");
        const modalClosers = Array.from(document.querySelectorAll("[data-close-spotify-modal='true']"));
        const balanceValue = document.getElementById("profile-balance-value");
        let requestCost = ${reward.cost};
        const firecoinIcon = ${JSON.stringify(FIRECOIN_ICON_URL)};
        let searchTimer = null;
        let searchSequence = 0;

        function escapeClientHtml(value) {
          return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        }

        function firecoinMarkup(amount) {
          return '<span class="inline-flex items-center gap-2 align-middle"><img src="' + firecoinIcon + '" alt="Firecoin" class="h-4 w-4 rounded-full object-cover" />' + amount + '</span>';
        }

        function applyRequestCost(nextCost) {
          if (typeof nextCost !== "number" || !Number.isFinite(nextCost) || nextCost < 0) {
            return;
          }

          requestCost = nextCost;

          if (requestCostLabel) {
            requestCostLabel.innerHTML = firecoinMarkup(nextCost);
          }

          const requestButtons = Array.from(document.querySelectorAll(".music-request-button"));
          for (const button of requestButtons) {
            if (!(button instanceof HTMLButtonElement)) {
              continue;
            }

            if (!button.disabled || button.textContent?.startsWith("Pedir por ")) {
              button.textContent = "Pedir por " + nextCost;
            }
          }
        }

        function setFeedback(message, type) {
          if (!feedback) return;
          feedback.innerHTML = message;
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
          feedback.innerHTML = "";
          feedback.classList.add("hidden");
        }

        function openModal() {
          if (!modal || rewardCard?.getAttribute("data-open-spotify-modal") !== "true") return;
          modal.classList.remove("hidden");
          document.body.style.overflow = "hidden";
          clearFeedback();
          window.setTimeout(() => {
            if (titleInput instanceof HTMLInputElement) {
              titleInput.focus();
              titleInput.select();
            }
          }, 10);
        }

        function closeModal() {
          if (!modal) return;
          modal.classList.add("hidden");
          document.body.style.overflow = "";
        }

        function clearResults(message) {
          if (!resultsContainer) return;
          resultsContainer.innerHTML = message
            ? '<p class="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">' + message + '</p>'
            : "";
        }

        function renderTrack(track) {
          const imageMarkup = track.artworkUrl
            ? '<img src="' + escapeClientHtml(track.artworkUrl) + '" alt="' + escapeClientHtml(track.name) + '" class="h-20 w-20 rounded-[18px] border border-white/10 object-cover" />'
            : '<div class="flex h-20 w-20 items-center justify-center rounded-[18px] border border-white/10 bg-black/20 text-xs uppercase tracking-[0.18em] text-white/44">Sem capa</div>';

          return '<article class="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">' +
            '<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">' +
              '<div class="flex gap-4">' +
                imageMarkup +
                '<div>' +
                  '<h3 class="text-xl font-semibold text-white">' + escapeClientHtml(track.name) + '</h3>' +
                  '<p class="mt-2 text-sm text-white/68">' + escapeClientHtml(track.artist) + '</p>' +
                  '<p class="mt-1 text-sm text-white/48">' + escapeClientHtml(track.album) + '</p>' +
                  (track.url ? '<a href="' + escapeClientHtml(track.url) + '" target="_blank" rel="noreferrer" class="mt-3 inline-flex text-sm font-semibold text-ember-200 hover:text-white">Abrir no Spotify</a>' : '') +
                '</div>' +
              '</div>' +
              '<button type="button" class="music-request-button inline-flex items-center justify-center rounded-[18px] bg-gradient-to-r from-amber-300 via-ember-400 to-ember-600 px-5 py-3 text-sm font-semibold text-black transition hover:scale-[1.01]" data-title="' + encodeURIComponent(track.name) + '" data-artist="' + encodeURIComponent(track.artist) + '">Pedir por ' + requestCost + '</button>' +
            '</div>' +
          '</article>';
        }

        async function searchTracks(title) {
          const params = new URLSearchParams({ title });
          const response = await fetch("/api/spotify/search?" + params.toString(), {
            credentials: "same-origin"
          });
          const payload = await response.json();

          if (!response.ok) {
            throw new Error(payload.message || "Falha ao pesquisar no Spotify.");
          }

          return payload.tracks || [];
        }

        async function requestTrack(title, artist, button) {
          button.disabled = true;
          button.textContent = "Enviando...";

          try {
            const response = await fetch("/api/spotify/request", {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "content-type": "application/json"
              },
              body: JSON.stringify({
                title,
                artist
              })
            });

            const payload = await response.json();
            if (!response.ok) {
              throw new Error(payload.message || "Falha ao pedir musica.");
            }

            if (balanceValue && typeof payload.balanceAfter === "number") {
              balanceValue.textContent = String(payload.balanceAfter);
            }

            setFeedback(
              'Pedido enviado: <strong class="text-white">' +
              escapeClientHtml(payload.track.name) +
              '</strong> - ' +
              escapeClientHtml(payload.track.artist) +
              '. Saldo restante: ' +
              firecoinMarkup(payload.balanceAfter) +
              '.',
              "success"
            );
            clearResults("");
            if (titleInput instanceof HTMLInputElement) {
              titleInput.value = "";
            }
            window.__vulkanProfileSync?.refresh?.();
            window.setTimeout(closeModal, 900);
          } catch (error) {
            setFeedback(error instanceof Error ? escapeClientHtml(error.message) : "Falha ao pedir musica.", "error");
          } finally {
            button.disabled = false;
            button.textContent = "Pedir por " + requestCost;
          }
        }

        if (resultsContainer) {
          resultsContainer.addEventListener("click", async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLButtonElement) || !target.classList.contains("music-request-button")) {
              return;
            }

            const title = decodeURIComponent(target.dataset.title || "");
            const artist = decodeURIComponent(target.dataset.artist || "");
            if (!title) {
              return;
            }

            await requestTrack(title, artist, target);
          });
        }

        if (rewardCard) {
          rewardCard.addEventListener("click", () => {
            if (rewardCard.getAttribute("data-open-spotify-modal") === "true") {
              openModal();
            }
          });

          rewardCard.addEventListener("keydown", (event) => {
            if (!(event instanceof KeyboardEvent)) {
              return;
            }

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (rewardCard.getAttribute("data-open-spotify-modal") === "true") {
                openModal();
              }
            }
          });
        }

        for (const closer of modalClosers) {
          closer.addEventListener("click", closeModal);
        }

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && modal && !modal.classList.contains("hidden")) {
            closeModal();
          }
        });

        if (titleInput instanceof HTMLInputElement) {
          titleInput.addEventListener("input", () => {
            const title = titleInput.value.trim();
            clearFeedback();

            if (searchTimer) {
              window.clearTimeout(searchTimer);
            }

            if (!title) {
              clearResults("Digite pelo menos uma musica para ver as opcoes.");
              return;
            }

            clearResults("Buscando no Spotify...");
            const currentSequence = ++searchSequence;

            searchTimer = window.setTimeout(async () => {
              try {
                const tracks = await searchTracks(title);

                if (currentSequence !== searchSequence) {
                  return;
                }

                if (!tracks.length) {
                  clearResults("Nenhuma musica encontrada para essa busca.");
                  return;
                }

                resultsContainer.innerHTML = tracks.map(renderTrack).join("");
              } catch (error) {
                if (currentSequence !== searchSequence) {
                  return;
                }

                clearResults("");
                setFeedback(error instanceof Error ? escapeClientHtml(error.message) : "Falha ao pesquisar no Spotify.", "error");
              }
            }, 260);
          });
        }

        window.addEventListener("vulkan:spotify-reward-sync", (event) => {
          const reward = event instanceof CustomEvent ? event.detail?.reward : null;
          if (reward && typeof reward.cost === "number") {
            applyRequestCost(reward.cost);
          }
        });

        applyRequestCost(requestCost);
      })();
    </script>
  `;
}
