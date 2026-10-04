import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SessionExpiredService } from '../../shared/services/session-expired-service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const authService = inject(AuthService);
  const sessionExpired = inject(SessionExpiredService);

  const token = authService.getToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {

      const isUnauthorized = error.status === 401;
      const isLoginRequest = /\/login(?:[/?]|$)/i.test(req.url);

      if (isUnauthorized && token && !isLoginRequest && !sessionExpired.visible()) {
        authService.clearSession();
        sessionExpired.show();
      }

      return throwError(() => error);
    })
  );
};
