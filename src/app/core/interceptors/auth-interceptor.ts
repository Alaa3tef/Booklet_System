
import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';

import { inject } from '@angular/core';

import {
  catchError,
  switchMap,
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

  const isRefreshRequest =
    /\/refresh-token(?:[/?]|$)/i.test(req.url);

  // لا نرسل Access Token قديمًا مع طلب تسجيل الدخول أو التجديد
  const token = authService.getToken();

  const authReq =
    !isLoginRequest && !isRefreshRequest && token
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

      // لو طلب Refresh نفسه فشل، ننهي الجلسة بدون تكرار
      if (isRefreshRequest) {
        authService.clearSession();

        if (!sessionExpired.visible()) {
          sessionExpired.show();
        }

        return throwError(() => error);
      }

      // لو مفيش Refresh Token، الجلسة لا يمكن تجديدها
      if (!authService.getRefreshToken()) {
        if (authService.getToken()) {
          authService.clearSession();

          if (!sessionExpired.visible()) {
            sessionExpired.show();
          }
        }

        return throwError(() => error);
      }

      // تجديد التوكن ثم إعادة الطلب الأصلي
      return authService.refreshAccessToken().pipe(
        switchMap((newAccessToken) => {
          const retryReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${newAccessToken}`,
            },
          });

          return next(retryReq);
        }),

        catchError((refreshError) => {
          authService.clearSession();

          if (!sessionExpired.visible()) {
            sessionExpired.show();
          }

          return throwError(() => refreshError);
        })
      );
    })
  );
};
