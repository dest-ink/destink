import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: <iv-hex>:<tag-hex>:<ciphertext-hex>
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts ciphertext produced by encrypt().
 * Returns null if the input is invalid or tampered.
 */
export function decrypt(ciphertext: string, keyHex: string): string | null {
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, encHex] = parts;
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  } catch {
    return null;
  }
}
