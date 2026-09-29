import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(projectRoot, 'dist', 'assets');
const outputPath = path.join(projectRoot, 'desktop', 'electron-compat.css');
const cssFiles = fs.readdirSync(assetsDir)
  .filter((name) => name.endsWith('.css'))
  .map((name) => path.join(assetsDir, name));

if (cssFiles.length === 0) {
  throw new Error(`No CSS assets found in ${assetsDir}`);
}

// The Electron CSS transformer emits a legacy sRGB value first, followed by
// newer Lab/OKLCH values inside @supports. Keep the first compatible value
// for each Tailwind token so downloaded platform frontends get the same colors.
const colorTokens = new Map();
for (const cssPath of cssFiles) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const tokenPattern = /--(color-[\w-]+):\s*([^;}]+);/g;
  for (const match of css.matchAll(tokenPattern)) {
    const [, name, value] = match;
    if (!colorTokens.has(name) && (/^#[\da-f]{3,8}$/i.test(value.trim()) || /^rgba?\(/i.test(value.trim()))) {
      colorTokens.set(name, value.trim());
    }
  }
}

if (colorTokens.size === 0) {
  throw new Error('No compatible Tailwind color tokens found in the Electron CSS output.');
}

const variables = [...colorTokens]
  .map(([name, value]) => `  --${name}: ${value} !important;`)
  .join('\n');

const compatibilityCss = `/* Generated from the Electron CSS build for Chromium 108 compatibility. */
:root {\n${variables}\n}

/* Tailwind v4 gradients default to Oklab interpolation, unsupported by Chromium 108. */
.bg-gradient-to-t { --tw-gradient-position: to top !important; }
.bg-gradient-to-r { --tw-gradient-position: to right !important; }
.bg-gradient-to-l { --tw-gradient-position: to left !important; }
.bg-gradient-to-br { --tw-gradient-position: to bottom right !important; }
`;

fs.writeFileSync(outputPath, compatibilityCss, 'utf8');
console.log(`Generated Electron compatibility CSS with ${colorTokens.size} Tailwind color tokens.`);
