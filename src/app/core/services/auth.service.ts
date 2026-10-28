import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable,  delay, finalize, map, of, tap, throwError } from 'rxjs';
import {
  AuthUser,

  ResetPasswordRequest
} from '../models/auth.model';
import { AppConfigService } from '../../shared/services/app-config.service';
import { SecureStorageService } from './secure-storage.service';
import {
  catchError,
  shareReplay,
} from 'rxjs';
const STORAGE_KEY = 'ebs_current_user';
const TOKEN_KEY = 'ebs_auth_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly appConfig = inject(AppConfigService);
  private readonly secureStorage = inject(SecureStorageService);


  private readonly ACCESS_TOKEN_KEY = 'accessToken';
private readonly REFRESH_TOKEN_KEY = 'refreshToken';

// private refreshRequest$: Observable<string> | null = null;

  // Demo accounts for instant one-click login and testing


  // Signal State
  readonly currentUser = signal<AuthUser | null>(null);
  readonly userRole = computed(() => this.currentUser()?.role || '');
  readonly userRoleKey = computed(() => this.currentUser()?.roleKey || 'it');
  private readonly _profile = signal<any | null>(null);
  readonly profileData = this._profile.asReadonly();
  readonly profileRole = computed(() => this._profile()?.roleName ?? '');

  private profileLoading = false;
  // Temporary storage for generated password reset tokens
  private activeResetTokens = new Map<string, { emailOrUsername: string; expiresAt: number }>();

  constructor() {

  }

profile():Observable<any>{

return this.http.get<any>(`${this.appConfig.baseURL}api/Account/profile`);
}
pingSession(): Observable<unknown> {
  return this.http.get(`${this.appConfig.baseURL}api/Account/profile`); // غيّر المسار لمسارك الفعلي
}

// getRefreshToken(): string | null {
//   return localStorage.getItem(this.REFRESH_TOKEN_KEY);
// }


// refreshAccessToken(): Observable<string> {
//   // لو فيه Refresh شغال بالفعل، استخدمي نفس الطلب
//   if (this.refreshRequest$) {
//     return this.refreshRequest$;
//   }

//   const refreshToken = this.getRefreshToken();

//   if (!refreshToken) {
//     return throwError(
//       () => new Error('Refresh token غير متوفر')
//     );
//   }

//   this.refreshRequest$ = this.http
//     .post<any>(
//       `${this.appConfig.baseURL}api/Account/refresh-token`,
//       { refreshToken }
//     )
//     .pipe(
//       map((response) => {
//         const data = response?.data ?? response;

//         if (!data?.accessToken) {
//           throw new Error(
//             'لم يرجع السيرفر Access Token جديد'
//           );
//         }

//         return data;
//       }),

//       tap((data) => {
//         localStorage.setItem(
//           this.ACCESS_TOKEN_KEY,
//           data.accessToken
//         );

//         // بعض الـ APIs بترجع Refresh Token جديد
//         if (data.refreshToken) {
//           localStorage.setItem(
//             this.REFRESH_TOKEN_KEY,
//             data.refreshToken
//           );
//         }
//       }),

//       map((data) => data.accessToken as string),

//       catchError((error) => {
//         this.clearSession();
//         return throwError(() => error);
//       }),

//       finalize(() => {
//         this.refreshRequest$ = null;
//       }),

//       shareReplay(1)
//     );

//   return this.refreshRequest$;
// }

 loadProfile(forceRefresh = false): void {
    if (this.profileLoading) return;
    if (this._profile() && !forceRefresh) return;

    this.profileLoading = true;

    this.http
      .get<any>(`${this.appConfig.baseURL}api/Account/profile`)
      .pipe(finalize(() => (this.profileLoading = false)))
      .subscribe({
        next: (res) => this._profile.set(res?.data ?? null),
        error: (err) => {
          console.error('Failed to load profile', err);
          this._profile.set(null);
        }
      });
  }

  clearProfile(): void {
    this._profile.set(null);
  }
