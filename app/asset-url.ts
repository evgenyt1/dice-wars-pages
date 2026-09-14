// Vite replaces import.meta.env at build time; plain Node tests have none.
const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
const BASE = env?.BASE_URL ?? '/';

/** Public file URL under the deployment base: "/" on Sites, a subpath on GitHub Pages. */
export function assetUrl(path: string) {
  return `${BASE}${path.replace(/^\//, '')}`;
}
