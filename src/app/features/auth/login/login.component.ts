import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';
import { DemoAccount } from '../../../core/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Form Model
  identifier = signal('');
  password = signal('');
  rememberMe = signal(true);

  // UI State
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');

  // Demo accounts
  readonly demoAccounts = this.authService.demoAccounts;

  /**
   * Handle Login Form Submission
   */
  onSubmit(): void {
    this.errorMessage.set('');

    const id = this.identifier().trim();
    const pass = this.password().trim();

    if (!id) {
      this.errorMessage.set('يرجى إدخال اسم المستخدم أو البريد الإلكتروني.');
      return;
    }

    if (!pass) {
      this.errorMessage.set('يرجى إدخال كلمة المرور.');
      return;
    }

    this.isLoading.set(true);

    this.authService
      .login({
        identifier: id,
        password: pass,
        rememberMe: this.rememberMe()
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.message || 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة لاحقاً.');
        }
      });
  }

  /**
   * One-click demo login for fast testing
   */
  onQuickLogin(account: DemoAccount): void {
    this.errorMessage.set('');
    this.identifier.set(account.username);
    this.password.set('demo123456');
    this.isLoading.set(true);

    this.authService.loginAsDemo(account, this.rememberMe()).subscribe({
      next: () => {
        this.isLoading.set(false);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'فشل تسجيل الدخول بالحساب التجريبي.');
      }
    });
  }

  toggleShowPassword(): void {
    this.showPassword.update((val) => !val);
  }
}
