import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

/** Shared secret — keep in sync with AppConfigService */
const STORAGE_SECRET = 'Bosaleh123456';

/**
 * Prefix added to every key stored by this service.
 * Allows instant O(1) key lookup and avoids touching
 * third-party / legacy plain-text localStorage entries.
 */
const KEY_PREFIX = 'ebs_';

/**
 * SecureStorageService
 *
 * Drop-in replacement for raw `localStorage` calls.
 *
 * - **Key**  → deterministic: `ebs_` + HMAC-SHA256(plainKey, secret)
 *             (always the same string → O(1) lookup, no scanning)
 * - **Value** → AES-encrypted ciphertext (random IV each write)
 *
 * Usage:
 *   secureStorage.setItem('accessToken', token);
 *   const token = secureStorage.getItem('accessToken');
 *   secureStorage.removeItem('accessToken');
 */
@Injectable({ providedIn: 'root' })
export class SecureStorageService {

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Converts a plain key to its deterministic hashed storage key.
   * Uses HMAC-SHA256 so the original key cannot be reverse-engineered
   * from the stored key alone.
   */
  private hashKey(plainKey: string): string {
    const hash = CryptoJS.HmacSHA256(plainKey, STORAGE_SECRET).toString(CryptoJS.enc.Base64);
    return KEY_PREFIX + hash;
  }

  private encryptValue(value: string): string {
    return CryptoJS.AES.encrypt(value, STORAGE_SECRET).toString();
  }

  private decryptValue(cipherText: string): string | null {
    try {
      const bytes = CryptoJS.AES.decrypt(cipherText, STORAGE_SECRET);
      const plain = bytes.toString(CryptoJS.enc.Utf8);
      return plain || null;
    } catch {
      return null;
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Encrypt the value and store it under the hashed key.
   */
  setItem(key: string, value: string): void {
    const storageKey = this.hashKey(key);
    const encValue   = this.encryptValue(value);
    localStorage.setItem(storageKey, encValue);
  }

  /**
   * Retrieve and decrypt the value for the given plain-text key.
   * Returns `null` when the key is not found.
   */
  getItem(key: string): string | null {
    const storageKey = this.hashKey(key);
    const encValue   = localStorage.getItem(storageKey);
    if (!encValue) return null;
    return this.decryptValue(encValue);
  }

  /**
   * Remove the entry for the given plain-text key.
   */
  removeItem(key: string): void {
    localStorage.removeItem(this.hashKey(key));
  }

  /**
   * Remove all entries written by this service (those with our prefix).
   */
  clear(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}

