// desktop/main/db.js
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { getOrCreateMasterKey, encryptBuffer, decryptBuffer } from './security.js';

let dbInstance = null;
let dbFilePath = null;
let masterKey = null;
let userDataDir = null;

export async function initDatabase(userDataPath) {
  if (dbInstance) return dbInstance;

  userDataDir = userDataPath;
  dbFilePath = path.join(userDataPath, 'elfishawy_offline.sqlite');
  masterKey = getOrCreateMasterKey(userDataPath);

  const SQL = await initSqlJs();
  let fileBuffer = null;

  if (fs.existsSync(dbFilePath)) {
    try {
      const rawDiskBuffer = fs.readFileSync(dbFilePath);

      // Check if file is legacy Plaintext SQLite (starts with "SQLite format 3")
      const isPlaintext = rawDiskBuffer.length >= 16 &&
        rawDiskBuffer.subarray(0, 16).toString('utf8').startsWith('SQLite format 3');

      if (isPlaintext) {
        console.log('[DB Security] Legacy plaintext SQLite detected. Creating migration backup...');
        const backupMigrationPath = path.join(userDataPath, `elfishawy_offline_migration_${Date.now()}.sqlite.bak`);
        try {
          fs.copyFileSync(dbFilePath, backupMigrationPath);
        } catch (bErr) {
          console.warn('[DB Security] Migration backup warning:', bErr.message);
        }
        fileBuffer = rawDiskBuffer;
      } else {
        // File is encrypted: decrypt with AES-256-GCM
        try {
          fileBuffer = decryptBuffer(rawDiskBuffer, masterKey);
          console.log('[DB Security] Encrypted SQLite decrypted successfully in RAM.');
        } catch (decErr) {
          console.error('[DB Security] Decryption failed! Attempting recovery from latest valid backup:', decErr.message);
          fileBuffer = attemptBackupRecovery(userDataPath, masterKey);
        }
      }
    } catch (e) {
      console.error('Failed to read existing SQLite file:', e);
    }
  }

  dbInstance = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  // Run schema migrations (includes sequence & hash chaining columns for sync_queue)
  runMigrations(dbInstance);

  // Immediately persist encrypted to disk
  saveDatabase();

  console.log('✅ SQLite initialized and encrypted securely at:', dbFilePath);
  return dbInstance;
}

/**
 * Persists in-memory SQLite database to disk with AES-256-GCM encryption & atomic write.
 */
export function saveDatabase() {
  if (!dbInstance || !dbFilePath || !masterKey) return;
  try {
    const rawData = dbInstance.export();
    const plainBuffer = Buffer.from(rawData);

    // Encrypt SQLite in-memory bytes with hardware-protected master key
    const encryptedBuffer = encryptBuffer(plainBuffer, masterKey);

    // Atomic write: write to temp file then rename
    const tmpFilePath = `${dbFilePath}.tmp`;
    fs.writeFileSync(tmpFilePath, encryptedBuffer);
    fs.renameSync(tmpFilePath, dbFilePath);

    // Maintain rolling encrypted backup
    createRollingBackup(encryptedBuffer);
  } catch (err) {
    console.error('[DB Security] Failed to persist encrypted SQLite database to disk:', err);
  }
}

function createRollingBackup(encryptedBuffer) {
  try {
    if (!userDataDir) return;
    const backupDir = path.join(userDataDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, 'elfishawy_offline.backup.enc');
    fs.writeFileSync(backupFile, encryptedBuffer);
  } catch (err) {
    // Non-blocking background backup
  }
}

function attemptBackupRecovery(userDataPath, key) {
  try {
    const backupFile = path.join(userDataPath, 'backups', 'elfishawy_offline.backup.enc');
    if (fs.existsSync(backupFile)) {
      const encBackup = fs.readFileSync(backupFile);
      const recoveredBuffer = decryptBuffer(encBackup, key);
      console.log('[DB Security] Recovered database successfully from encrypted backup.');
      return recoveredBuffer;
    }
  } catch (recErr) {
    console.error('[DB Security] Backup recovery failed:', recErr.message);
  }
  return null;
}

