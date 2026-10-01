import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionExpiredService } from '../../services/session-expired-service';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge, fromEvent, filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-session-expired',
  imports: [DialogModule, ButtonModule],
  templateUrl: './session-expired.html',
  styleUrl: './session-expired.scss',
})
export class SessionExpired {
private readonly router = inject(Router);

private readonly authService = inject(AuthService);
 readonly sessionExpired = inject(SessionExpiredService);
private lastCheck = 0;

constructor() {
  merge(
    fromEvent(document, 'visibilitychange').pipe(
      filter(() => document.visibilityState === 'visible')
    ),
    fromEvent(window, 'focus')
  )
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.checkSession());
}

private checkSession(): void {
  // مفيش جلسة أصلًا، أو النافذة ظاهرة بالفعل
  if (!this.authService.getToken() || this.sessionExpired.visible()) return;

  // منع تكرار الفحص لو الحدثين اتنفذوا مع بعض
  const now = Date.now();
  if (now - this.lastCheck < 3000) return;
  this.lastCheck = now;

  // أي 401 "revoked" هيتعالج في الـ interceptor ويفتح النافذة
  this.authService.pingSession().subscribe({ error: () => {} });
}
goToLogin(): void {
  this.sessionExpired.hide();
  this.router.navigate(['/login']);
}
}
