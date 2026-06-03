import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variavel ${name} nao configurada.`);
  }
  return value;
}

function openBrowser(url) {
  const platform = process.platform;

  if (platform === "win32") {
    const escapedUrl = url.replace(/'/g, "''");
    spawn(
      "powershell",
      ["-NoProfile", "-Command", `Start-Process '${escapedUrl}'`],
      { stdio: "ignore", detached: true }
    );
    return;
  }

  if (platform === "darwin") {
    spawn("open", [url], { stdio: "ignore", detached: true });
    return;
  }

  spawn("xdg-open", [url], { stdio: "ignore", detached: true });
}

function buildBasicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function exchangeCodeForTokens(input) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(input.clientId, input.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Spotify token endpoint ${response.status}: ${bodyText}`);
  }

  return JSON.parse(bodyText);
}

async function main() {
  const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET");
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim() || "http://127.0.0.1:3456/spotify/callback";
  const scopes = ["user-modify-playback-state", "user-read-playback-state"];
  const state = crypto.randomBytes(16).toString("hex");
  const redirectUrl = new URL(redirectUri);

  if (!["127.0.0.1", "localhost"].includes(redirectUrl.hostname)) {
    throw new Error("SPOTIFY_REDIRECT_URI precisa apontar para localhost ou 127.0.0.1 para este script.");
  }

  const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scopes.join(" "));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("show_dialog", "true");

  const result = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", redirectUri);

        if (requestUrl.pathname !== redirectUrl.pathname) {
          res.statusCode = 404;
          res.end("Rota nao encontrada.");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        const returnedState = requestUrl.searchParams.get("state");
        const code = requestUrl.searchParams.get("code");

        if (error) {
          res.statusCode = 400;
          res.end(`Autorizacao recusada: ${error}`);
          server.close();
          reject(new Error(`Spotify retornou erro: ${error}`));
          return;
        }

        if (!code || returnedState !== state) {
          res.statusCode = 400;
          res.end("State ou code invalido.");
          server.close();
          reject(new Error("State ou code invalido no callback do Spotify."));
          return;
        }

        const tokenData = await exchangeCodeForTokens({
          clientId,
          clientSecret,
          code,
          redirectUri,
        });

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Spotify autorizado</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; padding: 32px; background: #121212; color: #fff; }
      .card { max-width: 640px; margin: 0 auto; padding: 24px; border-radius: 16px; background: #1f1f1f; }
      code { background: #0f0f0f; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Spotify autorizado</h1>
      <p>O refresh token foi gerado. Pode voltar ao terminal.</p>
    </div>
  </body>
</html>`);

        server.close();
        resolve(tokenData);
      } catch (error) {
        try {
          res.statusCode = 500;
          res.end("Erro ao processar callback.");
        } catch {}
        server.close();
        reject(error);
      }
    });

    server.on("error", reject);
    server.listen(Number(redirectUrl.port || 80), redirectUrl.hostname, () => {
      console.log(`[Spotify] Callback ouvindo em ${redirectUri}`);
      console.log("[Spotify] Se o navegador nao abrir, use esta URL manualmente:");
      console.log(authorizeUrl.toString());
      console.log("[Spotify] Verifique tambem se a Redirect URI no painel do Spotify e exatamente igual a esta:");
      console.log(redirectUri);

      try {
        openBrowser(authorizeUrl.toString());
      } catch (error) {
        console.warn("[Spotify] Nao consegui abrir o navegador automaticamente.");
      }
    });
  });

  console.log("");
  console.log("SPOTIFY_REFRESH_TOKEN=");
  console.log(result.refresh_token ?? "");
  console.log("");
  console.log("Cole no .env:");
  console.log(`SPOTIFY_REFRESH_TOKEN=${result.refresh_token ?? ""}`);

  if (!result.refresh_token) {
    console.warn("[Spotify] O Spotify nao retornou refresh_token. Tente revogar a autorizacao do app e repetir com show_dialog=true.");
  }
}

main().catch((error) => {
  console.error("[Spotify] Falha ao gerar refresh token:", error.message);
  process.exitCode = 1;
});
