const port = Number(process.env.PORT ?? 3000);
const baseUrl = process.env.OVERLAY_PREVIEW_URL ?? `http://127.0.0.1:${port}`;
const endpoint = `${baseUrl}/api/overlays/chat/mock`;
const overlayUrl = `${baseUrl}/overlays/chat/vulkan-terminal`;

const samples = [
  {
    username: "vulkan_core",
    message: "Sistema de forja online. Fluxo termico estabilizado.",
    role: "default",
    badge: "V-LINK",
  },
  {
    username: "ember_sub",
    message: "Energia de magma redirecionada para o terminal da live.",
    role: "subscriber",
    badge: null,
  },
  {
    username: "sentinela_mod",
    message: "Canal monitorado. Integridade do chat em 99.4%.",
    role: "moderator",
    badge: "SENTINELA",
  },
  {
    username: "forge_unit",
    message: "Reator secundario aquecido. Interface pronta para OBS.",
    role: "default",
    badge: null,
  },
  {
    username: "amber_link",
    message: "Vinculo Vulkan detectado. Credenciais aceitas.",
    role: "subscriber",
    badge: "V-LINK",
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendSample(sample) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(sample),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao enviar mock (${response.status}): ${text}`);
  }
}

async function waitForServer() {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      await sendSample({
        username: "boot",
        message: "Handshake local do overlay concluido.",
        role: "default",
        badge: null,
      });
      return;
    } catch (error) {
      if (attempt === 40) {
        throw error;
      }

      await sleep(1000);
    }
  }
}

async function main() {
  console.log(`[overlay-preview] Overlay local: ${overlayUrl}`);
  console.log(`[overlay-preview] Enviando mensagens fake para: ${endpoint}`);
  await waitForServer();

  let index = 0;
  while (true) {
    const sample = samples[index % samples.length];
    await sendSample(sample);
    index += 1;
    await sleep(2200);
  }
}

main().catch((error) => {
  console.error("[overlay-preview] Erro:", error);
  process.exit(1);
});
