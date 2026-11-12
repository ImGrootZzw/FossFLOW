#!/usr/bin/env node
/**
 * sync.mjs - commit and push every change in one step.
 *
 * Usage:
 *   node scripts/sync.mjs "feat: add something"
 *   npm run sync -- "feat: add something"
 *
 * Push token lookup order:
 *   1. GITHUB_TOKEN / GH_TOKEN environment variable
 *   2. .git/github-token  (local only, never committed)
 *
 * If the token is missing the script still commits locally and tells you
 * how to push manually.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOTE_URL = 'https://github.com/ImGrootZzw/FossFLOW.git';
const UPSTREAM_BRANCH = 'main';

const message =
  process.argv.slice(2).join(' ').trim() ||
  `chore: sync ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;

const git = (args, options = {}) => {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    ...options
  });
};

const tryGit = (args) => {
  try {
    return { ok: true, out: git(args) };
  } catch (e) {
    return {
      ok: false,
      out: `${e.stdout || ''}${e.stderr || ''}`.trim()
    };
  }
};

// On some cloud-synced folders git cannot delete its own lock files.
// Renaming keeps git happy and leaves the sync folder consistent.
const clearLocks = () => {
  const gitDir = path.join(ROOT, '.git');
  for (const name of ['index.lock', 'HEAD.lock']) {
    const lock = path.join(gitDir, name);
    if (fs.existsSync(lock)) {
      try {
        fs.renameSync(lock, `${lock}.stale.${Date.now()}`);
      } catch {
        /* ignore */
      }
    }
  }
};

const readToken = () => {
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) return { token: envToken.trim(), source: 'env' };

  const tokenFile = path.join(ROOT, '.git', 'github-token');
  if (fs.existsSync(tokenFile)) {
    return { token: fs.readFileSync(tokenFile, 'utf8').trim(), source: tokenFile };
  }
  return { token: null, source: null };
};

const run = () => {
  clearLocks();

  const status = tryGit(['status', '--porcelain']);
  if (!status.ok) {
    console.error('git status failed:\n' + status.out);
    process.exit(1);
  }

  const dirty = status.out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let committed = false;

  if (dirty.length > 0) {
    clearLocks();
    const add = tryGit(['add', '-A']);
    if (!add.ok) {
      console.error('git add failed:\n' + add.out);
      process.exit(1);
    }

    clearLocks();
    const commit = tryGit(['commit', '-m', message]);
    if (!commit.ok && !/nothing to commit/i.test(commit.out)) {
      console.error('git commit failed:\n' + commit.out);
      process.exit(1);
    }
    committed = !/nothing to commit/i.test(commit.out);
  }

  const branch = (tryGit(['rev-parse', '--abbrev-ref', 'HEAD']).out || 'master').trim();

  const { token, source } = readToken();
  if (!token) {
    console.log(
      committed
        ? `[sync] committed locally (${dirty.length} file(s)), but no push token found.`
        : '[sync] nothing to commit, and no push token found.'
    );
    console.log(
      '[sync] add GITHUB_TOKEN to the environment, or write the token to .git/github-token'
    );
    return;
  }

  clearLocks();
  const url = REMOTE_URL.replace('https://', `https://x-access-token:${token}@`);
  const push = tryGit(['push', url, `${branch}:${UPSTREAM_BRANCH}`]);
  const pushOut = push.out || '';

  if (!push.ok) {
    if (/Everything up-to-date|up to date/i.test(pushOut)) {
      console.log('[sync] already up to date.');
      return;
    }
    console.error('git push failed:\n' + pushOut);
    process.exit(1);
  }

  const summary = pushOut
    .split('\n')
    .filter((l) => l.includes('->') || l.includes('Everything up-to-date'))
    .join(' ')
    .trim();

  console.log(
    `[sync] ${committed ? `committed ${dirty.length} file(s)` : 'no new commit'} -> ${summary || 'pushed'} (token: ${source})`
  );
};

run();
