#!/usr/bin/env node
// UI check harness: screenshot a local dev page, or evaluate JS on it.
//
// Usage:
//   node scripts/ui-check/shot.mjs <path> <name> [--mobile] [--wait ms]
//   node scripts/ui-check/shot.mjs <path> <name> --eval "<js>" [--mobile] [--wait ms]
//
// See scripts/ui-check/README.md for details.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = 'http://localhost:3111';
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };
const DEFAULT_WAIT_MS = 2500;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');

function parseArgs(argv) {
  const positional = [];
  let mobile = false;
  let wait = DEFAULT_WAIT_MS;
  let evalJs = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--mobile') {
      mobile = true;
    } else if (arg === '--wait') {
      wait = Number(argv[++i]);
      if (!Number.isFinite(wait)) {
        throw new Error('--wait requires a numeric ms value');
      }
    } else if (arg === '--eval') {
      evalJs = argv[++i];
      if (evalJs === undefined) {
        throw new Error('--eval requires a JS expression string');
      }
    } else {
      positional.push(arg);
    }
  }

  const [urlPath, name] = positional;
  if (!urlPath) {
    throw new Error(
      'Usage: node scripts/ui-check/shot.mjs <path> <name> [--mobile] [--wait ms] [--eval "<js>"]'
    );
  }

  return { urlPath, name, mobile, wait, evalJs };
}

async function main() {
  const { urlPath, name, mobile, wait, evalJs } = parseArgs(process.argv.slice(2));

  const browser = await chromium.launch();
  try {
    const contextOptions = mobile
      ? { viewport: MOBILE_VIEWPORT, isMobile: true, hasTouch: true }
      : { viewport: DESKTOP_VIEWPORT };
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    await page.goto(`${BASE_URL}${urlPath}`);
    await page.waitForTimeout(wait);

    if (evalJs !== null) {
      const result = await page.evaluate(evalJs);
      process.stdout.write(JSON.stringify(result) + '\n');
      return;
    }

    if (!name) {
      throw new Error(
        'Usage: node scripts/ui-check/shot.mjs <path> <name> [--mobile] [--wait ms]'
      );
    }

    await mkdir(OUT_DIR, { recursive: true });
    const suffix = mobile ? 'mobile' : 'desktop';
    const outPath = path.join(OUT_DIR, `${name}-${suffix}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    process.stdout.write(outPath + '\n');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
