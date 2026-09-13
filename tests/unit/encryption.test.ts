import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, hmac, normalizePhone, normalize } from '../../src/common/utils/encryption';

describe('encryption utilities', () => {
  it('should round-trip encrypt/decrypt text safely', () => {
    const plaintext = 'Ali Ahmed';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toEqual(plaintext);
    expect(decrypt(encrypted)).toEqual(plaintext);
  });

  it('should produce a stable HMAC for a normalized phone number input', () => {
    const value1 = hmac(normalizePhone('+966 512 345 678'));
    const value2 = hmac(normalizePhone('+966512345678'));
    expect(value1).toEqual(value2);
  });

  it('should normalize whitespace and casing before hashing', () => {
    const left = normalize('  Ali   Ahmed  ');
    const right = normalize('ali ahmed');
    expect(left).toEqual(right);
  });
});
