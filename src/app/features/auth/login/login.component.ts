import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";

import { AuthService } from "../../../core/services/auth.service";
import { DemoAccount } from "../../../core/models/auth.model";
import { ToastComponent } from "../../../shared/components/toaster/toaster.component";
import { ToastService } from "../../../core/services/toast.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
  ],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
})
export default class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  // ==========================================
  // Form Model
  // ==========================================

  identifier = signal("");
  password = signal("");
  rememberMe = signal(true);

  // ==========================================
  // UI State
  // ==========================================

  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal("");

  // Email validation state
  emailTouched = signal(false);
  emailError = signal("");

  // ==========================================
  // Email Validation
  // ==========================================

  /**
   * Validate email while user is typing.
   * We intentionally don't show an error for a very short input
   * to avoid annoying the user while typing.
   */
  validateEmail(value: string): void {
    this.identifier.set(value);

    // Clear validation when empty
    if (!value.trim()) {
      this.emailError.set("");
      return;
    }

    // Don't show validation too early
    if (value.trim().length < 3) {
      this.emailError.set("");
      return;
    }

    const email = value.trim();

    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

    if (!emailRegex.test(email)) {
      this.emailError.set(
        "يرجى إدخال بريد إلكتروني صحيح، مثال: name@moe.gov.eg",
      );
    } else {
      this.emailError.set("");
    }
  }

  /**
   * Mark email as touched when user leaves the field.
   */
  onEmailBlur(): void {
    this.emailTouched.set(true);

    const email = this.identifier().trim();

    if (!email) {
      this.emailError.set("يرجى إدخال البريد الإلكتروني.");
      return;
    }

    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

    if (!emailRegex.test(email)) {
      this.emailError.set(
        "يرجى إدخال بريد إلكتروني صحيح، مثال: name@moe.gov.eg",
      );
    }
  }

  /**
   * Whether the email is currently valid.
   */
  isEmailValid(): boolean {
    const email = this.identifier().trim();

    if (!email) {
      return false;
    }

    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

    return emailRegex.test(email);
  }

  // ==========================================
  // Login
  // ==========================================

  onSubmit(): void {
    this.errorMessage.set("");

    const id = this.identifier().trim();
    const pass = this.password();

    // Mark email as touched
    this.emailTouched.set(true);

    // Required email
    if (!id) {
      this.emailError.set("يرجى إدخال البريد الإلكتروني.");
      return;
    }

    // Invalid email
    if (!this.isEmailValid()) {
      this.emailError.set(
        "يرجى إدخال بريد إلكتروني صحيح، مثال: name@moe.gov.eg",
      );
      return;
    }

    // Required password
    if (!pass) {
      this.errorMessage.set("يرجى إدخال كلمة المرور.");
      return;
    }

    this.isLoading.set(true);

    this.authService
      .login({
        email: id,
        password: pass,
      })
      .subscribe({
     next: (response) => {

  this.isLoading.set(false);

  this.toast.success(
    response.message,
    'مرحبًا بك'
  );

  console.log(
    'Access token:',
    sessionStorage.getItem('accessToken')
  );

  const returnUrl =
    this.route.snapshot.queryParams['returnUrl']
    || '/dashboard';

  this.router.navigateByUrl(returnUrl);

},

        error: (err) => {
          this.isLoading.set(false);

          console.error("Login error:", err);

          this.errorMessage.set(
            err?.error?.message ||
              err?.message ||
              "حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة لاحقاً.",
          );
        },
      });
  }

  // ==========================================
  // Password
  // ==========================================

  toggleShowPassword(): void {
    this.showPassword.update((val) => !val);
  }
}
