import { appConfig } from "#config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandCategory } from "../../services/commandCatalog.js";

const SITE_LOGO_URL = "/assets/images/vulkan-sentinel.png";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildProfileLoginUrl() {
  return "/auth/twitch/login";
}

export function formatWatchedHours(hoursWatched: number | null | undefined) {
  const totalMinutes = Math.max(0, Math.round((hoursWatched ?? 0) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function maskIdentifier(value: string | null | undefined) {
  if (!value) {
    return "Não vinculado";
  }

  if (value.length <= 4) {
    return "*".repeat(value.length);
  }

  return `${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

function resolveSiteLogoFilePath() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "src/assets/images/VulkanSemtinel.png"),
    path.resolve(process.cwd(), "assets/images/VulkanSemtinel.png"),
    path.resolve(process.cwd(), "build/assets/images/VulkanSemtinel.png"),
    path.resolve(currentDir, "../assets/images/VulkanSemtinel.png"),
    path.resolve(currentDir, "../../assets/images/VulkanSemtinel.png"),
    path.resolve(currentDir, "../../../src/assets/images/VulkanSemtinel.png"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

export const SITE_LOGO_FILE_PATH = resolveSiteLogoFilePath();

export function getSiteDocument(title: string, body: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="icon" type="image/png" href="${escapeHtml(SITE_LOGO_URL)}" />
  <link rel="shortcut icon" href="${escapeHtml(SITE_LOGO_URL)}" />
  <link rel="apple-touch-icon" href="${escapeHtml(SITE_LOGO_URL)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            ember: {
              50: "#fff5ef",
              100: "#ffe0c7",
              200: "#ffbf7f",
              300: "#ff9447",
              400: "#ff6829",
              500: "#ff4a12",
              600: "#ff2f06",
              700: "#d82600"
            },
            coal: {
              950: "#05070b",
              900: "#090d14",
              850: "#0d121b",
              800: "#131a25"
            },
            neon: {
              amber: "#ffb14a",
              lava: "#ff5a1f",
              rose: "#ff7c5c"
            }
          },
          boxShadow: {
            "ember-xl": "0 30px 90px rgba(0,0,0,0.52), 0 0 0 1px rgba(255,255,255,0.02)",
            "ember-glow": "0 0 0 1px rgba(255,120,48,0.18), 0 0 34px rgba(255,88,22,0.18)"
          }
        }
      }
    };
  </script>
  <style>
    :root {
      --line: rgba(255,255,255,0.10);
      --line-strong: rgba(255,255,255,0.15);
      --panel: linear-gradient(180deg, rgba(18,22,31,0.86), rgba(8,10,16,0.82));
      --panel-soft: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02));
      --text-soft: rgba(248,250,252,0.68);
      --text-muted: rgba(248,250,252,0.52);
      --glow: rgba(255,94,31,0.24);
    }
    * {
      box-sizing: border-box;
    }
    html {
      scroll-behavior: smooth;
    }
    body {
      background:
        radial-gradient(60rem 32rem at 8% -4%, rgba(255, 84, 22, 0.22), transparent 56%),
        radial-gradient(36rem 24rem at 100% 0%, rgba(255, 177, 74, 0.12), transparent 58%),
        radial-gradient(40rem 30rem at 50% 110%, rgba(255, 60, 18, 0.12), transparent 62%),
        linear-gradient(180deg, #07090d 0%, #04060a 100%);
      color: #f8fafc;
      font-family: "Space Grotesk", "Segoe UI", sans-serif;
      overflow-x: hidden;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
      background-size: 36px 36px;
      mask-image: radial-gradient(circle at center, black, transparent 85%);
      opacity: 0.42;
    }
    body::after {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.02), transparent 18%, transparent 82%, rgba(255,140,70,0.03)),
        radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.18) 100%);
      mix-blend-mode: screen;
      opacity: 0.7;
    }
    .fire-orb {
      position: absolute;
      border-radius: 999px;
      filter: blur(30px);
      pointer-events: none;
      opacity: 0.92;
    }
    .site-shell {
      position: relative;
      isolation: isolate;
    }
    .site-panel {
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: 0 26px 80px rgba(0,0,0,0.5);
      backdrop-filter: blur(20px);
    }
    .site-panel-soft {
      border: 1px solid rgba(255,255,255,0.08);
      background: var(--panel-soft);
      box-shadow: 0 24px 72px rgba(0,0,0,0.42);
      backdrop-filter: blur(18px);
    }
    .hero-title,
    .display-title {
      font-family: "Rajdhani", "Space Grotesk", sans-serif;
      text-wrap: balance;
    }
    .section-kicker {
      letter-spacing: 0.28em;
    }
    .neon-ring {
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,0.04),
        0 0 0 1px rgba(255,112,38,0.14),
        0 0 30px rgba(255,84,22,0.12);
    }
    .mesh-card {
      background:
        linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)),
        radial-gradient(circle at top right, rgba(255,112,38,0.12), transparent 36%);
    }
    .ambient-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    }
    .nav-link {
      position: relative;
      color: var(--text-soft);
      transition: color .18s ease, transform .18s ease;
    }
    .nav-link:hover,
    .nav-link.active {
      color: #fff;
      transform: translateY(-1px);
    }
    .nav-link::after {
      content: "";
      position: absolute;
      left: 0;
      bottom: -0.6rem;
      width: 100%;
      height: 2px;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform .18s ease, opacity .18s ease;
      background: linear-gradient(90deg, rgba(255,122,47,0.94), rgba(255,194,120,0.84));
      opacity: 0.45;
    }
    .nav-link:hover::after,
    .nav-link.active::after {
      transform: scaleX(1);
      opacity: 1;
    }
    .glow-button {
      box-shadow: 0 18px 50px rgba(255,82,18,0.28);
    }
    .reveal-on-load {
      opacity: 0;
      transform: translateY(18px);
      transition: opacity .55s ease, transform .55s ease;
    }
    .reveal-on-load.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .noise-mask::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image:
        radial-gradient(rgba(255,255,255,0.04) 0.8px, transparent 0.8px);
      background-size: 10px 10px;
      opacity: 0.04;
      mix-blend-mode: screen;
    }
    .scrollbar-fire {
      scrollbar-width: thin;
      scrollbar-color: rgba(255,130,70,0.45) transparent;
    }
    .scrollbar-fire::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .scrollbar-fire::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(255,176,96,0.68), rgba(255,82,18,0.68));
      border-radius: 999px;
    }
    .scrollbar-fire::-webkit-scrollbar-track {
      background: transparent;
    }
    .badge-pulse {
      animation: emberPulse 2.8s ease-in-out infinite;
    }
    .float-card {
      transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease;
    }
    .float-card:hover {
      transform: translateY(-4px);
      border-color: rgba(255,126,62,0.22);
      box-shadow: 0 24px 72px rgba(0,0,0,0.44), 0 0 0 1px rgba(255,110,48,0.1);
    }
    @keyframes emberPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,95,31,0.18); }
      50% { box-shadow: 0 0 0 10px rgba(255,95,31,0.02); }
    }
    @media (prefers-reduced-motion: reduce) {
      html {
        scroll-behavior: auto;
      }
      .reveal-on-load,
      .float-card,
      .nav-link,
      .nav-link::after {
        transition: none;
      }
      .badge-pulse {
        animation: none;
      }
    }
  </style>
</head>
<body class="min-h-screen antialiased">
<div class="site-shell">${body}</div>
<script>
  (() => {
    const nodes = Array.from(document.querySelectorAll(".reveal-on-load"));
    if (!nodes.length) return;

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const node of nodes) {
        node.classList.add("is-visible");
      }
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, {
      threshold: 0.12
    });

    for (const node of nodes) {
      observer.observe(node);
    }
  })();
</script>
</body>
</html>`;
}

export function renderSiteFooter() {
  return `
    <footer class="reveal-on-load mt-8 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-5 py-5 shadow-[0_24px_64px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:px-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-sm font-medium text-white/78">Vulkan Sentinel</p>
          <p class="mt-1 text-sm leading-7 text-white/48">Entre com a Twitch, vincule sua conta no Discord, junte Firecoins e use os atalhos da live sem se perder no chat.</p>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-white/40">
          <span>Dark UI</span>
          <span>Fire Neon</span>
          <span>Twitch + Discord</span>
        </div>
      </div>
    </footer>
  `;
}

export function renderSiteHeader(input: {
  active: "home" | "profile" | "privacy";
  viewerLabel?: string | null;
  isAgentConnected?: boolean;
}) {
  const agentLogoClass = input.isAgentConnected
    ? "border-orange-400/80 shadow-[0_0_0_1px_rgba(251,146,60,0.85),0_0_24px_rgba(249,115,22,0.55),0_0_54px_rgba(234,88,12,0.38)] animate-[emberPulse_1.8s_ease-in-out_infinite]"
    : "border-white/10 shadow-[0_16px_48px_rgba(255,80,18,0.18)]";

  return `
    <header class="site-panel noise-mask reveal-on-load relative overflow-hidden rounded-[30px] px-5 py-5 sm:px-7">
      <div class="fire-orb left-[-3rem] top-[-3rem] h-32 w-32 bg-ember-500/26"></div>
      <div class="fire-orb right-[-2rem] top-[-2rem] h-24 w-24 bg-amber-400/14"></div>
      <div class="fire-orb bottom-[-2rem] left-[18%] h-20 w-20 bg-ember-400/10"></div>
      <div class="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div class="flex flex-col gap-5">
          <a href="/" class="flex items-center gap-4">
            <img
              src="${escapeHtml(SITE_LOGO_URL)}"
              alt="Vulkan Sentinel"
              data-agent-logo
              data-agent-connected="${input.isAgentConnected ? "true" : "false"}"
              class="h-14 w-14 rounded-[1.35rem] border bg-black/30 object-cover transition-all duration-300 ${agentLogoClass}"
            />
            <div>
              <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Veio da live?</span>
              <strong class="display-title block text-[1.6rem] font-semibold tracking-[-0.04em] text-white">Vulkan Sentinel</strong>
              <span class="mt-1 block max-w-xl text-sm leading-6 text-white/58">Entre com sua Twitch, vincule sua conta no Discord e acompanhe tudo o que você ganha e usa durante a live.</span>
            </div>
          </a>
          <nav class="flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px] font-medium">
            <a href="/" class="nav-link ${input.active === "home" ? "active" : ""}">Inicio</a>
            <a href="/perfil" class="nav-link ${input.active === "profile" ? "active" : ""}">Perfil</a>
            <a href="/privacidade" class="nav-link ${input.active === "privacy" ? "active" : ""}">Privacidade</a>
            <a href="${escapeHtml(appConfig.discord.inviteUrl)}" class="nav-link">Discord</a>
          </nav>
        </div>
        <div class="flex flex-col items-start gap-2 xl:items-end">
          ${input.viewerLabel
            ? `
              <span class="inline-flex items-center gap-2 rounded-full border border-emerald-400/16 bg-emerald-400/8 px-3 py-1 text-sm text-white/72">
                <span class="badge-pulse h-2 w-2 rounded-full bg-emerald-400"></span>
                Sessão ativa de <strong class="font-semibold text-white">${escapeHtml(input.viewerLabel)}</strong>
              </span>
              <a href="/auth/logout" class="inline-flex items-center gap-2 text-sm font-medium text-white/76 transition hover:text-white">
                Encerrar sessão
              </a>
            `
            : `<span class="max-w-xs text-sm leading-7 text-white/52 xl:text-right">Entre com a Twitch para liberar seu perfil, suas recompensas e os atalhos da live.</span>`}
        </div>
      </div>
    </header>
  `;
}

export function renderCommandGroups(categories: CommandCategory[], platformLabel: string) {
  return `
    <section class="rounded-[28px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span class="text-xs font-semibold uppercase tracking-[0.22em] text-ember-200/82">${escapeHtml(platformLabel)}</span>
          <h3 class="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Comandos mais usados</h3>
        </div>
        <span class="text-sm text-white/52">Organizados por categoria</span>
      </div>
      <div class="mt-5 grid gap-4">
        ${categories.map((category) => `
          <article class="rounded-[24px] border border-white/8 bg-black/18 p-5">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 class="text-lg font-semibold text-white">${escapeHtml(category.label)}</h4>
                <p class="mt-1 text-sm leading-7 text-white/58">${escapeHtml(category.description)}</p>
              </div>
              <span class="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ember-100/78">${category.commands.length} comandos</span>
            </div>
            <ul class="mt-4 grid gap-3">
              ${category.commands.map((command) => `
                <li class="rounded-[20px] border border-white/8 bg-white/[0.02] px-4 py-3">
                  <strong class="block text-sm font-semibold text-ember-100">${escapeHtml(command.name)}</strong>
                  <span class="mt-1 block text-sm leading-7 text-white/66">${escapeHtml(command.description)}</span>
                </li>
              `).join("")}
            </ul>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}
