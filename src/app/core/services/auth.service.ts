import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, delay, of, throwError } from 'rxjs';
import {
  AuthUser,
  DemoAccount,
  LoginCredentials,
  ResetPasswordRequest
} from '../models/auth.model';

const STORAGE_KEY = 'ebs_current_user';
const TOKEN_KEY = 'ebs_auth_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly router = inject(Router);

  // Demo accounts for instant one-click login and testing
  readonly demoAccounts: DemoAccount[] = [
    {
      label: 'مدير المنظومة (IT)',
      role: 'مسؤول النظام IT',
      roleKey: 'it',
      username: 'ahmed.admin',
      email: 'admin@moe.gov.eg',
      fullName: 'أحمد محمد عبد الله',
      icon: 'pi pi-shield',
      color: '#1565c0'
    },
    {
      label: 'مشرف الإعداد والتخطيط',
      role: 'مسؤول الإعداد',
      roleKey: 'planning',
      username: 'khaled.plan',
      email: 'planning@moe.gov.eg',
      fullName: 'م. خالد إبراهيم سالم',
      icon: 'pi pi-sliders-h',
      color: '#0284c7'
    },
    {
      label: 'مشرف خط الطباعة',
      role: 'مشرف الطباعة',
      roleKey: 'printing',
      username: 'tarek.print',
      email: 'printing@moe.gov.eg',
      fullName: 'أ. طارق محمود السيد',
      icon: 'pi pi-print',
      color: '#d97706'
    },
    {
      label: 'مراقب الجودة والتسليم',
      role: 'مسؤول الجودة',
      roleKey: 'quality',
      username: 'sara.quality',
      email: 'quality@moe.gov.eg',
      fullName: 'د. سارة عبد الرحمن',
      icon: 'pi pi-verified',
      color: '#16a34a'
    }
  ];

  // Signal State
  readonly currentUser = signal<AuthUser | null>(this.getStoredUser());
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly userRole = computed(() => this.currentUser()?.role || '');
  readonly userRoleKey = computed(() => this.currentUser()?.roleKey || 'it');

  // Temporary storage for generated password reset tokens
  private activeResetTokens = new Map<string, { emailOrUsername: string; expiresAt: number }>();

  constructor() {
    // Default initial reset demo token
    this.activeResetTokens.set('EBS-984215', {
      emailOrUsername: 'admin@moe.gov.eg',
      expiresAt: Date.now() + 1000 * 60 * 60 // 1 hour
    });
  }

  /**
   * Log in user with credentials
   */
  login(credentials: LoginCredentials): Observable<AuthUser> {
    const rawId = (credentials.identifier || '').trim().toLowerCase();
    const rawPass = (credentials.password || '').trim();

    if (!rawId) {
      return throwError(() => new Error('يرجى إدخال اسم المستخدم أو البريد الإلكتروني.'));
    }
    if (!rawPass) {
      return throwError(() => new Error('يرجى إدخال كلمة المرور.'));
    }

    // Match against demo users or create a valid user session
    const matchedDemo = this.demoAccounts.find(
      (acc) =>
        acc.username.toLowerCase() === rawId ||
        acc.email.toLowerCase() === rawId
    );

    const authUser: AuthUser = matchedDemo
      ? {
          id: 101 + this.demoAccounts.indexOf(matchedDemo),
          username: matchedDemo.username,
          fullName: matchedDemo.fullName,
          email: matchedDemo.email,
          role: matchedDemo.role,
          roleKey: matchedDemo.roleKey,
          avatarInitials: this.extractInitials(matchedDemo.fullName),
          avatarTone: matchedDemo.color,
          token: 'mock-jwt-token-' + Date.now(),
          lastLogin: new Date().toISOString()
        }
      : {
          id: 999,
          username: rawId.split('@')[0],
          fullName: rawId.split('@')[0],
          email: rawId.includes('@') ? rawId : `${rawId}@moe.gov.eg`,
          role: 'مسؤول النظام IT',
          roleKey: 'it',
          avatarInitials: rawId.substring(0, 2).toUpperCase(),
          avatarTone: '#1565c0',
          token: 'mock-jwt-token-' + Date.now(),
          lastLogin: new Date().toISOString()
        };

    // Store user
    this.storeUser(authUser, credentials.rememberMe);
    this.currentUser.set(authUser);

    return of(authUser).pipe(delay(600));
  }

  /**
   * Direct login using one of the demo roles
   */
  loginAsDemo(demo: DemoAccount, rememberMe = true): Observable<AuthUser> {
    return this.login({
      identifier: demo.username,
      password: 'demoPassword123',
      rememberMe
    });
  }

  /**
   * Log out current user and redirect to login
   */
  logout(): void {
    this.currentUser.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.warn('Storage clear error', e);
    }
    this.router.navigate(['/login']);
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
  verifyResetToken(token: string): Observable<boolean> {
    const trimmed = (token || '').trim();
    const entry = this.activeResetTokens.get(trimmed);
    if (!entry) {
      // Allow fallback if it matches general pattern
      if (trimmed.startsWith('EBS-') && trimmed.length === 10) {
        return of(true).pipe(delay(300));
      }
      return of(false).pipe(delay(300));
    }

    if (Date.now() > entry.expiresAt) {
      this.activeResetTokens.delete(trimmed);
      return of(false).pipe(delay(300));
    }

    return of(true).pipe(delay(300));
  }

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
        sessionStorage.setItem(STORAGE_KEY, serialized);
        if (user.token) sessionStorage.setItem(TOKEN_KEY, user.token);
      }
    } catch (e) {
      console.warn('Storage set error', e);
    }
  }

  private getStoredUser(): AuthUser | null {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) return JSON.parse(local);
      const session = sessionStorage.getItem(STORAGE_KEY);
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
