// desktop/main/main.js
import { app, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import { setupIpcHandlers } from './ipc.js';
import { startBackgroundSync } from './sync.js';
import { frontendUpdater } from './frontendUpdater.js';

const __dirname = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar', 'desktop', 'main')
  : path.dirname(fileURLToPath(import.meta.url));

if (process.env.ELECTRON_TEST_MODE === 'true') {
  const testUserDataDir = process.env.ELECTRON_TEST_USER_DATA_DIR;
  if (!testUserDataDir) {
    throw new Error('Electron test mode requires ELECTRON_TEST_USER_DATA_DIR');
  }
  app.setPath('userData', path.resolve(testUserDataDir));
}

function logStartup(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  console.log(message);
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'), line, 'utf8');
  } catch (error) {
    console.error('[Desktop] Could not write startup log:', error);
  }
}

let mainWindow = null;
let splashWindow = null;

async function createWindow() {
  // ✅ isDev detection موثوق:
  // - ELECTRON_DEV=true يُمرَّر من script "desktop:dev" بشكل صريح
  // - أو إذا التطبيق غير مثبت (unpackaged) وليس في production mode
  const isDev = process.env.ELECTRON_DEV === 'true' ||
    (!app.isPackaged && process.env.NODE_ENV !== 'production');
  
  const DEV_URL = process.env.VITE_DEV_URL || 'http://localhost:3000';

  const iconPath = path.join(__dirname, '../icon.ico');

  // في dev mode: نتخطى Splash Screen ونفتح النافذة مباشرة
  if (!isDev) {
    splashWindow = new BrowserWindow({
      icon: iconPath,
      width: 480,
      height: 400,
      transparent: false,
      frame: false,
      alwaysOnTop: true,
      center: true,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    splashWindow.loadFile(path.join(__dirname, '../splash.html'));
  }

  // 2. Prepare Main Window (hidden initially)
  mainWindow = new BrowserWindow({
    icon: iconPath,
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'كافيه الفيشاوي - Elfishawy Cafe POS & Management',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: !isDev, // في dev: اظهر menu bar للـ DevTools shortcuts
  });

  // Surface failures in the packaged app instead of leaving the splash screen
  // showing "Ready" forever while the hidden window never becomes available.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
    logStartup(`Renderer failed to load (${errorCode}): ${errorDescription} — ${url}`);
  });
  mainWindow.webContents.on('did-finish-load', () => logStartup('Renderer finished loading.'));
  mainWindow.webContents.on('dom-ready', () => logStartup('Renderer DOM is ready.'));
  mainWindow.on('ready-to-show', () => logStartup('Main window is ready to show.'));
  const compatibilityCssPath = path.join(__dirname, '../electron-compat.css');
  if (app.isPackaged && fs.existsSync(compatibilityCssPath)) {
    const compatibilityCss = fs.readFileSync(compatibilityCssPath, 'utf8');
    mainWindow.webContents.on('dom-ready', () => {
      mainWindow.webContents.insertCSS(compatibilityCss).catch((error) => {
        logStartup(`Could not apply Chromium compatibility styles: ${error?.message || error}`);
      });
    });
  }
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logStartup(`Renderer process exited: ${JSON.stringify(details)}`);
  });

  // Initialize SQLite in userData path
  const userDataPath = app.getPath('userData');
  logStartup('Initializing local database…');
  await initDatabase(userDataPath);
  logStartup('Local database ready.');

  // Setup IPC & Sync
  setupIpcHandlers(mainWindow);
  startBackgroundSync(mainWindow);

  // When React finishes loading, close splash and show main window
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();

        // ✅ في dev mode: افتح DevTools تلقائياً لسهولة التطوير
        if (isDev) {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }

        // Background Check for newer frontend version (Initial + Periodic every 30s)
        if (!isDev) {
          const runUpdateCheck = () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              frontendUpdater.checkForUpdates(mainWindow).catch((err) => {
                console.log('[FrontendUpdater] Periodic check finished:', err?.message || err);
              });
            }
          };
          // Run initial check after 2 seconds
          setTimeout(runUpdateCheck, 2000);
          // Run continuous background checks every 30 seconds
          setInterval(runUpdateCheck, 30 * 1000);

        }
      }
    }, 700);
  });

  // ✅ Load app:
  // Dev mode   → Vite Dev Server (HMR مفعّل، أي تعديل في src/ يظهر فوراً)
  // Production → أحدث bundle محمّل من Vercel أو bundled في الـ EXE
  if (isDev) {
    console.log(`[Dev] Loading from Vite Dev Server: ${DEV_URL}`);
    mainWindow.loadURL(DEV_URL).catch((err) => {
      console.error(`[Dev] ❌ Failed to connect to Vite server at ${DEV_URL}`);
      console.error('[Dev] 💡 تأكد أن Vite Dev Server شغّال: npm run dev');
      console.error('[Dev] 💡 أو استخدم: npm run desktop:dev لتشغيل كليهما معاً');
      // في حال فشل الـ dev server، استخدم آخر bundle محلي كـ fallback
      const fallbackPath = frontendUpdater.getFrontendIndexPath();
      console.log(`[Dev] ⚠️ Falling back to local bundle: ${fallbackPath}`);
      mainWindow.loadFile(fallbackPath);
    });
  } else {
    const frontendIndexPath = frontendUpdater.getFrontendIndexPath();
    logStartup(`Loading frontend: ${frontendIndexPath}`);
    mainWindow.loadFile(frontendIndexPath).catch((error) => {
      logStartup(`Failed to load frontend: ${error?.stack || error}`);
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    });
  }

  // Setup Auto-Updater safely preserving userData SQLite
  if (!isDev) {
    import('electron-updater')
      .then(({ autoUpdater }) => {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        // Never touch or overwrite userData SQLite on update
        autoUpdater.checkForUpdatesAndNotify().catch(() => {});
      })
      .catch(() => {});
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow).catch((error) => {
  logStartup(`Startup failed: ${error?.stack || error}`);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  dialog.showErrorBox(
    'تعذر تشغيل كافيه الفيشاوي',
    `فشل تهيئة التطبيق. أعد المحاولة، وإذا استمرت المشكلة أرسل هذه الرسالة للدعم:\n\n${error?.stack || error}`,
  );
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
