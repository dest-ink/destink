import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto';

const KEY = 'a'.repeat(64); // 32-byte hex for testing

describe('crypto', () => {
  it('encrypts and decrypts a string round-trip', () => {
    const plaintext = 'my-secret-oauth-token';
    const ciphertext = encrypt(plaintext, KEY);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext, KEY)).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const a = encrypt('hello', KEY);
    const b = encrypt('hello', KEY);
    expect(a).not.toBe(b);
  });

  it('returns null for tampered ciphertext', () => {
    const ct = encrypt('hello', KEY);
    const tampered = ct.slice(0, -4) + 'xxxx';
    expect(decrypt(tampered, KEY)).toBeNull();
  });

  it('returns null for completely invalid input', () => {
    expect(decrypt('not-valid', KEY)).toBeNull();
  });
});
