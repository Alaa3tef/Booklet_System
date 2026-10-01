import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SessionExpiredService } from '../../shared/services/session-expired-service';

// Prevents showing the toast / redirecting many times
// when several requests fail with 401 at the same moment
let sessionExpiredHandled = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const authService = inject(AuthService);
  const sessionExpired = inject(SessionExpiredService);

  const token = authService.getToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {

      const message: string = error?.error?.message ?? '';
      const isRevoked = error.status === 401 && /revoked|invalidated/i.test(message);
      const isLoginRequest = /\/login/i.test(req.url);

      if (isRevoked && !isLoginRequest && !sessionExpired.visible()) {
        authService.clearSession();   // يمسح التوكن + clearProfile()
        sessionExpired.show();
      }

      return throwError(() => error);
    })
  );
};
