#!/usr/bin/env node
/**
 * generate-icon-packs.mjs
 *
 * Scans <repo>/icon-packs/<pack-id>/ directories and generates a single JSON
 * file consumed by the app at runtime:
 *   packages/fossflow-app/public/icon-packs.generated.json
 *
 * Each pack directory contains:
 *   - image files (*.svg, *.png, *.webp, *.jpg, *.jpeg, *.gif)  -> icons
 *   - optional pack.json metadata:
 *       {
 *         "name": "Display Name",          // shown in Settings > Icon Packs
 *         "isIsometric": true,             // default pose for icons in this pack
 *         "scale": 1,                      // default scale (0.1 - 3)
 *         "icons": {                       // optional per-icon overrides, key = file stem
 *           "router-a": { "name": "Router A", "isIsometric": false, "scale": 1.5 }
 *         }
 *       }
 *
 * Icon ids are "<pack-id>-<file-stem>" (file stem sanitized). Renaming files
 * changes ids, which breaks old diagrams that reference them - avoid renames.
 *
 * Usage: node scripts/generate-icon-packs.mjs
 * (also wired into `npm run icons` and runs automatically before `npm run dev`)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'icon-packs');
const OUT_FILE = path.join(
  ROOT,
  'packages',
  'fossflow-app',
  'public',
  'icon-packs.generated.json'
);

const IMAGE_EXT = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif'
};

const sanitizeId = (s) => s.replace(/[^a-zA-Z0-9._-]+/g, '_');
const prettifyName = (s) => s.replace(/[-_]+/g, ' ').trim();

const clampScale = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const clamped = Math.min(3, Math.max(0.1, n));
  if (clamped !== n) {
    console.warn(`  [warn] scale ${n} out of range (0.1-3), clamped to ${clamped}`);
  }
  return clamped;
};

function readPackMeta(packDir) {
  const metaFile = path.join(packDir, 'pack.json');
  if (!fs.existsSync(metaFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  } catch (e) {
    console.warn(`  [warn] ${metaFile} is not valid JSON (${e.message}), using defaults`);
    return {};
  }
}

function generate() {
  const packs = [];

  if (!fs.existsSync(SRC_DIR)) {
    console.log('[icons] No icon-packs directory found - writing empty pack list.');
  } else {
    const packDirs = fs
      .readdirSync(SRC_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    for (const dirName of packDirs) {
      const packDir = path.join(SRC_DIR, dirName);
      const meta = readPackMeta(packDir);
      const packDefaultIso = meta.isIsometric === true;
      const packDefaultScale = clampScale(meta.scale);

      const entries = fs
        .readdirSync(packDir, { withFileTypes: true })
        .filter((d) => d.isFile() && IMAGE_EXT[path.extname(d.name).toLowerCase()])
        .map((d) => d.name)
        .sort();

      if (entries.length === 0) {
        console.warn(`[icons] Pack "${dirName}" has no image files, skipped.`);
        continue;
      }

      const perIconMeta = meta.icons && typeof meta.icons === 'object' ? meta.icons : {};
      const icons = [];

      for (const fileName of entries) {
        const ext = path.extname(fileName).toLowerCase();
        const stem = path.basename(fileName, ext);
        const override = perIconMeta[stem] || {};

        let data;
        try {
          data = fs.readFileSync(path.join(packDir, fileName));
        } catch (e) {
          console.error(`[icons] Cannot read ${fileName}: ${e.message}`);
          process.exit(1);
        }

        const rawName = override.name || prettifyName(stem);
        if (rawName.length > 100) {
          console.warn(`  [warn] icon name over 100 chars, truncated: ${dirName}/${fileName}`);
        }
        const name = String(rawName).slice(0, 100);

        const scaleOverride =
          override.scale !== undefined ? clampScale(override.scale) : undefined;

        icons.push({
          id: `${sanitizeId(dirName)}-${sanitizeId(stem)}`,
          name,
          url: `data:${IMAGE_EXT[ext]};base64,${data.toString('base64')}`,
          isIsometric: override.isIsometric !== undefined
            ? override.isIsometric === true
            : packDefaultIso,
          ...(scaleOverride !== undefined || packDefaultScale !== undefined
            ? { scale: scaleOverride ?? packDefaultScale }
            : {})
        });
      }

      packs.push({
        id: sanitizeId(dirName),
        name: String(meta.name || prettifyName(dirName)).slice(0, 100),
        isIsometric: packDefaultIso,
        icons
      });

      console.log(
        `[icons] Pack "${packs[packs.length - 1].name}" (${dirName}): ${icons.length} icons`
      );
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    packs
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const json = JSON.stringify(out);
  fs.writeFileSync(OUT_FILE, json, 'utf8');

  const sizeMB = Buffer.byteLength(json) / (1024 * 1024);
  if (sizeMB > 10) {
    console.warn(
      `[icons] WARNING: generated file is ${sizeMB.toFixed(1)} MB. ` +
        `Large icons slow down every page load - resize/compress them ` +
        `(e.g. max 512px PNG or SVG).`
    );
  }

  const totalIcons = packs.reduce((n, p) => n + p.icons.length, 0);
  console.log(
    `[icons] Done: ${packs.length} custom pack(s), ${totalIcons} icon(s) -> ${path.relative(ROOT, OUT_FILE)} (${sizeMB.toFixed(1)} MB)`
  );
}

generate();
