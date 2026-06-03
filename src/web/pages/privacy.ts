import {
  buildPrivacySummaryLines,
  getPrivacyContactEmail,
  getPrivacyNoticeVersion,
  getPrivacyPolicyUrl,
} from "../../services/privacyService.js";
import { escapeHtml, getSiteDocument, renderSiteFooter, renderSiteHeader } from "./shared.js";

export function renderPrivacyPage() {
  const policyUrl = getPrivacyPolicyUrl();
  const contactEmail = getPrivacyContactEmail();
  const summaryItems = buildPrivacySummaryLines()
    .map((line) => `<li class="rounded-[22px] border border-white/8 bg-black/16 px-4 py-4 text-sm leading-7 text-white/68">${escapeHtml(line)}</li>`)
    .join("");

  const body = `
    <div class="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      ${renderSiteHeader({ active: "privacy" })}
      <main class="mt-5 grid gap-5">
        <section class="site-panel noise-mask reveal-on-load relative overflow-hidden rounded-[36px] p-6 shadow-ember-xl sm:p-8 lg:p-10">
          <div class="fire-orb left-[-3rem] top-[-2rem] h-36 w-36 bg-ember-500/22"></div>
          <div class="fire-orb right-[8%] top-[10%] h-24 w-24 bg-amber-400/12"></div>
          <div class="relative">
            <span class="section-kicker inline-flex rounded-full border border-ember-400/20 bg-ember-500/10 px-3 py-1 text-[11px] font-semibold uppercase text-ember-100">Privacidade</span>
            <h1 class="hero-title mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">Como o Vulkan Sentinel trata seus dados.</h1>
            <p class="mt-5 max-w-3xl text-sm leading-8 text-white/64 sm:text-[15px]">Este aviso resume as informacoes principais sobre tratamento de dados, direitos do titular e canais de contato. Versao ${escapeHtml(getPrivacyNoticeVersion())}.</p>
          </div>
        </section>

        <section class="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_340px]">
          <article class="site-panel-soft reveal-on-load rounded-[34px] p-6">
            <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Resumo pratico</span>
            <h2 class="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">O essencial em leitura rapida</h2>
            <ul class="mt-6 grid gap-3">${summaryItems}</ul>
          </article>

          <aside class="site-panel-soft reveal-on-load rounded-[34px] p-6">
            <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Referencia</span>
            <div class="mt-4 grid gap-3 text-sm leading-7 text-white/60">
              <div class="rounded-[22px] border border-white/8 bg-black/16 px-4 py-4">
                <strong class="block text-white">Versao do aviso</strong>
                <span class="mt-1 block">${escapeHtml(getPrivacyNoticeVersion())}</span>
              </div>
              <div class="rounded-[22px] border border-white/8 bg-black/16 px-4 py-4">
                <strong class="block text-white">Contato</strong>
                <span class="mt-1 block">${escapeHtml(contactEmail ?? "Configure PRIVACY_CONTACT_EMAIL")}</span>
              </div>
              <div class="rounded-[22px] border border-white/8 bg-black/16 px-4 py-4">
                <strong class="block text-white">URL publica</strong>
                <span class="mt-1 block break-all">${escapeHtml(policyUrl ?? "Configure PRIVACY_POLICY_URL ou use a rota /privacidade.")}</span>
              </div>
            </div>
          </aside>
        </section>

        <section class="grid gap-4 lg:grid-cols-2">
          <article class="site-panel-soft reveal-on-load rounded-[30px] p-6">
            <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Direitos</span>
            <h2 class="mt-3 text-3xl font-semibold text-white">Direitos do titular</h2>
            <p class="mt-4 text-sm leading-8 text-white/64">Voce pode solicitar confirmacao de tratamento, acesso, correcao, revisao e medidas sobre dados desnecessarios, excessivos ou tratados em desconformidade. O bot tambem oferece o comando <code>/lgpd</code> no Discord.</p>
          </article>
          <article class="site-panel-soft reveal-on-load rounded-[30px] p-6">
            <span class="section-kicker text-[10px] font-semibold uppercase text-ember-100/72">Contato</span>
            <h2 class="mt-3 text-3xl font-semibold text-white">Canal de atendimento</h2>
            <p class="mt-4 text-sm leading-8 text-white/64">Se precisar de acesso, correcao, exclusao ou revisao, use o canal configurado no ambiente do bot para centralizar o atendimento e manter rastreabilidade.</p>
            <div class="mt-5 rounded-[22px] border border-white/8 bg-black/16 px-4 py-4 text-sm leading-7 text-white/68">
              <strong class="block text-white">Email configurado</strong>
              <span class="mt-1 block">${escapeHtml(contactEmail ?? "Configure PRIVACY_CONTACT_EMAIL")}</span>
            </div>
          </article>
        </section>
      </main>
      ${renderSiteFooter()}
    </div>
  `;

  return getSiteDocument("Privacidade | Vulkan Sentinel", body);
}
