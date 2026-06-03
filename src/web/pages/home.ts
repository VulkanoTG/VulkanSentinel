import {
  discordViewerCommandCategories,
  twitchViewerCommandCategories,
  type CommandCategory,
} from "../../services/commandCatalog.js";
import { escapeHtml, getSiteDocument, renderSiteFooter, renderSiteHeader } from "./shared.js";

function renderCommandCategoryArticle(category: CommandCategory, platform: "discord" | "twitch") {
  return `
    <article
      class="command-category-panel hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-5 shadow-[0_20px_54px_rgba(0,0,0,0.34)]"
      data-command-category-panel="${platform}:${escapeHtml(category.id)}"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 class="text-2xl font-semibold text-white">${escapeHtml(category.label)}</h4>
          <p class="mt-2 max-w-2xl text-sm leading-7 text-white/58">${escapeHtml(category.description)}</p>
        </div>
        <span class="inline-flex rounded-full border border-ember-400/18 bg-ember-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ember-100">${category.commands.length} comandos</span>
      </div>
      <ul class="mt-5 grid gap-3">
        ${category.commands.map((command) => `
          <li class="rounded-[20px] border border-white/8 bg-black/18 px-4 py-4">
            <strong class="block text-sm font-semibold text-white">${escapeHtml(command.name)}</strong>
            <span class="mt-2 block text-sm leading-7 text-white/58">${escapeHtml(command.description)}</span>
          </li>
        `).join("")}
      </ul>
    </article>
  `;
}

function renderCommandPlatformPanel(platform: "discord" | "twitch") {
  const categories = platform === "discord" ? discordViewerCommandCategories : twitchViewerCommandCategories;
  const totalCommands = categories.reduce((total, category) => total + category.commands.length, 0);
  const platformLabel = platform === "discord" ? "Discord" : "Twitch";
  const platformDescription = platform === "discord"
    ? "Use aqui o que voce precisa para vincular conta, ver saldo e participar da live pelo Discord."
    : "Use aqui o que voce precisa para pedir musica, ver pontos e participar da live pelo chat.";

  return `
    <div class="command-platform-panel hidden" data-command-panel="${platform}">
      <div class="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside class="site-panel-soft rounded-[30px] p-5">
          <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">${platformLabel}</span>
          <h3 class="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">${totalCommands} comandos ativos</h3>
          <p class="mt-3 text-sm leading-7 text-white/58">${platformDescription}</p>
          <div class="mt-5 grid gap-2">
            ${categories.map((category) => `
              <button
                type="button"
                class="command-category-button flex items-center justify-between rounded-[18px] border border-white/8 bg-black/18 px-4 py-3 text-left transition"
                data-command-platform="${platform}"
                data-command-category="${escapeHtml(category.id)}"
              >
                <span>
                  <strong class="block text-sm font-semibold text-white">${escapeHtml(category.label)}</strong>
                  <span class="mt-1 block text-xs leading-6 text-white/48">${escapeHtml(category.description)}</span>
                </span>
                <span class="ml-4 inline-flex min-w-[2.4rem] justify-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ember-100/72">${category.commands.length}</span>
              </button>
            `).join("")}
          </div>
        </aside>

        <div class="grid gap-4">
          ${categories.map((category) => renderCommandCategoryArticle(category, platform)).join("")}
        </div>
      </div>
    </div>
  `;
}

