import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Safely access safeStorage when running inside Electron Main Process
function getElectronSafeStorage() {
  try {
    const electron = globalThis?.process?.versions?.electron ? require('electron') : null;
    return electron?.safeStorage || null;
  } catch {
    return null;
  }
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
let cachedMasterKey = null;

/**
 * Gets or initializes a hardware/user-bound 256-bit encryption key using Windows DPAPI (Electron safeStorage).
 * No hardcoded keys exist in source code.
 */
export function getOrCreateMasterKey(userDataPath) {
  if (cachedMasterKey) return cachedMasterKey;

  const keyFilePath = path.join(userDataPath, '.sec_key');
  const safeStorage = getElectronSafeStorage();

  if (fs.existsSync(keyFilePath)) {
    try {
      const encryptedKey = fs.readFileSync(keyFilePath);
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const decryptedHex = safeStorage.decryptString(encryptedKey);
        cachedMasterKey = Buffer.from(decryptedHex, 'hex');
        return cachedMasterKey;
      } else {
        // Fallback when outside electron main process (e.g. test scripts)
        cachedMasterKey = encryptedKey.subarray(0, 32);
        return cachedMasterKey;
      }
    } catch (err) {
      console.warn('[Security] Failed to decrypt master key via DPAPI, regenerating key:', err.message);
    }
  }

  // Generate new 32-byte (256-bit) cryptographically strong random key
  cachedMasterKey = crypto.randomBytes(32);
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      const encryptedBuffer = safeStorage.encryptString(cachedMasterKey.toString('hex'));
      fs.writeFileSync(keyFilePath, encryptedBuffer);
    } catch (e) {
      console.error('[Security] Error saving encrypted master key:', e);
    }
  } else {
    // Save raw in test environment
    fs.writeFileSync(keyFilePath, cachedMasterKey);
  }

  return cachedMasterKey;
}

/**
 * Encrypts a raw Buffer using AES-256-GCM.
 * Layout: [12 bytes IV] + [16 bytes AuthTag] + [Ciphertext]
 */
export function encryptBuffer(plainBuffer, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypts an AES-256-GCM encrypted Buffer.
 */
export function decryptBuffer(encBuffer, key) {
  if (encBuffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted buffer is too short or corrupted');
  }

  const iv = encBuffer.subarray(0, IV_LENGTH);
  const tag = encBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypt sensitive strings like session JWT tokens via DPAPI
 */
export function encryptSensitiveString(str) {
  if (!str) return '';
  try {
    const safeStorage = getElectronSafeStorage();
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(str).toString('base64');
    }
  } catch (err) {
    console.error('[Security] safeStorage encrypt string failed:', err);
  }
  return str;
}

/**
 * Decrypt sensitive strings like session JWT tokens via DPAPI
 */
export function decryptSensitiveString(encStr) {
  if (!encStr) return '';
  try {
    const safeStorage = getElectronSafeStorage();
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encStr, 'base64');
      return safeStorage.decryptString(buffer);
    }
  } catch {
    // If not encrypted or already plaintext
    return encStr;
  }
  return encStr;
}

/**
 * Computes a cryptographic HMAC-SHA256 hash for an operation in the sync_queue
 * Chaining: HMAC(key, sequenceId + clientOpId + entityType + action + payload + prevHash)
 */
export function computeOpHash(key, { sequenceId, clientOpId, entityType, action, payload, prevHash }) {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(String(sequenceId || 0));
  hmac.update(String(clientOpId || ''));
  hmac.update(String(entityType || ''));
  hmac.update(String(action || ''));
  hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
  hmac.update(String(prevHash || 'ROOT_GENESIS'));
  return hmac.digest('hex');
}
