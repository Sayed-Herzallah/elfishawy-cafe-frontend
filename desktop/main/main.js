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
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  // 1. Create and show Splash Window first
  const iconPath = path.join(__dirname, '../icon.ico');
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
    autoHideMenuBar: true,
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

        // Background Check for newer frontend version (Non-blocking)
        if (!isDev) {
          setTimeout(() => {
            frontendUpdater.checkForUpdates(mainWindow).catch((err) => {
              console.log('[FrontendUpdater] Background check finished:', err?.message || err);
            });
          }, 3000);
        }
      }
    }, 700);
  });

  // Load app: use latest verified local frontend or fallback to bundled in EXE
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
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
