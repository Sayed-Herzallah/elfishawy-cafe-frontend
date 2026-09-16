// scripts/generate-frontend-manifest.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');
const pkgPath = path.join(rootDir, 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version || '1.0.0';

function getAllFiles(dir, baseDir = dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (relPath !== 'frontend-version.json') {
        files.push(relPath);
      }
    }
  }
  return files;
}

if (!fs.existsSync(distDir)) {
  console.log('dist directory not found. Please build first.');
  process.exit(0);
}

const fileList = getAllFiles(distDir);

const manifest = {
  version,
  buildDate: new Date().toISOString(),
  files: fileList,
};

// Write to public/ and dist/
fs.writeFileSync(path.join(publicDir, 'frontend-version.json'), JSON.stringify(manifest, null, 2), 'utf8');
fs.writeFileSync(path.join(distDir, 'frontend-version.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(`✅ Generated frontend-version.json (v${version}) with ${fileList.length} files.`);
