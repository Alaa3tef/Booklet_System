import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable,  delay, finalize, map, of, tap, throwError } from 'rxjs';
import {
  AuthUser,

  ResetPasswordRequest
} from '../models/auth.model';
import { AppConfigService } from '../../shared/services/app-config.service';

const STORAGE_KEY = 'ebs_current_user';
const TOKEN_KEY = 'ebs_auth_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly appConfig = inject(AppConfigService);


  // Demo accounts for instant one-click login and testing


  // Signal State
  readonly currentUser = signal<AuthUser | null>(this.getStoredUser());
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

  /**
   * Log in user by calling the real backend API.
   * Payload: { email, password } → POST /api/Account/login
   */
  // login(credentials: LoginCredentials): Observable<AuthUser> {
  //   const email = (credentials.identifier || '').trim();
  //   const password = (credentials.password || '').trim();

  //   if (!email) {
  //     return throwError(() => new Error('يرجى إدخال البريد الإلكتروني.'));
  //   }
  //   if (!password) {
  //     return throwError(() => new Error('يرجى إدخال كلمة المرور.'));
  //   }

  //   const body: LoginRequest = { email, password };

  //   return this.http.post<LoginApiResponse>(`${this.apiBase}/Account/login`, body).pipe(
  //     map((res) => {
  //       // Guard: API returned a failure response
  //       if (!res.success) {
  //         throw new Error(res.message || 'فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.');
  //       }

  //       const { accessToken, user } = res.data;

  //       const authUser: AuthUser = {
  //         id: user.id,
  //         fullName: user.fullName,
  //         email: user.email,
  //         role: 'مستخدم',       // extend once the API returns a role field
  //         roleKey: 'it',        // extend once the API returns a roleKey field
  //         avatarInitials: this.extractInitials(user.fullName),
  //         avatarTone: '#1565c0',
  //         token: accessToken,
  //         lastLogin: new Date().toISOString()
  //       };

  //       this.storeUser(authUser, credentials.rememberMe);
  //       this.currentUser.set(authUser);
  //       return authUser;
  //     }),
  //     catchError((err: HttpErrorResponse | Error) => {
  //       // Status 0 = browser blocked the request (self-signed cert / CORS / network)
  //       if (err instanceof HttpErrorResponse) {
  //         if (err.status === 0) {
  //           return throwError(() => new Error(
  //             'تعذّر الاتصال بالخادم. إذا كان الخادم يستخدم شهادة SSL خاصة، ' +
  //             'يرجى فتح هذا الرابط في المتصفح وقبول الشهادة أولاً:\n' +
  //             `${this.apiBase.replace('/api', '')}`
  //           ));
  //         }
  //         if (err.status === 401 || err.status === 403) {
  //           return throwError(() => new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.'));
  //         }
  //         if (err.status >= 500) {
  //           return throwError(() => new Error('حدث خطأ في الخادم. يرجى المحاولة لاحقاً.'));
  //         }
  //         // API returned an error body with a message
  //         const apiMsg = (err.error as any)?.message;
  //         return throwError(() => new Error(apiMsg || `خطأ (${err.status}): ${err.statusText}`));
  //       }
  //       // Re-throw errors thrown from map() (e.g. success: false)
  //       return throwError(() => err);
  //     })
  //   );
  // }
profile():Observable<any>{

return this.http.get<any>(`${this.appConfig.baseURL}api/Account/profile`);
}

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

              localStorage.setItem(
                'accessToken',
                data.accessToken
              );
            }

            // ==================================================
            // User information
            // ==================================================

            if (data.user) {

              localStorage.setItem(
                'userName',
                `${data.user.fullName }`
              );

 localStorage.setItem(
                'isActive',
                `${data.user.isActive }`
              );
              localStorage.setItem(
                'emailAddress',
                data.user.email ?? ''
              );
 localStorage.setItem(
                'emailAddress',
                data.user.roleId ?? ''
              );
            }


          }
        })
      );
  }

ChangePassword(data:any):Observable<any>{

return this.http.post<any>(`${this.appConfig.baseURL}api/Account/change-password`, data);
}

 getToken(): string | null {
    return localStorage.getItem('accessToken');
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
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userName');
          localStorage.removeItem('emailAddress');
          localStorage.removeItem('isActive');
          localStorage.removeItem('roleId');
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

  // --- Helpers ---

  private storeUser(user: AuthUser, rememberMe: boolean): void {
    try {
      const serialized = JSON.stringify(user);
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, serialized);
        if (user.token) localStorage.setItem(TOKEN_KEY, user.token);
      } else {
        localStorage.setItem(STORAGE_KEY, serialized);
        if (user.token) localStorage.setItem(TOKEN_KEY, user.token);
      }
    } catch (e) {
      console.warn('Storage set error', e);
    }
  }

  private getStoredUser(): AuthUser | null {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) return JSON.parse(local);
      const session = localStorage.getItem(STORAGE_KEY);
      if (session) return JSON.parse(session);
    } catch {
      // Storage unavailable or JSON invalid
    }
    return null;
  }

  private extractInitials(fullName: string): string {
    const parts = (fullName || '').trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]} ${parts[1][0]}`;
    }
    return fullName.substring(0, 2);
  }
}
