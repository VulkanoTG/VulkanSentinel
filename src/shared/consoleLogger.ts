import path from "node:path";

type ConsoleMethod = "debug" | "error" | "info" | "log" | "warn";

const LOGGER_FILE_NAMES = new Set(["consoleLogger.ts", "consoleLogger.js"]);
const GENERIC_SOURCES = new Set(["app", "discord", "twitch"]);
const METHODS: ConsoleMethod[] = ["debug", "error", "info", "log", "warn"];

function getSimpleTimestamp() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function extractSourceFromStack() {
  const stack = new Error().stack ?? "";
  const lines = stack.split("\n");

  for (const line of lines) {
    const match = line.match(/\(?([A-Za-z]:\\[^():]+|\S+\/[^():]+):\d+:\d+\)?/);
    const filePath = match?.[1];

    if (!filePath) {
      continue;
    }

    const fileName = path.basename(filePath);
    if (LOGGER_FILE_NAMES.has(fileName)) {
      continue;
    }

    const normalizedPath = filePath.replaceAll("\\", "/");
    const srcIndex = normalizedPath.lastIndexOf("/src/");
    const relativePath = srcIndex >= 0 ? normalizedPath.slice(srcIndex + 5) : normalizedPath;
    const segments = relativePath.split("/").filter(Boolean);

    if (segments.length === 0) {
      return "app";
    }

    const fileSegment = segments.at(-1) ?? "app";
    const fileBaseName = fileSegment.replace(/\.[^.]+$/, "");

    if (fileBaseName === "index") {
      const parentSegment = segments.at(-2);
      return parentSegment ? toKebabCase(parentSegment) : "app";
    }

    return toKebabCase(fileBaseName);
  }

  return "app";
}

function extractTaggedSource(args: unknown[]) {
  const [firstArg, ...rest] = args;
  if (typeof firstArg !== "string") {
    return null;
  }

  const match = firstArg.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (!match) {
    return null;
  }

  const [, rawSource, message] = match;
  return {
    args: [message, ...rest],
    source: toKebabCase(rawSource),
  };
}

function buildPatchedArgs(args: unknown[]) {
  const timestamp = getSimpleTimestamp();
  const tagged = extractTaggedSource(args);
  const fallbackSource = extractSourceFromStack();
  const source = tagged && !GENERIC_SOURCES.has(tagged.source)
    ? tagged.source
    : fallbackSource;
  const nextArgs = tagged ? tagged.args : args;
  const prefix = `[${timestamp}] [${source}]`;

  if (nextArgs.length === 0) {
    return [prefix];
  }

  const [firstArg, ...restArgs] = nextArgs;
  if (typeof firstArg === "string") {
    if (firstArg.length === 0) {
      return [prefix];
    }

    return [`${prefix} ${firstArg}`, ...restArgs];
  }

  return [prefix, firstArg, ...restArgs];
}

export function patchConsole() {
  const consoleState = console as Console & { __vulkanLoggerPatched__?: boolean };
  if (consoleState.__vulkanLoggerPatched__) {
    return;
  }

  for (const method of METHODS) {
    const original = console[method].bind(console);
    console[method] = ((...args: unknown[]) => {
      original(...buildPatchedArgs(args));
    }) as Console[ConsoleMethod];
  }

  consoleState.__vulkanLoggerPatched__ = true;
}

patchConsole();
