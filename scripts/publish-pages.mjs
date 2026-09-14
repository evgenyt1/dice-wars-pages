#!/usr/bin/env node
// Mirrors this repository's committed sources into a checkout of
// evgenyt1/dice-wars-pages and commits them. Pushing that checkout runs its
// workflow, which tests, runs `npm run build:pages` and deploys GitHub Pages.
//
//   node scripts/publish-pages.mjs [path-to-dice-wars-pages-checkout]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Files the Pages repository owns: its instructions, README and workflow. */
const PAGES_OWNED = /^(README\.md|AGENTS\.md|\.github\/)/;
/** Agent configuration specific to this repository's Sites workflow. */
const NOT_MIRRORED = /^(CLAUDE\.md|\.claude\/)/;

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const tracked = (cwd) => git(cwd, 'ls-files', '-z').split('\0').filter(Boolean);

const source = git(process.cwd(), 'rev-parse', '--show-toplevel');
const target = resolve(
  process.argv[2] ?? join(source, '../../dice-wars-pages'),
);
if (git(source, 'status', '--porcelain'))
  throw new Error('Commit or stash changes in this repository first.');
if (git(target, 'status', '--porcelain'))
  throw new Error(`${target} has uncommitted changes.`);

for (const file of tracked(target))
  if (!PAGES_OWNED.test(file)) rmSync(join(target, file), { force: true });
for (const file of tracked(source)) {
  if (PAGES_OWNED.test(file) || NOT_MIRRORED.test(file)) continue;
  mkdirSync(dirname(join(target, file)), { recursive: true });
  copyFileSync(join(source, file), join(target, file));
}

const revision = git(source, 'rev-parse', '--short', 'HEAD');
git(target, 'add', '-A');
if (!git(target, 'status', '--porcelain')) {
  console.log(`dice-wars-pages already matches dice@${revision}.`);
} else {
  git(
    target,
    'commit',
    '-m',
    `Publish Dicefront from evgenyt1/dice@${revision}`,
  );
  console.log(
    `Committed dice@${revision} in ${target}. Push it to deploy:\n  git -C ${target} push`,
  );
}
