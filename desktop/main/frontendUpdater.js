// desktop/main/frontendUpdater.js
import fs from 'fs';
import path from 'path';
import https from 'https';
import { app } from 'electron';

const TRUSTED_ORIGIN = 'https://fishawy.vercel.app';
const MANIFEST_URL = `${TRUSTED_ORIGIN}/frontend-version.json`;

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'ElFishawyDesktop' } }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

class FrontendUpdater {
  constructor() {
    this.userDataPath = app.getPath('userData');
    this.frontendBaseDir = path.join(this.userDataPath, 'app_frontend');
    this.currentLinkDir = path.join(this.frontendBaseDir, 'current');
    this.backupDir = path.join(this.frontendBaseDir, 'backup');
    this.stagingDir = path.join(this.frontendBaseDir, 'staging');
    this.versionsDir = path.join(this.frontendBaseDir, 'versions');
    this.metaFile = path.join(this.frontendBaseDir, 'meta.json');
    this.bundledFrontendDir = path.join(app.getAppPath(), 'dist');
    this.isUpdating = false;
    this.updateReady = false;
    this.newVersion = null;

    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.frontendBaseDir, this.stagingDir, this.versionsDir, this.backupDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  getLocalMeta() {
    try {
      if (fs.existsSync(this.metaFile)) {
        return JSON.parse(fs.readFileSync(this.metaFile, 'utf8'));
      }
    } catch (e) {
      console.error('[FrontendUpdater] Error reading local meta:', e);
    }
    return { version: '1.0.0', tag: 'frontend-v1.0.0', activatedAt: null };
  }

  saveLocalMeta(meta) {
    try {
      fs.writeFileSync(this.metaFile, JSON.stringify(meta, null, 2), 'utf8');
    } catch (e) {
      console.error('[FrontendUpdater] Error saving local meta:', e);
    }
  }

  /**
   * Returns the path to the valid index.html to be loaded by Electron.
   * Priority:
   * 1. Latest verified & activated downloaded frontend in userData/app_frontend/current/index.html
   * 2. Fallback to bundled frontend shipped inside EXE dist/index.html
   */
  getFrontendIndexPath() {
    // 1. أولوية 1: النسخة الحالية النشطة
    const customIndex = path.join(this.currentLinkDir, 'index.html');
    if (fs.existsSync(customIndex)) {
      try {
        const stats = fs.statSync(customIndex);
        if (stats.size > 200) {
          console.log('[FrontendUpdater] Using active downloaded frontend at:', customIndex);
          return customIndex;
        }
      } catch (err) {
        console.warn('[FrontendUpdater] Verified custom frontend corrupt, falling back:', err);
      }
    }

    // 2. أولوية 2: نسخة الـ backup السابقة في حال حدوث أي تلف
    const backupIndex = path.join(this.backupDir, 'index.html');
    if (fs.existsSync(backupIndex)) {
      try {
        const stats = fs.statSync(backupIndex);
        if (stats.size > 200) {
          console.log('[FrontendUpdater] Using safe backup frontend at:', backupIndex);
          return backupIndex;
        }
      } catch (err) {
        console.warn('[FrontendUpdater] Backup frontend check failed:', err);
      }
    }

    // 3. أولوية 3: النسخة المدمجة في الـ EXE كـ fallback نهائي
    const fallbackPath = path.join(this.bundledFrontendDir, 'index.html');
    console.log('[FrontendUpdater] Using bundled fallback frontend at:', fallbackPath);
    return fallbackPath;
  }

  compareVersions(v1, v2) {
    const p1 = (v1 || '1.0.0').split('.').map(Number);
    const p2 = (v2 || '1.0.0').split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num2 > num1) return 1;
      if (num2 < num1) return -1;
    }
    return 0;
  }

  /**
   * Checks for remote version manifest in background.
   */
  async checkForUpdates(mainWindow) {
    if (this.isUpdating) return { checking: false, message: 'Update already in progress' };

    try {
      console.log('[FrontendUpdater] Checking remote manifest at:', MANIFEST_URL);
      let remoteManifest = null;
      try {
        const manifestBuf = await fetchBuffer(MANIFEST_URL);
        remoteManifest = JSON.parse(manifestBuf.toString('utf8'));
      } catch (e) {
        console.log('[FrontendUpdater] Remote manifest fetch skipped/offline:', e.message);
        return { hasUpdate: false, reason: 'offline_or_not_found' };
      }

      if (!remoteManifest || !remoteManifest.version || !remoteManifest.files) {
        return { hasUpdate: false, reason: 'invalid_manifest' };
      }

      const currentMeta = this.getLocalMeta();
      const remoteTag = remoteManifest.tag || `frontend-v${remoteManifest.version}`;
      const localTag = currentMeta.tag || `frontend-v${currentMeta.version}`;
      console.log(`[FrontendUpdater] Local: ${currentMeta.version} (${currentMeta.buildDate || 'n/a'}) [${localTag}] | Remote: ${remoteManifest.version} (${remoteManifest.buildDate || 'n/a'}) [${remoteTag}]`);

      const versionDiff = this.compareVersions(currentMeta.version, remoteManifest.version);
      const isNewerBuild = remoteManifest.buildDate && currentMeta.buildDate && remoteManifest.buildDate > currentMeta.buildDate;
      const isDifferentBuild = remoteManifest.buildDate && currentMeta.buildDate && remoteManifest.buildDate !== currentMeta.buildDate;
      const tagChanged = remoteTag && localTag && remoteTag !== localTag;

      const hasNewUpdate = versionDiff > 0 || isNewerBuild || isDifferentBuild || tagChanged;

      if (!hasNewUpdate) {
        console.log('[FrontendUpdater] Local frontend is up to date.');
        return { hasUpdate: false, currentVersion: currentMeta.version };
      }

      console.log(`[FrontendUpdater] Newer frontend discovered: ${remoteManifest.version}. Starting atomic download...`);
      this.isUpdating = true;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('frontend:update-downloading', { version: remoteManifest.version });
      }

      const success = await this.downloadAndApplyUpdate(remoteManifest);
      this.isUpdating = false;

      if (success) {
        this.updateReady = true;
        this.newVersion = remoteManifest.version;
        console.log(`[FrontendUpdater] Frontend ${remoteManifest.version} safely downloaded and ready.`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('frontend:update-ready', {
            version: remoteManifest.version,
            message: 'تم تحميل أحدث نسخة من المنصة بنجاح، جاري تفعيلها فوراً...',
          });
          // Live Reload to immediately reflect the new frontend!
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              const newIndex = this.getFrontendIndexPath();
              console.log('[FrontendUpdater] Live-reloading main window with:', newIndex);
              mainWindow.loadFile(newIndex);
            }
          }, 1500);
        }
        return { hasUpdate: true, version: remoteManifest.version, ready: true };
      } else {
        return { hasUpdate: false, reason: 'download_validation_failed' };
      }
    } catch (err) {
      this.isUpdating = false;
      console.error('[FrontendUpdater] Check for updates error:', err);
      return { hasUpdate: false, error: err.message };
    }
  }

  async downloadAndApplyUpdate(manifest) {
    const versionDir = path.join(this.versionsDir, `v_${manifest.version}`);

    try {
      // 1. Clean staging directory
      if (fs.existsSync(this.stagingDir)) {
        fs.rmSync(this.stagingDir, { recursive: true, force: true });
      }
      fs.mkdirSync(this.stagingDir, { recursive: true });

      // 2. Download each asset securely with path-traversal protection
      for (const relativePath of manifest.files) {
        const normalized = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        if (normalized.startsWith('..')) {
          throw new Error(`Suspicious file path in manifest: ${relativePath}`);
        }

        const targetFilePath = path.join(this.stagingDir, normalized);
        const targetFileDir = path.dirname(targetFilePath);
        if (!fs.existsSync(targetFileDir)) {
          fs.mkdirSync(targetFileDir, { recursive: true });
        }

        const fileUrl = `${TRUSTED_ORIGIN}/${normalized.replace(/\\/g, '/')}`;
        const buffer = await fetchBuffer(fileUrl);
        fs.writeFileSync(targetFilePath, buffer);
      }

      // 3. Validate presence of essential index.html
      const stagedIndex = path.join(this.stagingDir, 'index.html');
      if (!fs.existsSync(stagedIndex) || fs.statSync(stagedIndex).size < 200) {
        throw new Error('Downloaded bundle is missing valid index.html');
      }

      // 3.1 Normalize absolute paths in index.html to relative paths so Electron file:// protocol can resolve them
      try {
        let indexContent = fs.readFileSync(stagedIndex, 'utf8');
        indexContent = indexContent
          .replace(/(src|href)=["']\/assets\//g, '$1="./assets/')
          .replace(/(src|href)=["']\/favicon\./g, '$1="./favicon.')
          .replace(/(src|href)=["']\/manifest\.json["']/g, '$1="./manifest.json"');
        fs.writeFileSync(stagedIndex, indexContent, 'utf8');
        console.log('[FrontendUpdater] Normalized index.html asset paths to relative paths.');
      } catch (err) {
        console.warn('[FrontendUpdater] Could not normalize index.html paths:', err);
      }

      // 4. Move staging to permanent version directory
      if (fs.existsSync(versionDir)) {
        fs.rmSync(versionDir, { recursive: true, force: true });
      }
      fs.renameSync(this.stagingDir, versionDir);

      // 5. Safe Atomic Swap with Backup & Rollback:
      // احفظ النسخة الحالية في backup أولاً قبل أي تعديل
      if (fs.existsSync(this.currentLinkDir)) {
        try {
          if (fs.existsSync(this.backupDir)) {
            fs.rmSync(this.backupDir, { recursive: true, force: true });
          }
          this.copyDirRecursive(this.currentLinkDir, this.backupDir);
        } catch (bkErr) {
          console.warn('[FrontendUpdater] Backup warning (non-fatal):', bkErr);
        }
      }

      // تجهيز مجلد مؤقت للتبديل السريع
      const tempActiveDir = path.join(this.frontendBaseDir, 'temp_current');
      if (fs.existsSync(tempActiveDir)) {
        fs.rmSync(tempActiveDir, { recursive: true, force: true });
      }
      this.copyDirRecursive(versionDir, tempActiveDir);

      // تبديل آمن: استبدال current بـ tempActive
      try {
        if (fs.existsSync(this.currentLinkDir)) {
          fs.rmSync(this.currentLinkDir, { recursive: true, force: true });
        }
        fs.renameSync(tempActiveDir, this.currentLinkDir);
      } catch (swapErr) {
        console.error('[FrontendUpdater] Swap failed, rolling back to backup:', swapErr);
        if (fs.existsSync(this.backupDir)) {
          this.copyDirRecursive(this.backupDir, this.currentLinkDir);
        }
        throw swapErr;
      }

      // 6. Record metadata
      this.saveLocalMeta({
        version: manifest.version,
        tag: manifest.tag || `frontend-v${manifest.version}`,
        buildDate: manifest.buildDate || new Date().toISOString(),
        activatedAt: new Date().toISOString(),
      });

      return true;
    } catch (err) {
      console.error('[FrontendUpdater] Atomic update failed, keeping current frontend intact:', err);
      if (fs.existsSync(this.stagingDir)) {
        try { fs.rmSync(this.stagingDir, { recursive: true, force: true }); } catch { }
      }
      return false;
    }
  }

  copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  applyUpdateNow(mainWindow) {
    if (!this.updateReady) return false;
    const newIndexPath = this.getFrontendIndexPath();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(newIndexPath);
      return true;
    }
    return false;
  }
}

export const frontendUpdater = new FrontendUpdater();
