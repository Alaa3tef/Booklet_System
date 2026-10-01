import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SessionExpiredService {
   readonly visible = signal(false);
  show(): void { this.visible.set(true); }
  hide(): void { this.visible.set(false); }
}
