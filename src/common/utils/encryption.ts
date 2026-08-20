import crypto from 'crypto';
import { env } from '../../configs/env.config';

/**
 * Field-level encryption utilities for sensitive customer data.
 *
 * Design (blind-index pattern):
 * - `encrypt`/`decrypt`: AES-256-GCM with a random IV per call → used to store
 *   the real value securely. Never queried against directly (ciphertext
 *   differs every time, even for the same plaintext).
 * - `hmac`: deterministic HMAC-SHA256 (keyed, separate key from encryption)
 *   → used as an indexed "blind index" field for exact-match lookups and
 *   uniqueness constraints (e.g. phoneNumberHash).
 * - `generateTrigrams`/`hmacTrigrams`: splits normalized text into 3-char
 *   n-grams and HMACs each one → used as an indexed array field to support
 *   partial/substring search without exposing plaintext (e.g. fullNameIndex).
 *
 * Encryption key and HMAC key MUST be different secrets (key separation).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV length for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  // ENCRYPTION_KEY must be a 32-byte key, provided as a 64-char hex string.
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters)');
  }
  return key;
}

function getHmacKey(): Buffer {
  const key = Buffer.from(env.HMAC_KEY, 'hex');
  if (key.length < 32) {
    throw new Error('HMAC_KEY must decode to at least 32 bytes (64 hex characters)');
  }
  return key;
}

/**
 * Normalizes a value before hashing/encrypting so the same logical value
 * always produces the same hash (e.g. "  Ahmed  " and "ahmed" match).
 * Adjust per field type if needed (e.g. phone numbers vs names).
 */
export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Normalizes a phone number for hashing/encryption: strips all
 * non-digit characters except a leading "+".
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Encrypts plaintext with AES-256-GCM. Output format: iv:authTag:ciphertext (all hex),
 * so it can be stored as a single string field in MongoDB.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a string produced by `encrypt`.
 */
export function decrypt(payload: string): string {
  const [ivHex, authTagHex, encryptedHex] = payload.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted payload format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Deterministic keyed hash for exact-match blind indexes
 * (e.g. phoneNumberHash with a unique index).
 */
export function hmac(value: string): string {
  return crypto.createHmac('sha256', getHmacKey()).update(value).digest('hex');
}

/**
 * Splits normalized text into overlapping 3-character trigrams.
 * Short values (< 3 chars) are returned as a single trigram (padded-free),
 * so short names/words are still searchable.
 */
export function generateTrigrams(value: string): string[] {
  const normalized = normalize(value);
  if (normalized.length === 0) return [];
  if (normalized.length < 3) return [normalized];

  const trigrams = new Set<string>();
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.slice(i, i + 3));
  }
  return Array.from(trigrams);
}

/**
 * Generates the HMAC blind index array for a text field, used for
 * partial/substring search (e.g. fullNameIndex).
 */
export function hmacTrigrams(value: string): string[] {
  return generateTrigrams(value).map((trigram) => hmac(trigram));
}