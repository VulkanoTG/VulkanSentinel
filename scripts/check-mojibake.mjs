import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const includeDirs = ["src", "scripts", "docs", "public"];
const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".html",
  ".css",
  ".svg",
  ".yml",
  ".yaml",
  ".txt",
]);

const suspiciousPatterns = [
  new RegExp(`${String.fromCharCode(0x00c3)}.`, "g"),
  new RegExp(`${String.fromCharCode(0x00c2)}.`, "g"),
  /\uFFFD/g,
];

async function walk(dirPath, results) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await walk(absolutePath, results);
      continue;
    }

    if (!textExtensions.has(path.extname(entry.name))) {
      continue;
    }

    results.push(absolutePath);
  }
}

function formatRelative(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function collectMatches(content) {
  const matches = [];

  for (const pattern of suspiciousPatterns) {
    for (const match of content.matchAll(pattern)) {
      if (typeof match.index !== "number") {
        continue;
      }

      const previewStart = Math.max(0, match.index - 20);
      const previewEnd = Math.min(content.length, match.index + 20);
      matches.push({
        token: match[0],
        index: match.index,
        preview: content.slice(previewStart, previewEnd).replaceAll("\n", "\\n"),
      });
    }
  }

  return matches;
}

async function main() {
  const files = [];

  for (const dir of includeDirs) {
    const absoluteDir = path.join(rootDir, dir);

    try {
      const dirStat = await stat(absoluteDir);
      if (dirStat.isDirectory()) {
        await walk(absoluteDir, files);
      }
    } catch {
      // Ignore missing optional directories.
    }
  }

  const findings = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const matches = collectMatches(content);

    if (matches.length) {
      findings.push({
        filePath,
        matches,
      });
    }
  }

  if (!findings.length) {
    console.log("No suspicious mojibake patterns found.");
    return;
  }

  console.error("Suspicious mojibake patterns found:");

  for (const finding of findings) {
    console.error(`- ${formatRelative(finding.filePath)}`);

    for (const match of finding.matches.slice(0, 5)) {
      console.error(`  token=${JSON.stringify(match.token)} preview="${match.preview}"`);
    }

    if (finding.matches.length > 5) {
      console.error(`  ... and ${finding.matches.length - 5} more matches`);
    }
  }

  process.exitCode = 1;
}

await main();
