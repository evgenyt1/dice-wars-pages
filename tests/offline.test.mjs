import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { offlineServiceWorker } from '../pwa/vite-plugin.ts';
import { assetUrl } from '../app/asset-url.ts';

const ORIGIN = 'https://dicefront.test';
const PUBLIC_FILES = {
  'manifest.webmanifest': '{}',
  'game-assets/audio/tactile/dice.wav': 'wav',
  'game-assets/fonts/manrope-400.ttf': 'ttf',
  'game-assets/vector/symbols.svg': 'unused sprite',
};

function buildWorker({ publicFiles = PUBLIC_FILES, chunk = 'a' } = {}) {
  const publicDir = mkdtempSync(join(tmpdir(), 'dicefront-public-'));
  for (const [file, content] of Object.entries(publicFiles)) {
    mkdirSync(join(publicDir, file, '..'), { recursive: true });
    writeFileSync(join(publicDir, file), content);
  }
  const plugin = offlineServiceWorker();
  plugin.configResolved({ publicDir });
  const emitted = [];
  const bundle = {
    'assets/game-client-x.js': { type: 'chunk', code: chunk },
    'assets/index-y.css': { type: 'asset', source: 'body{}' },
    'index.html': { type: 'asset', source: '<html>' },
    '.vite/manifest.json': { type: 'asset', source: '{}' },
  };
  const emit = (name) => ({
    environment: { name },
    emitFile: (file) => emitted.push(file),
  });
  plugin.generateBundle.call(emit('ssr'), {}, bundle);
  assert.equal(emitted.length, 0, 'only the client build emits a worker');
  plugin.generateBundle.call(emit('client'), {}, bundle);
  assert.equal(emitted[0].fileName, 'sw.js');
  return emitted[0].source;
}

class FakeCache {
  entries = new Map();
  key(request, ignoreSearch) {
    const url = new URL(typeof request === 'string' ? request : request.url);
    return ignoreSearch ? url.origin + url.pathname : url.href;
  }
  async match(request, options = {}) {
    const key = this.key(request, options.ignoreSearch);
    for (const [stored, response] of this.entries)
      if ((options.ignoreSearch ? this.key(stored, true) : stored) === key)
        return response.clone();
    return undefined;
  }
  async put(request, response) {
    this.entries.set(this.key(request, false), response);
  }
}

/** Runs the generated worker in a sandbox with fake caches and a switchable network. */
function runWorker(source, scope, files) {
  const stores = new Map();
  const listeners = {};
  let online = true;
  const fetch = async (request) => {
    if (!online) throw new TypeError('Failed to fetch');
    const url = new URL(typeof request === 'string' ? request : request.url);
    const body = files[url.pathname];
    const response = new Response(body ?? 'missing', {
      status: body === undefined ? 404 : 200,
    });
    // Same-origin browser responses are "basic"; Node constructs "default".
    return Object.defineProperty(response, 'type', { value: 'basic' });
  };
  class Cache extends FakeCache {
    async addAll(requests) {
      for (const request of requests) {
        const response = await fetch(request);
        if (!response.ok) throw new Error(`precache failed: ${request.url}`);
        await this.put(request, response);
      }
    }
  }
  vm.runInNewContext(source, {
    self: {
      location: new URL(ORIGIN),
      registration: { scope },
      addEventListener: (type, fn) => (listeners[type] = fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async (name) => {
        if (!stores.has(name)) stores.set(name, new Cache());
        return stores.get(name);
      },
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
    },
    fetch,
    Request: class {
      constructor(url) {
        this.url = new URL(url).href;
      }
    },
    Response,
    URL,
    setTimeout,
    clearTimeout,
    Promise,
  });
  const lifecycle = async (type) => {
    let done;
    listeners[type]({ waitUntil: (p) => (done = p) });
    await done;
  };
  const request = async (path, { navigate = false, headers = {} } = {}) => {
    let response;
    const pending = [];
    listeners.fetch({
      request: {
        url: new URL(path, scope).href,
        method: 'GET',
        mode: navigate ? 'navigate' : 'cors',
        headers: new Headers(headers),
      },
      respondWith: (p) => (response = p),
      waitUntil: (p) => pending.push(p),
    });
    if (!response) return null; // Not handled: the browser fetches normally.
    const result = await response;
    await Promise.all(pending);
    return result;
  };
  return { stores, lifecycle, request, setOnline: (value) => (online = value) };
}

test('public asset URLs follow the deployment base', () => {
  assert.equal(
    assetUrl('game-assets/dicefront-duel.svg'),
    '/game-assets/dicefront-duel.svg',
  );
  assert.equal(assetUrl('/sw.js'), '/sw.js');
});

test('build worker precaches the shell, bundle and runtime public assets with a content version', () => {
  const source = buildWorker();
  const precache = JSON.parse(
    source.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1],
  );
  assert.deepEqual(precache, [
    './',
    'assets/game-client-x.js',
    'assets/index-y.css',
    'game-assets/audio/tactile/dice.wav',
    'game-assets/fonts/manrope-400.ttf',
    'manifest.webmanifest',
  ]);
  const version = (s) => s.match(/const VERSION = "(\w+)"/)[1];
  assert.equal(version(buildWorker()), version(source));
  assert.notEqual(version(buildWorker({ chunk: 'b' })), version(source));
  assert.notEqual(
    version(
      buildWorker({
        publicFiles: {
          ...PUBLIC_FILES,
          'game-assets/audio/tactile/dice.wav': 'new',
        },
      }),
    ),
    version(source),
  );
});

for (const base of ['/', '/dice-wars-pages/'])
  test(`installed worker at ${base} launches and plays offline; online launches refresh the shell`, async () => {
    const files = Object.fromEntries(
      Object.entries({
        '': '<html>v1</html>',
        'assets/game-client-x.js': 'js',
        'assets/index-y.css': 'css',
        'manifest.webmanifest': '{}',
        'game-assets/audio/tactile/dice.wav': 'wav',
        'game-assets/fonts/manrope-400.ttf': 'ttf',
        'game-assets/vector/b16-4_hittest.svg': '<svg/>',
      }).map(([path, body]) => [base + path, body]),
    );
    const worker = runWorker(buildWorker(), ORIGIN + base, files);
    worker.stores.set('dicefront-old', new FakeCache());
    await worker.lifecycle('install');
    await worker.lifecycle('activate');
    const keys = [...worker.stores.keys()];
    assert.equal(keys.length, 1, 'previous deployment caches are removed');
    assert.notEqual(keys[0], 'dicefront-old');

    // Runtime assets outside the precache list are kept after first use.
    await worker.request('game-assets/vector/b16-4_hittest.svg');
    files[base] = '<html>v2</html>';
    const online = await worker.request('./', { navigate: true });
    assert.equal(await online.text(), '<html>v2</html>');
    assert.equal(
      await worker.request('./?x=1', { headers: { RSC: '1' } }),
      null,
    );

    worker.setOnline(false);
    const launch = await worker.request('./?source=homescreen', {
      navigate: true,
    });
    assert.equal(
      await launch.text(),
      '<html>v2</html>',
      'offline launch uses the newest shell',
    );
    for (const path of [
      'assets/game-client-x.js',
      'manifest.webmanifest?v=duel-1',
      'game-assets/audio/tactile/dice.wav',
      'game-assets/vector/b16-4_hittest.svg',
    ])
      assert.equal((await worker.request(path)).status, 200, path);
    await assert.rejects(worker.request('game-assets/never-loaded.png'));
  });