function runMigrations(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_op_id TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      sequence_id INTEGER,
      prev_hash TEXT,
      op_hash TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      _id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      _id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image_url TEXT,
      category_id TEXT,
      in_stock INTEGER DEFAULT 1,
      stock_quantity REAL DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS recipes (
      _id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      _id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      min_limit REAL DEFAULT 5,
      cost_price REAL DEFAULT 0,
      last_restock_total_cost REAL DEFAULT 0,
      last_restocked TEXT,
      last_restocked_by TEXT,
      sync_status TEXT DEFAULT 'SYNCED',
      client_inventory_id TEXT UNIQUE,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      _id TEXT PRIMARY KEY,
      order_number TEXT,
      provisional_number TEXT,
      day_key TEXT,
      items TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'completed',
      table_number INTEGER,
      cashier_id TEXT,
      notes TEXT,
      sync_status TEXT DEFAULT 'SYNCED',
      client_order_id TEXT UNIQUE,
      created_at TEXT,
      updated_at TEXT
    );

    -- عدادات محلية للتسلسل المؤقت (أوفلاين) — لكل يوم تجاري عدّاد مستقل يبدأ من 1.
    -- لا علاقة لهذه العدادات بأرقام الفواتير النهائية الصادرة من السيرفر.
    CREATE TABLE IF NOT EXISTS local_counters (
      _id TEXT PRIMARY KEY,
      seq INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      _id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      inventory_item_linked TEXT,
      inventory_quantity_added REAL,
      unit_cost REAL,
      date TEXT,
      added_by TEXT,
      sync_status TEXT DEFAULT 'SYNCED',
      client_expense_id TEXT UNIQUE,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS local_users (
      _id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role_type TEXT NOT NULL,
      password_hash TEXT,
      session_token TEXT,
      cached_at TEXT
    );
  `);

  // Safe ALTER TABLE migrations for existing databases
  try { db.run(`ALTER TABLE local_users ADD COLUMN session_token TEXT;`); } catch {}
  try { db.run(`ALTER TABLE inventory ADD COLUMN last_restock_total_cost REAL DEFAULT 0;`); } catch {}
  try { db.run(`ALTER TABLE inventory ADD COLUMN last_restocked TEXT;`); } catch {}
  try { db.run(`ALTER TABLE inventory ADD COLUMN last_restocked_by TEXT;`); } catch {}
  try { db.run(`ALTER TABLE sync_queue ADD COLUMN sequence_id INTEGER;`); } catch {}
  try { db.run(`ALTER TABLE sync_queue ADD COLUMN prev_hash TEXT;`); } catch {}
  try { db.run(`ALTER TABLE sync_queue ADD COLUMN op_hash TEXT;`); } catch {}
  // ترقيم الفواتير اليومي الموحّد: مفتاح اليوم التجاري بتوقيت القاهرة
  try { db.run(`ALTER TABLE orders ADD COLUMN day_key TEXT;`); } catch {}
  // تتبع مزامنة المخزون الأوفلاين: حالة المزامنة + معرّف العميل للأصناف الجديدة
  try { db.run(`ALTER TABLE inventory ADD COLUMN sync_status TEXT DEFAULT 'SYNCED';`); } catch {}
  try { db.run(`ALTER TABLE inventory ADD COLUMN client_inventory_id TEXT;`); } catch {}
  // الرقم المؤقت (أوفلاين) — منفصل تماماً عن الرقم النهائي القادم من السيرفر
  try { db.run(`ALTER TABLE orders ADD COLUMN provisional_number TEXT;`); } catch {}
  try { db.run(`CREATE TABLE IF NOT EXISTS local_counters (_id TEXT PRIMARY KEY, seq INTEGER DEFAULT 0);`); } catch {}

  // ترحيل بيانات الإصدارات الأقدم: الفواتير المعلقة (PENDING_SYNC) كان رقمها المخزَّن
  // في order_number رقم مؤقت محلي وليس رقماً نهائياً → ننقله لعمود provisional_number
  // ونُخلي order_number (الذي صار مخصصاً لأرقام السيرفر النهائية فقط).
  try {
    db.run(`UPDATE orders SET provisional_number = order_number
            WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'
              AND (provisional_number IS NULL OR provisional_number = '')
              AND order_number IS NOT NULL
              AND order_number GLOB '[0-9]*'
              AND order_number NOT GLOB '*[^0-9]*'`);
    db.run(`UPDATE orders SET order_number = NULL
            WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'`);
  } catch {}

  // تنظيف أي أرقام فواتير قديمة تالفة أو غير متوافقة (أطول من 5 أرقام أو تحتوي حروف من Mongo _id)
  // الرقم النهائي (order_number) أرقام فقط؛ الرقم المؤقت في عمود منفصل ولا يتأثر.
  try {
    db.run(`UPDATE orders SET order_number = NULL WHERE order_number GLOB '*[^0-9]*' OR LENGTH(order_number) > 6;`);
    db.run(`UPDATE orders SET provisional_number = NULL WHERE provisional_number GLOB '*[^0-9]*' OR LENGTH(provisional_number) > 6;`);
  } catch {}

  // إصلاح صفوف فواتير أوفلاين تالفة (INSERT قديم كان يضع PENDING_SYNC في عمود notes
  // ويضع clientOrderId في sync_status) — نستعيد الهوية الصحيحة clientOrderId = _id
  try {
    db.run(`
      UPDATE orders SET
        notes = CASE WHEN notes = 'PENDING_SYNC' THEN '' ELSE notes END,
        sync_status = 'PENDING_SYNC',
        client_order_id = _id,
        order_number = NULL
      WHERE _id GLOB 'off_*'
        AND IFNULL(sync_status, '') != 'SYNCED'
        AND (
          sync_status GLOB 'off_*'
          OR notes = 'PENDING_SYNC'
          OR IFNULL(sync_status, '') = ''
        )
    `);
    db.run(`
      UPDATE orders SET client_order_id = _id
      WHERE _id GLOB 'off_*'
        AND IFNULL(sync_status, '') = 'PENDING_SYNC'
        AND (client_order_id IS NULL OR client_order_id = '' OR client_order_id GLOB '20*')
    `);
  } catch {}

  // Seed default offline cashier if no local users exist
  try {
    const userCountRes = db.exec(`SELECT COUNT(*) FROM local_users`);
    const count = userCountRes.length && userCountRes[0].values.length ? Number(userCountRes[0].values[0][0]) || 0 : 0;
    if (count === 0) {
      // Password hash for 'CAShier@12345' via sha256 to match auth:verify-offline
      const seedHash = '1305333a361fbaa6eecf000cbe35b2fcaf7905a82056fe98c8ce638d31c56224'; // sha256('CAShier@12345')
      const offlineJwt = 'offline_default_cashier_token';
      const encToken = encryptSensitiveString(offlineJwt);
      db.run(`
        INSERT INTO local_users (_id, user_name, email, role_type, password_hash, session_token, cached_at)
        VALUES ('local_seed_cashier_01', 'كاشير الفيشاوي', 'cashier@elfishawy.com', 'cashier', ?, ?, ?)
      `, [seedHash, encToken, new Date().toISOString()]);
      console.log('✅ Seeded default offline cashier account (cashier@elfishawy.com)');
    }
  } catch (seedErr) {
    console.warn('Failed to seed default offline user:', seedErr.message);
  }
}

export function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return dbInstance;
}

export function getMasterKey() {
  return masterKey;
}
