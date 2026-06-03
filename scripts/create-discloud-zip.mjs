import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "discloud", "deploy");
const stagingDir = path.join(outputDir, "__staging__");

const includedPaths = [
  ".env",
  ".discloudignore",
  "discloud.config",
  "package-lock.json",
  "package.json",
  "prisma.config.ts",
  "tsconfig.json",
  "prisma",
  "public",
  "scripts",
  "src",
];

async function readDiscloudAppId() {
  const configPath = path.join(rootDir, "discloud.config");
  const configContent = await readFile(configPath, "utf8");
  const appIdLine = configContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("ID="));

  return appIdLine?.slice(3).trim() || "discloud-app";
}

async function copyIncludedPaths() {
  for (const relativePath of includedPaths) {
    const sourcePath = path.join(rootDir, relativePath);

    if (!existsSync(sourcePath)) {
      continue;
    }

    const targetPath = path.join(stagingDir, relativePath);
    const sourceStat = await stat(sourcePath);

    if (sourceStat.isDirectory()) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await cp(sourcePath, targetPath, { recursive: true, force: true });
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { force: true });
  }
}

async function removeUnwantedPathsFromStaging() {
  const pathsToRemove = [
    path.join(stagingDir, "src", "generated"),
    path.join(stagingDir, "discloud"),
    path.join(stagingDir, "node_modules"),
  ];

  for (const targetPath of pathsToRemove) {
    await rm(targetPath, { recursive: true, force: true });
  }
}

async function collectStagedFiles(currentDir, relativeDir = "") {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryRelativePath = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name;
    const entryAbsolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectStagedFiles(entryAbsolutePath, entryRelativePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryRelativePath);
    }
  }

  return files;
}

async function compressArchive(zipFilePath) {
  const archiveName = path.basename(zipFilePath);
  const manifestPath = path.join(outputDir, "__staging_manifest__.json");
  const stagedFiles = await collectStagedFiles(stagingDir);

  await writeFile(manifestPath, JSON.stringify(stagedFiles, null, 2), "utf8");

  const command = [
    "-NoProfile",
    "-Command",
    [
      `$ErrorActionPreference = 'Stop'`,
      `Add-Type -AssemblyName System.IO.Compression`,
      `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
      `$stagingDir = '${stagingDir.replace(/'/g, "''")}'`,
      `$zipPath = '${zipFilePath.replace(/'/g, "''")}'`,
      `$manifestPath = '${manifestPath.replace(/'/g, "''")}'`,
      `if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }`,
      `$files = Get-Content -LiteralPath $manifestPath | ConvertFrom-Json`,
      `$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)`,
      `try {`,
      `  foreach ($relativePath in $files) {`,
      `    $sourcePath = Join-Path $stagingDir $relativePath`,
      `    $normalizedPath = ($relativePath -replace '\\\\', '/')`,
      `    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $sourcePath, $normalizedPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null`,
      `  }`,
      `} finally {`,
      `  $zip.Dispose()`,
      `}`,
      `Write-Output 'ZIP criado: ${archiveName}'`,
    ].join("; "),
  ];

  try {
    await new Promise((resolve, reject) => {
      const child = spawn("powershell", command, {
        cwd: rootDir,
        stdio: "inherit",
        shell: false,
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Compactacao do ZIP finalizou com codigo ${code ?? "desconhecido"}.`));
      });

      child.on("error", reject);
    });
  } finally {
    await rm(manifestPath, { force: true });
  }
}

async function main() {
  const appId = await readDiscloudAppId();
  const zipFilePath = path.join(outputDir, `${appId}-discloud.zip`);

  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  await copyIncludedPaths();
  await removeUnwantedPathsFromStaging();
  await compressArchive(zipFilePath);
  await rm(stagingDir, { recursive: true, force: true });

  console.log(`[Discloud] Pacote pronto em: ${zipFilePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
