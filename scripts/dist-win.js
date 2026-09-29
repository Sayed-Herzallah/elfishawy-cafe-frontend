import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronBuilderCli = path.join(
  projectRoot,
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js',
);
const localElectronRuntime = path.join(projectRoot, 'tmp', 'electron22-ia32', 'runtime');

const args = [
  electronBuilderCli,
  '--win',
  'nsis',
  '--ia32',
  '--config.electronVersion=22.3.27',
  '--config.win.artifactName=ElFishawy-Cafe-Setup.exe',
];

if (existsSync(path.join(localElectronRuntime, 'electron.exe'))) {
  args.push(`--config.electronDist=${localElectronRuntime}`);
  console.log('Using the local Electron 22 x86 runtime.');
}

const result = spawnSync(process.execPath, args, {
  cwd: projectRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error('Failed to start electron-builder:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
