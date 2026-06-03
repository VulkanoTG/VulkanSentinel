import { type TwitchStream } from "./twitchHelix.js";

type BuildTwitchStreamPreviewUrlInput = {
  stream: TwitchStream;
  width?: number;
  height?: number;
  cacheKey?: string | number;
};

export function buildTwitchStreamPreviewUrl(input: BuildTwitchStreamPreviewUrlInput) {
  const width = input.width ?? 1280;
  const height = input.height ?? 720;
  const cacheKey = String(input.cacheKey ?? Date.now());

  const previewUrl = input.stream.thumbnail_url
    .replace("{width}", String(width))
    .replace("{height}", String(height));

  const url = new URL(previewUrl);
  url.searchParams.set("cb", cacheKey);

  return url.toString();
}
