import { getPrivacyNoticeVersion, getPrivacyPolicyUrl } from "../../services/privacyService.js";
import { escapeHtml } from "./shared.js";

export function renderLinkSuccessPage(twitchDisplayName: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Conta vinculada</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #1b0c06;
      --card: #2a140a;
      --text: #fff2e0;
      --muted: #f3bf87;
      --ok: #ffb347;
      --ring: #ff6a00;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background:
        radial-gradient(1000px 620px at 12% -8%, rgba(255, 140, 0, 0.35) 0%, transparent 55%),
        radial-gradient(800px 520px at 100% 0%, rgba(255, 69, 0, 0.3) 0%, transparent 60%),
        linear-gradient(170deg, #2a1108 0%, var(--bg) 55%, #130702 100%);
      color: var(--text);
    }
    .card {
      width: 100%;
      max-width: 520px;
      background:
        linear-gradient(180deg, rgba(255, 166, 77, 0.08), rgba(255, 88, 0, 0.06)),
        var(--card);
      border: 1px solid rgba(255, 145, 0, 0.35);
      border-radius: 18px;
      padding: 28px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.5), 0 0 25px rgba(255, 106, 0, 0.22);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--ring), transparent 40%);
      color: var(--ring);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--ok), transparent 83%);
    }
    h1 {
      margin: 16px 0 10px;
      font-size: 28px;
      line-height: 1.2;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 15px;
    }
    strong { color: var(--text); }
    .footer {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 145, 0, 0.24);
      font-size: 13px;
      color: var(--muted);
    }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 22px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 0 18px;
      border-radius: 999px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      transition: transform .18s ease, border-color .18s ease, opacity .18s ease;
    }
    .button:hover {
      transform: translateY(-1px);
    }
    .button-primary {
      background: linear-gradient(135deg, #ffcf7b 0%, #ff8a1f 48%, #ff5a00 100%);
      color: #190b03;
      box-shadow: 0 14px 34px rgba(255, 106, 0, 0.28);
    }
    .button-secondary {
      border: 1px solid rgba(255, 145, 0, 0.28);
      color: var(--text);
      background: rgba(255, 255, 255, 0.03);
    }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge"><span class="dot"></span>Integracao concluida</span>
    <h1>Conta vinculada com sucesso</h1>
    <p>A conta da Twitch <strong>${escapeHtml(twitchDisplayName)}</strong> foi conectada ao seu Discord.</p>
    <div class="actions">
      <a href="/perfil" class="button button-primary">Abrir meu dashboard</a>
      <a href="/" class="button button-secondary">Voltar para o inicio</a>
    </div>
    <p class="footer">Voce ja pode fechar esta aba e voltar ao Discord. Aviso de privacidade: versao ${escapeHtml(getPrivacyNoticeVersion())}${getPrivacyPolicyUrl() ? ` - <a href="${escapeHtml(getPrivacyPolicyUrl()!)}" style="color: var(--text);">abrir aviso</a>` : ""}</p>
  </main>
</body>
</html>`;
}
