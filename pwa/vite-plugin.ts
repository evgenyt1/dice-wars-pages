import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Public files the game needs at runtime. Other same-origin GETs cache on first use. */
const PUBLIC_PRECACHE = [
  /^manifest\.webmanifest$/,
  /^favicon(-32\.png|\.svg)$/,
  /^apple-touch-icon\.png$/,
  /^icons\/icon-[\w-]+\.png$/,
  /^game-assets\/dicefront-duel\.svg$/,
  /^game-assets\/audio\/tactile\/[\w-]+\.wav$/,
  /^game-assets\/fonts\/[\w-]+\.ttf$/,
];
const BUNDLE_PRECACHE = /\.(js|css|woff2?)$/;
const TEMPLATE = new URL('./service-worker.js', import.meta.url);

function walk(directory: string, root = directory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path, root);
    return [relative(root, path).split(sep).join(posix.sep)];
  });
}

/**
 * Emits sw.js into the client build with every shell file (relative to the
 * deployment base) and a version derived from their contents, so each
 * deployment replaces the offline cache.
 */
export function offlineServiceWorker(): Plugin {
  let publicDir = '';
  return {
    name: 'dicefront-offline-service-worker',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_, bundle) {
      if (this.environment?.name !== 'client') return;
      const template = readFileSync(TEMPLATE, 'utf8');
      const hash = createHash('sha256').update(template);
      const paths = ['./'];
      const add = (file: string, content: string | Uint8Array) => {
        paths.push(file);
        hash.update(file).update(content);
      };
      for (const file of Object.keys(bundle).sort()) {
        const output = bundle[file];
        if (!BUNDLE_PRECACHE.test(file)) continue;
        add(file, output.type === 'chunk' ? output.code : output.source);
      }
      if (publicDir)
        for (const file of walk(publicDir).sort())
          if (PUBLIC_PRECACHE.some((pattern) => pattern.test(file)))
            add(file, readFileSync(join(publicDir, file)));
      const version = hash.digest('hex').slice(0, 16);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const VERSION = ${JSON.stringify(version)};\nconst PRECACHE = ${JSON.stringify(paths, null, 2)};\n${template}`,
      });
    },
  };
}
