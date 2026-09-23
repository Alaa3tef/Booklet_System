import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Form State
  identifier = signal('');
  isLoading = signal(false);
  errorMessage = signal('');

  // Success State
  isSubmitted = signal(false);
  generatedToken = signal('');
  copiedToken = signal(false);

  // Resend Countdown
  countdownSeconds = signal(60);
  canResend = signal(false);
  private timerRef: any = null;

  onSubmit(): void {
    this.errorMessage.set('');
    const id = this.identifier().trim();

    if (!id) {
      this.errorMessage.set('يرجى إدخال البريد الإلكتروني أو اسم المستخدم المسجل.');
      return;
    }

    this.isLoading.set(true);

    this.authService.requestPasswordReset(id).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.generatedToken.set(res.token);
        this.isSubmitted.set(true);
        this.startCountdown();
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'تعذر إرسال طلب الاستعادة، يرجى المحاولة لاحقاً.');
      }
    });
  }

  onResend(): void {
    if (!this.canResend()) return;
    this.onSubmit();
  }

  onCopyToken(): void {
    if (!this.generatedToken()) return;
    navigator.clipboard.writeText(this.generatedToken()).then(() => {
      this.copiedToken.set(true);
      setTimeout(() => this.copiedToken.set(false), 2500);
    });
  }

  navigateToReset(): void {
    this.router.navigate(['/reset-password'], {
      queryParams: { token: this.generatedToken() }
    });
  }

  private startCountdown(): void {
    this.canResend.set(false);
    this.countdownSeconds.set(60);

    if (this.timerRef) {
      clearInterval(this.timerRef);
    }

    this.timerRef = setInterval(() => {
      const current = this.countdownSeconds();
      if (current <= 1) {
        clearInterval(this.timerRef);
        this.canResend.set(true);
        this.countdownSeconds.set(0);
      } else {
        this.countdownSeconds.set(current - 1);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerRef) {
      clearInterval(this.timerRef);
    }
  }
}
