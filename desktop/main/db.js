// desktop/main/db.js
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

let dbInstance = null;
let dbFilePath = null;

export async function initDatabase(userDataPath) {
  if (dbInstance) return dbInstance;

  dbFilePath = path.join(userDataPath, 'elfishawy_offline.sqlite');
  const SQL = await initSqlJs();

  let fileBuffer = null;
  if (fs.existsSync(dbFilePath)) {
    try {
      fileBuffer = fs.readFileSync(dbFilePath);
    } catch (e) {
      console.error('Failed to read existing SQLite file:', e);
    }
  }

  dbInstance = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  // Run schema migrations
  runMigrations(dbInstance);
  saveDatabase();

  console.log('✅ SQLite initialized successfully at:', dbFilePath);
  return dbInstance;
}

export function saveDatabase() {
  if (!dbInstance || !dbFilePath) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    console.error('Failed to persist SQLite database to disk:', err);
  }
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
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      _id TEXT PRIMARY KEY,
      order_number TEXT,
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

  // Safe ALTER TABLE for existing databases
  try {
    db.run(`ALTER TABLE local_users ADD COLUMN session_token TEXT;`);
  } catch {}
  try {
    db.run(`ALTER TABLE inventory ADD COLUMN last_restock_total_cost REAL DEFAULT 0;`);
  } catch {}
  try {
    db.run(`ALTER TABLE inventory ADD COLUMN last_restocked TEXT;`);
  } catch {}
  try {
    db.run(`ALTER TABLE inventory ADD COLUMN last_restocked_by TEXT;`);
  } catch {}
}

export function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return dbInstance;
}
