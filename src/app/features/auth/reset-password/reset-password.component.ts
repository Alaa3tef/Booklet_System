import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Form State
  token = signal('');
  newPassword = signal('');
  confirmPassword = signal('');

  // UI State
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');
  isSuccess = signal(false);

  // Password Strength Computations
  readonly hasMinLength = computed(() => this.newPassword().length >= 8);
  readonly hasNumber = computed(() => /\d/.test(this.newPassword()));
  readonly hasLetterOrSymbol = computed(() => /[a-zA-Z!@#$%^&*(),.?":{}|<>]/.test(this.newPassword()));
  readonly passwordsMatch = computed(() => {
    const p1 = this.newPassword();
    const p2 = this.confirmPassword();
    return p1.length > 0 && p2.length > 0 && p1 === p2;
  });

  readonly strengthScore = computed(() => {
    let score = 0;
    if (this.hasMinLength()) score++;
    if (this.hasNumber()) score++;
    if (this.hasLetterOrSymbol()) score++;
    if (this.newPassword().length >= 12) score++;
    return score;
  });

  readonly strengthLabel = computed(() => {
    const s = this.strengthScore();
    if (!this.newPassword()) return '';
    if (s <= 1) return 'ضعيفة';
    if (s === 2 || s === 3) return 'متوسطة';
    return 'قوية جداً';
  });

  readonly strengthClass = computed(() => {
    const s = this.strengthScore();
    if (!this.newPassword()) return '';
    if (s <= 1) return 'weak';
    if (s === 2 || s === 3) return 'medium';
    return 'strong';
  });

  ngOnInit(): void {
    // Check if token passed in URL params e.g. /reset-password?token=EBS-984215
    const urlToken = this.route.snapshot.queryParams['token'];
    if (urlToken) {
      this.token.set(urlToken);
    }
  }

  onSubmit(): void {
    this.errorMessage.set('');

    const tokenVal = this.token().trim();
    const newPass = this.newPassword().trim();
    const confirmPass = this.confirmPassword().trim();

    if (!tokenVal) {
      this.errorMessage.set('يرجى إدخال رمز التحقق المستلم.');
      return;
    }

    if (!this.hasMinLength()) {
      this.errorMessage.set('يجب ألا تقل كلمة المرور الجديدة عن 8 خانات.');
      return;
    }

    if (newPass !== confirmPass) {
      this.errorMessage.set('كلمة المرور وتأكيدها غير متطابقين.');
      return;
    }

    this.isLoading.set(true);

    this.authService
      .resetPassword({
        token: tokenVal,
        newPassword: newPass,
        confirmPassword: confirmPass
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.isSuccess.set(true);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.message || 'فشلت عملية إعادة التعيين. تأكد من صحة رمز التحقق.');
        }
      });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }
}
