
import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';

import { inject } from '@angular/core';

import {
  catchError,
  throwError,
} from 'rxjs';

import { AuthService } from '../services/auth.service';

import {
  SessionExpiredService,
} from '../../shared/services/session-expired-service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const sessionExpired = inject(SessionExpiredService);

  const isLoginRequest =
    /\/login(?:[/?]|$)/i.test(req.url);

  // Refresh-token renewal is temporarily disabled.
  // لا نرسل Access Token قديمًا مع طلب تسجيل الدخول
  const token = authService.getToken();

  const authReq =
    !isLoginRequest && token
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      // لا نحاول تجديد التوكن بسبب خطأ في Login
      if (isLoginRequest) {
        return throwError(() => error);
      }

      // Refresh-token renewal is disabled, so a non-login 401 ends the session.
      authService.clearSession();

      if (!sessionExpired.visible()) {
        sessionExpired.show();
      }

      return throwError(() => error);
    })
  );
};