clearSession(): void {
  this.secureStorage.removeItem(this.ACCESS_TOKEN_KEY);
  this.secureStorage.removeItem(this.REFRESH_TOKEN_KEY);
  this.secureStorage.removeItem('userName');
  this.secureStorage.removeItem('emailAddress');
  this.secureStorage.removeItem('isActive');
  this.secureStorage.removeItem('roleId');

  this.currentUser.set(null);
  this.clearProfile();
}
    login(event: { email: string; password: string }) {

    const headers = new HttpHeaders()
      .set('Content-Type', 'application/json');


    return this.http
      .post<any>(
        `${this.appConfig.baseURL}api/Account/login`,
        {
          email: event.email,
          password: event.password
        },
        {
          headers
        }
      )
      .pipe(

        tap((response: any) => {

          console.log(
            'Backend Login Response:',
            response
          );


          if (
            response?.success &&
            response?.data
          ) {

            const data = response.data;


if (data.accessToken) {
  this.secureStorage.setItem(
    this.ACCESS_TOKEN_KEY,
    String(data.accessToken)
  );
}

// Refresh-token storage is disabled together with automatic renewal.
// if (data.refreshToken) {
//   this.secureStorage.setItem(
//     this.REFRESH_TOKEN_KEY,
//     String(data.refreshToken)
//   );
// }

            // ==================================================
            // User information
            // ==================================================

            if (data.user) {
              try {
                this.secureStorage.setItem('userName',     String(data.user.fullName  ?? ''));
                this.secureStorage.setItem('isActive',     String(data.user.isActive  ?? ''));
                this.secureStorage.setItem('emailAddress', String(data.user.email     ?? ''));
                this.secureStorage.setItem('roleId',       String(data.user.roleId    ?? ''));
              } catch (storageErr) {
                console.warn('SecureStorage: failed to persist user info', storageErr);
              }
            }


          }
        })
      );
  }

ChangePassword(data:any):Observable<any>{

return this.http.post<any>(`${this.appConfig.baseURL}api/Account/change-password`, data);
}

getToken(): string | null {
  return this.secureStorage.getItem(this.ACCESS_TOKEN_KEY);
}
 isAuthenticated(): boolean {
    return !!this.getToken();
  }
  /**
   * Log out current user and redirect to login
   */
logout(): Observable<any> {
    return this.http
      .post<any>(`${this.appConfig.baseURL}api/Account/logout`, {})
      .pipe(
        finalize(() => {
          this.secureStorage.removeItem(this.ACCESS_TOKEN_KEY);
          this.secureStorage.removeItem('userName');
          this.secureStorage.removeItem('emailAddress');
          this.secureStorage.removeItem('isActive');
          this.secureStorage.removeItem('roleId');
          this.clearProfile(); // مهم عشان اليوزر الجديد ما يشوفش داتا القديم
        })
      );
  }

  /**
   * Request password reset link / verification token
   */
  requestPasswordReset(identifier: string): Observable<{ success: boolean; message: string; token: string }> {
    const trimmed = (identifier || '').trim();
    if (!trimmed) {
      return throwError(() => new Error('يرجى إدخال البريد الإلكتروني أو اسم المستخدم.'));
    }

    // Generate random 6-character token e.g. EBS-481920
    const token = `EBS-${Math.floor(100000 + Math.random() * 900000)}`;
    this.activeResetTokens.set(token, {
      emailOrUsername: trimmed,
      expiresAt: Date.now() + 1000 * 60 * 30 // 30 minutes
    });

    return of({
      success: true,
      message: `تم إرسال رابط وتعليمات إعادة التعيين بنجاح إلى البريد المسجل. رمز التحقق: ${token}`,
      token
    }).pipe(delay(800));
  }

  /**
   * Verify token validity
   */
  // verifyResetToken(token: string): Observable<boolean> {
  //   const trimmed = (token || '').trim();
  //   const entry = this.activeResetTokens.get(trimmed);
  //   if (!entry) {
  //     // Allow fallback if it matches general pattern
  //     if (trimmed.startsWith('EBS-') && trimmed.length === 10) {
  //       return of(true).pipe(delay(300));
  //     }
  //     return of(false).pipe(delay(300));
  //   }

  //   if (Date.now() > entry.expiresAt) {
  //     this.activeResetTokens.delete(trimmed);
  //     return of(false).pipe(delay(300));
  //   }

  //   return of(true).pipe(delay(300));
  // }

  /**
   * Complete password reset
   */
  resetPassword(request: ResetPasswordRequest): Observable<{ success: boolean; message: string }> {
    if (!request.token) {
      return throwError(() => new Error('رمز التحقق غير متوفر أو غير صالح.'));
    }
    if (!request.newPassword || request.newPassword.length < 8) {
      return throwError(() => new Error('يجب ألا تقل كلمة المرور عن 8 خانات وتحتوي على أرقام وحروف.'));
    }
    if (request.newPassword !== request.confirmPassword) {
      return throwError(() => new Error('كلمة المرور وتأكيدها غير متطابقين.'));
    }

    // Consume token
    this.activeResetTokens.delete(request.token);

    return of({
      success: true,
      message: 'تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
    }).pipe(delay(700));
  }


}
