import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ==========================================
  // Public Authentication Routes
  // ==========================================
  {
    path: '',
    loadComponent: () =>
      import('./features/auth/auth-layout/auth-layout.component').then(
        (m) => m.AuthLayoutComponent
      ),
    canActivate: [guestGuard],
    children: [
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(
            (m) => m.LoginComponent
          ),
        data: { title: 'تسجيل الدخول' }
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent
          ),
        data: { title: 'استعادة كلمة المرور' }
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password.component').then(
            (m) => m.ResetPasswordComponent
          ),
        data: { title: 'تعيين كلمة المرور' }
      }
    ]
  },

  // ==========================================
  // Protected Main System Routes
  // ==========================================
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: { breadcrumb: 'الرئيسية' }
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/user-permissions/user-permissions').then((m) => m.UserPermissionsComponent),
        data: { breadcrumb: 'الاعدادات' }
      },
      {
        path: 'committees/setup',
        loadComponent: () =>
          import('./features/committee-setup/committee-setup.component').then(
            (m) => m.CommitteeSetupComponent
          ),
        data: { breadcrumb: 'إعداد بيانات اللجان' }
      },
      {
        path: 'workflow/planning',
        loadComponent: () =>
          import('./features/workflow/planning/planning.component').then((m) => m.PlanningComponent),
        data: { breadcrumb: 'الإعداد' }
      },
      {
        path: 'workflow/printing',
        loadComponent: () =>
          import('./features/workflow/printing/printing.component').then((m) => m.PrintingComponent),
        data: { breadcrumb: 'الطباعة' }
      },
      {
        path: 'workflow/quality',
        loadComponent: () =>
          import('./features/workflow/quality/quality.component').then((m) => m.QualityComponent),
        data: { breadcrumb: 'الجودة' }
      },
      {
        path: 'workflow/packing',
        loadComponent: () =>
          import('./features/workflow/packing/packing.component').then((m) => m.PackingComponent),
        data: { breadcrumb: 'التغليف' }
      },
      {
        path: 'workflow/archiving',
        loadComponent: () =>
          import('./features/workflow/archiving/archiving.component').then(
            (m) => m.ArchivingComponent
          ),
        data: { breadcrumb: 'التخزين' }
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/user-management/user-management.component').then(
            (m) => m.UserManagementComponent
          ),
        data: { breadcrumb: 'إدارة المستخدمين' }
      },
      { path: '**', redirectTo: 'dashboard' }
    ]
  }
];