export function renderHomePage(input?: {
  viewerLabel?: string | null;
  isLinked?: boolean;
  isAgentConnected?: boolean;
  live?: {
    isLive: boolean;
    title?: string | null;
    category?: string | null;
    viewerCount?: number | null;
  };
}) {
  const totalDiscordCommands = discordViewerCommandCategories.reduce((total, category) => total + category.commands.length, 0);
  const totalTwitchCommands = twitchViewerCommandCategories.reduce((total, category) => total + category.commands.length, 0);
  const defaultDiscordCategory = discordViewerCommandCategories[0]?.id ?? "";
  const defaultTwitchCategory = twitchViewerCommandCategories[0]?.id ?? "";
  const viewerLabel = input?.viewerLabel ?? null;
  const isLinked = input?.isLinked ?? false;
  const live = input?.live ?? null;
  const isAuthenticated = Boolean(viewerLabel);
  const heroPrimaryHref = isAuthenticated ? "/perfil" : "/auth/twitch/login";
  const heroPrimaryLabel = isAuthenticated ? "Abrir meu perfil" : "Entrar com Twitch";
  const heroSecondaryHref = isAuthenticated
    ? (isLinked ? "/auth/logout" : "/perfil")
    : "/perfil";
  const heroSecondaryLabel = isAuthenticated
    ? (isLinked ? "Encerrar sessao" : "Concluir vinculacao")
    : "Abrir meu perfil";
  const heroSessionText = isAuthenticated
    ? (isLinked
        ? `Sessao ativa de <strong class="text-white">${escapeHtml(viewerLabel!)}</strong>. Agora voce pode abrir seu perfil, acompanhar seus Firecoins e usar os atalhos da live.`
        : `Sessao ativa de <strong class="text-white">${escapeHtml(viewerLabel!)}</strong>. Falta so usar <strong class="text-white">/link</strong> no Discord para liberar seu perfil completo.`)
    : "Entre com a Twitch, vincule no Discord e desbloqueie seu perfil, seus Firecoins e os atalhos da live.";
  const quickAccessAuthMarkup = isAuthenticated
    ? `
      <a href="/auth/logout" class="float-card rounded-[22px] border border-white/8 bg-black/16 px-4 py-4 transition hover:border-ember-400/24">
        <strong class="block text-base font-semibold text-white">Encerrar sessao</strong>
        <span class="mt-1 block text-sm text-white/54">Troque de conta ou finalize a autenticacao atual.</span>
      </a>
    `
    : `
      <a href="/auth/twitch/login" class="float-card rounded-[22px] border border-white/8 bg-black/16 px-4 py-4 transition hover:border-ember-400/24">
        <strong class="block text-base font-semibold text-white">Login Twitch</strong>
        <span class="mt-1 block text-sm text-white/54">Entre com sua conta para comecar a juntar pontos e liberar seu perfil.</span>
      </a>
    `;
  const liveCardLabel = live?.isLive ? "Ao vivo agora" : "Streamer offline";
  const liveCardTitle = live?.isLive ? "A live esta acontecendo" : "No aguardo da stream";
  const liveCardDescription = live?.isLive
    ? (live.title ?? "A live esta rolando agora.")
    : "A stream nao esta no ar no momento, mas o perfil e os comandos continuam disponiveis.";
  const liveCardMeta = live?.isLive
    ? `${live.category ?? "Categoria nao informada"}${typeof live.viewerCount === "number" ? ` - ${live.viewerCount} viewers` : ""}`
    : "Volte quando abrir a stream para acompanhar tudo em tempo real.";

  const body = `
    <div class="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      ${renderSiteHeader({ active: "home", viewerLabel, isAgentConnected: input?.isAgentConnected })}
      <main class="mt-5 grid gap-5">
        <section class="site-panel noise-mask reveal-on-load relative overflow-hidden rounded-[36px] px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div class="fire-orb left-[-4rem] top-[-3rem] h-40 w-40 bg-ember-500/24"></div>
          <div class="fire-orb right-[8%] top-[10%] h-28 w-28 bg-amber-400/16"></div>
          <div class="fire-orb bottom-[-3rem] right-[-1rem] h-48 w-48 bg-ember-600/16"></div>
          <div class="relative grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_380px] xl:items-center">
            <div>
              <span class="section-kicker inline-flex rounded-full border border-ember-400/18 bg-ember-500/10 px-3 py-1 text-[11px] font-semibold uppercase text-ember-100">Feito para quem veio da live</span>
              <h1 class="hero-title mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl xl:text-7xl">Chegou da stream? Aqui voce entra, acompanha e participa.</h1>
              <p class="mt-5 max-w-2xl text-[15px] leading-8 text-white/62 sm:text-base">Voce entra com a Twitch, vincula no Discord, acompanha seus Firecoins, pede musica e descobre rapido o que usar para participar mais da live.</p>
              <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href="${heroPrimaryHref}" class="glow-button inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-ember-400 to-ember-600 px-6 py-3.5 text-sm font-semibold text-black transition hover:scale-[1.01]">${heroPrimaryLabel}</a>
                <a href="${heroSecondaryHref}" class="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/82 transition hover:border-ember-400/28 hover:bg-white/[0.06] hover:text-white">${heroSecondaryLabel}</a>
                <a href="#comandos" class="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-6 py-3.5 text-sm font-semibold text-white/62 transition hover:border-white/16 hover:text-white">Ver comandos</a>
              </div>
              <p class="mt-5 text-sm leading-7 text-white/54">${heroSessionText}</p>
              <div class="mt-8 grid gap-3 sm:grid-cols-3">
                <article class="site-panel-soft float-card rounded-[24px] p-4">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-white/42">Perfil</span>
                  <strong class="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-white">Veja o que voce juntou</strong>
                  <p class="mt-2 text-sm leading-7 text-white/54">Abra seu perfil para ver saldo, horas assistidas, boosts e recompensas liberadas.</p>
                </article>
                <article class="site-panel-soft float-card rounded-[24px] p-4">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-white/42">Live</span>
                  <strong class="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-white">Participe mais</strong>
                  <p class="mt-2 text-sm leading-7 text-white/54">Peca musica, acompanhe a stream e use os comandos certos sem precisar adivinhar.</p>
                </article>
                <article class="site-panel-soft float-card rounded-[24px] p-4">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-white/42">Comunidade</span>
                  <strong class="mt-2 block text-2xl font-semibold tracking-[-0.04em] text-white">Entre no ritmo</strong>
                  <p class="mt-2 text-sm leading-7 text-white/54">Conecte Twitch e Discord para liberar seu perfil e entrar de vez no fluxo da comunidade.</p>
                </article>
              </div>
            </div>

            <aside class="grid gap-4">
              <article class="neon-ring relative overflow-hidden rounded-[32px] border border-ember-400/18 bg-[linear-gradient(160deg,rgba(255,105,30,0.18),rgba(13,17,24,0.98))] p-6 shadow-ember-xl">
                <div class="fire-orb right-[-2rem] top-[-2rem] h-24 w-24 bg-amber-300/20"></div>
                <div class="relative">
                  <span class="section-kicker text-[10px] font-semibold uppercase text-amber-100/72">O que da para fazer</span>
                  <ul class="mt-4 grid gap-4 text-sm leading-7 text-white/72">
                    <li class="rounded-[22px] border border-white/10 bg-black/18 px-4 py-4">Voce entra com a Twitch e libera seu acesso para acompanhar tudo da live.</li>
                    <li class="rounded-[22px] border border-white/10 bg-black/18 px-4 py-4">Voce usa <strong class="text-white">/link</strong> no Discord e conecta seu perfil.</li>
                    <li class="rounded-[22px] border border-white/10 bg-black/18 px-4 py-4">Depois acompanha seus Firecoins, playlist e comandos da live em um so lugar.</li>
                  </ul>
                </div>
              </article>
              <article class="site-panel-soft float-card rounded-[30px] p-6">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <span class="section-kicker text-[10px] font-semibold uppercase text-white/42">Comece por aqui</span>
                    <h2 class="mt-2 text-2xl font-semibold text-white">Conecte e libere tudo</h2>
                  </div>
                  <div class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ember-100/76">3 passos</div>
                </div>
                <ol class="mt-5 grid gap-3 text-sm leading-7 text-white/60">
                  <li class="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3"><strong class="text-white">1.</strong> Entre com sua conta da Twitch.</li>
                  <li class="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3"><strong class="text-white">2.</strong> Va no Discord e digite <strong class="text-white">/link</strong> para vincular seu perfil.</li>
                  <li class="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3"><strong class="text-white">3.</strong> Depois acompanhe seus pontos, peca musica e participe da live com mais contexto.</li>
                </ol>
              </article>
            </aside>
          </div>
        </section>

        <section class="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <article class="site-panel reveal-on-load rounded-[34px] p-6 sm:p-8">
            <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">O que voce faz aqui</span>
            <h2 class="hero-title mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">Voce chega da live, faz isso e recebe isso.</h2>
            <div class="mt-6 grid gap-4 md:grid-cols-3">
              <article class="mesh-card rounded-[24px] border border-white/8 p-5">
                <strong class="block text-lg font-semibold text-white">Voce entra e acompanha</strong>
                <p class="mt-3 text-sm leading-7 text-white/56">Abra seu perfil para ver saldo, boost, horas assistidas e o que voce ja acumulou ficando na live.</p>
              </article>
              <article class="mesh-card rounded-[24px] border ${live?.isLive ? "border-ember-400/18 bg-[radial-gradient(circle_at_top,rgba(255,102,35,0.12),transparent_60%)]" : "border-white/8"} p-5">
                <span class="inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${live?.isLive ? "bg-ember-500/10 text-ember-100" : "bg-white/[0.04] text-white/54"}">${liveCardLabel}</span>
                <strong class="mt-3 block text-lg font-semibold text-white">${liveCardTitle}</strong>
                <p class="mt-3 text-sm leading-7 text-white/56">${escapeHtml(liveCardDescription)}</p>
                <p class="mt-3 text-xs uppercase tracking-[0.18em] text-white/38">${escapeHtml(liveCardMeta)}</p>
              </article>
              <article class="mesh-card rounded-[24px] border border-white/8 p-5">
                <strong class="block text-lg font-semibold text-white">Saber o comando certo</strong>
                <p class="mt-3 text-sm leading-7 text-white/56">Veja onde usar cada comando e entre na live sabendo exatamente o que digitar para participar mais.</p>
              </article>
            </div>
          </article>

          <aside class="site-panel-soft reveal-on-load rounded-[34px] p-6">
            <span class="section-kicker text-[10px] font-semibold uppercase text-white/42">Atalhos da live</span>
            <h2 class="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Rotas que voce mais vai usar</h2>
            <div class="mt-5 grid gap-3">
              <a href="/perfil" class="float-card rounded-[22px] border border-white/8 bg-black/16 px-4 py-4 transition hover:border-ember-400/24">
                <strong class="block text-base font-semibold text-white">Meu perfil</strong>
                <span class="mt-1 block text-sm text-white/54">Veja quanto voce juntou, seus boosts e o que esta rolando na live.</span>
              </a>
              ${quickAccessAuthMarkup}
              <a href="/privacidade" class="float-card rounded-[22px] border border-white/8 bg-black/16 px-4 py-4 transition hover:border-ember-400/24">
                <strong class="block text-base font-semibold text-white">Privacidade</strong>
                <span class="mt-1 block text-sm text-white/54">Resumo dos dados e do atendimento LGPD.</span>
              </a>
            </div>
          </aside>
        </section>

        <section id="comandos" class="site-panel reveal-on-load rounded-[34px] p-6 sm:p-8">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Achou um comando? Continue daqui</span>
              <h2 class="hero-title mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">Escolha onde voce vai usar e ache o comando certo.</h2>
              <p class="mt-3 max-w-2xl text-sm leading-7 text-white/58">Primeiro voce escolhe Discord ou Twitch. Depois abre so a parte que interessa para entrar na live sabendo exatamente o que digitar.</p>
            </div>
            <div class="inline-flex rounded-full border border-white/10 bg-black/22 p-1">
              <button type="button" class="command-tab-button rounded-full px-4 py-2 text-sm font-semibold transition" data-command-tab="discord">Discord</button>
              <button type="button" class="command-tab-button rounded-full px-4 py-2 text-sm font-semibold transition" data-command-tab="twitch">Twitch</button>
            </div>
          </div>

          <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-sm text-white/50">
              <span id="command-tab-caption">Discord - ${totalDiscordCommands} comandos</span>
            </div>
            <div class="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/44">
              navegue por subcategorias
            </div>
          </div>

          <div class="mt-6 grid gap-5">
            ${renderCommandPlatformPanel("discord")}
            ${renderCommandPlatformPanel("twitch")}
          </div>
        </section>
      </main>
      ${renderSiteFooter()}
    </div>
    <script>
      (() => {
        const platformButtons = Array.from(document.querySelectorAll(".command-tab-button"));
        const platformPanels = Array.from(document.querySelectorAll(".command-platform-panel"));
        const categoryButtons = Array.from(document.querySelectorAll(".command-category-button"));
        const categoryPanels = Array.from(document.querySelectorAll(".command-category-panel"));
        const caption = document.getElementById("command-tab-caption");
        const activeCategories = {
          discord: ${JSON.stringify(defaultDiscordCategory)},
          twitch: ${JSON.stringify(defaultTwitchCategory)}
        };
        const labels = {
          discord: "Discord - ${totalDiscordCommands} comandos",
          twitch: "Twitch - ${totalTwitchCommands} comandos"
        };

        function paintPlatformButtons(tab) {
          for (const button of platformButtons) {
            const isActive = button.getAttribute("data-command-tab") === tab;
            button.className = "command-tab-button rounded-full px-4 py-2 text-sm font-semibold transition " + (
              isActive
                ? "border border-ember-400/40 bg-gradient-to-r from-amber-300/24 to-ember-500/20 text-white shadow-[0_0_0_1px_rgba(255,112,38,0.10)]"
                : "border border-transparent text-white/62 hover:text-white"
            );
          }
        }

        function paintCategoryButtons(platform, categoryId) {
          for (const button of categoryButtons) {
            const samePlatform = button.getAttribute("data-command-platform") === platform;
            const isActive = samePlatform && button.getAttribute("data-command-category") === categoryId;
            button.className = "command-category-button flex items-center justify-between rounded-[18px] border px-4 py-3 text-left transition " + (
              isActive
                ? "border-ember-400/26 bg-ember-500/10 shadow-[0_0_0_1px_rgba(255,112,38,0.08)]"
                : "border-white/8 bg-black/18 hover:border-white/12"
            );
          }
        }

        function paintCategoryPanels(platform, categoryId) {
          for (const panel of categoryPanels) {
            const key = panel.getAttribute("data-command-category-panel");
            panel.classList.toggle("hidden", key !== platform + ":" + categoryId);
          }
        }

        function selectCategory(platform, categoryId) {
          activeCategories[platform] = categoryId;
          paintCategoryButtons(platform, categoryId);
          paintCategoryPanels(platform, categoryId);
        }

        function selectPlatform(tab) {
          paintPlatformButtons(tab);

          for (const panel of platformPanels) {
            const shouldShow = panel.getAttribute("data-command-panel") === tab;
            panel.classList.toggle("hidden", !shouldShow);
          }

          if (caption) {
            caption.textContent = labels[tab] || "";
          }

          selectCategory(tab, activeCategories[tab]);
        }

        for (const button of platformButtons) {
          button.addEventListener("click", () => {
            const tab = button.getAttribute("data-command-tab");
            if (tab === "discord" || tab === "twitch") {
              selectPlatform(tab);
            }
          });
        }

        for (const button of categoryButtons) {
          button.addEventListener("click", () => {
            const platform = button.getAttribute("data-command-platform");
            const categoryId = button.getAttribute("data-command-category");
            if ((platform === "discord" || platform === "twitch") && categoryId) {
              selectCategory(platform, categoryId);
            }
          });
        }

        selectPlatform("discord");
      })();

      (() => {
        const logo = document.querySelector("[data-agent-logo]");
        if (!(logo instanceof HTMLElement)) {
          return;
        }

        const connectedClasses = [
          "border-orange-400/80",
          "shadow-[0_0_0_1px_rgba(251,146,60,0.85),0_0_24px_rgba(249,115,22,0.55),0_0_54px_rgba(234,88,12,0.38)]",
          "animate-[emberPulse_1.8s_ease-in-out_infinite]"
        ];
        const disconnectedClasses = [
          "border-white/10",
          "shadow-[0_16px_48px_rgba(255,80,18,0.18)]"
        ];

        function paintAgentState(isConnected) {
          logo.dataset.agentConnected = isConnected ? "true" : "false";
          logo.classList.remove(...connectedClasses, ...disconnectedClasses);
          logo.classList.add(...(isConnected ? connectedClasses : disconnectedClasses));
        }

        async function refreshAgentState() {
          try {
            const response = await fetch("/api/agents/presence", {
              headers: { "accept": "application/json" },
              cache: "no-store"
            });

            if (!response.ok) {
              return;
            }

            const payload = await response.json();
            paintAgentState(Boolean(payload?.connected));
          } catch {
            return;
          }
        }

        paintAgentState(logo.dataset.agentConnected === "true");
        void refreshAgentState();
        window.setInterval(() => {
          void refreshAgentState();
        }, 5000);
      })();
    </script>
  `;

  return getSiteDocument("Vulkan Sentinel", body);
}
