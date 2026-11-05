import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as CryptoJS from 'crypto-js';

const CONFIG_SECRET = 'Bosaleh123456';

@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
  private config: any;

  constructor(private http: HttpClient) { }

  loadConfig() {
    return firstValueFrom(this.http.get('/assets/config.json'))
      .then(config => {
        this.config = config;
      });
  }

  /**
   * Decrypts a CryptoJS AES-encrypted string using the shared config secret.
   * If the value is not encrypted (plain text), it is returned as-is.
   */
  private decrypt(value: string): string {
    if (!value) return '';
    try {
      const bytes = CryptoJS.AES.decrypt(value, CONFIG_SECRET);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || value; // fallback to raw value if decryption yields nothing
    } catch {
      return value; // not encrypted — return as-is
    }
  }

  get baseURL(): string {
    //return this.decrypt(this.config?.baseURL ?? '');
    return this.config?.baseURL;
  }

  get apiBase(): string {
    return this.decrypt(this.config?.apiBase ?? '');
  }
}
