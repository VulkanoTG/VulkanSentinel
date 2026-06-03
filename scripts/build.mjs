import { cp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(rootDir, "build");

async function runTsc() {
  const tscEntrypoint = path.join(rootDir, "node_modules", "typescript", "bin", "tsc");

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tscEntrypoint], {
      cwd: rootDir,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`tsc finalizou com codigo ${code ?? "desconhecido"}.`));
    });

    child.on("error", reject);
  });
}

async function runPrismaGenerate() {
  const prismaEntrypoint = path.join(rootDir, "node_modules", "prisma", "build", "index.js");

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prismaEntrypoint, "generate", "--config", "prisma.config.ts"], {
      cwd: rootDir,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`prisma generate finalizou com codigo ${code ?? "desconhecido"}.`));
    });

    child.on("error", reject);
  });
}

async function copyDirectory(sourceRelativePath, targetRelativePath) {
  const sourcePath = path.join(rootDir, sourceRelativePath);
  const targetPath = path.join(buildDir, targetRelativePath);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true });
}

async function main() {
  await rm(buildDir, { recursive: true, force: true });
  await runPrismaGenerate();
  await runTsc();
  await copyDirectory("src/generated", "generated");
  await copyDirectory("src/assets", "assets");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
