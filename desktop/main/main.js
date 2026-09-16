// desktop/main/main.js
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import { setupIpcHandlers } from './ipc.js';
import { startBackgroundSync } from './sync.js';
import { frontendUpdater } from './frontendUpdater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Initialize SQLite in userData path
  const userDataPath = app.getPath('userData');
  await initDatabase(userDataPath);

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

          // فحص فوري بمجرد عودة الاتصال بالإنترنت
          let lastOnlineState = false;
          setInterval(async () => {
            try {
              const res = await fetch('https://elfishawy-cafe-server.vercel.app/', {
                method: 'GET',
                signal: AbortSignal.timeout(3000),
              }).catch(() => null);
              const isNowOnline = Boolean(res && res.ok);
              if (isNowOnline && !lastOnlineState) {
                console.log('[Network] Internet returned! Triggering instant frontend update check...');
                runUpdateCheck();
              }
              lastOnlineState = isNowOnline;
            } catch {
              lastOnlineState = false;
            }
          }, 10 * 1000);
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
    mainWindow.loadFile(frontendIndexPath);
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

app.whenReady().then(createWindow);

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
