function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variavel ${name} nao configurada.`);
  }
  return value;
}

function buildBasicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function getSpotifyAccessToken() {
  const clientId = getRequiredEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = getRequiredEnv("SPOTIFY_CLIENT_SECRET");
  const refreshToken = getRequiredEnv("SPOTIFY_REFRESH_TOKEN");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Spotify token endpoint ${response.status}: ${bodyText}`);
  }

  const data = JSON.parse(bodyText);
  if (!data.access_token) {
    throw new Error("Resposta do Spotify sem access_token.");
  }

  return data.access_token;
}

async function main() {
  const accessToken = await getSpotifyAccessToken();
  const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Spotify devices endpoint ${response.status}: ${bodyText}`);
  }

  const data = JSON.parse(bodyText);
  const devices = data.devices ?? [];

  if (devices.length === 0) {
    console.log("Nenhum device encontrado.");
    console.log("Abra o Spotify em algum dispositivo e deixe a conta ativa.");
    return;
  }

  console.log("Devices encontrados:");
  console.log("");

  for (const device of devices) {
    console.log(`Nome: ${device.name}`);
    console.log(`ID: ${device.id}`);
    console.log(`Tipo: ${device.type}`);
    console.log(`Ativo: ${device.is_active ? "sim" : "nao"}`);
    console.log(`Restrito: ${device.is_restricted ? "sim" : "nao"}`);
    console.log("");
  }

  const activeDevice = devices.find((device) => device.is_active);
  if (activeDevice?.id) {
    console.log(`SPOTIFY_DEVICE_ID=${activeDevice.id}`);
  }
}

main().catch((error) => {
  console.error("[Spotify] Falha ao listar devices:", error.message);
  process.exitCode = 1;
});
