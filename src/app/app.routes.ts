import { Routes } from '@angular/router';
import { authGuard, dashboardRoleGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ==========================================
  // Public Authentication Routes
  // ==========================================
  {
    path: '',
    loadComponent: () =>
      import('./features/auth/auth-layout/auth-layout.component'),
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
          import('./features/auth/login/login.component'),
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
        canActivate: [dashboardRoleGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component'),
        data: { breadcrumb: 'الرئيسية' }
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/user-permissions/user-permissions'),
        data: { breadcrumb: 'الاعدادات' }
      },
      {
        path: 'committees/setup',
        loadComponent: () =>
          import('./features/committee-setup/committee-setup.component'),
        data: { breadcrumb: 'إعداد بيانات اللجان' }
      },
       {
        path: 'warehouses',
        loadComponent: () =>
          import('./features/warehouses/warehouses.component'),
        data: { breadcrumb: ' ادارة المخازن' }
      },
      {
        path: 'workflow/planning',
        loadComponent: () =>
          import('./features/workflow/planning/planning.component'),
        data: { breadcrumb: 'الإعداد' }
      },
      {
        path: 'workflow/printing-approved',
        loadComponent: () =>
          import('./features/workflow/printing-approved/printing-approved.component'),
        data: { breadcrumb: 'إعتماد الطباعة' }
      },
      {
        path: 'workflow/printing',
        loadComponent: () =>
          import('./features/workflow/printing/printing.component'),
        data: { breadcrumb: 'الطباعة' }
      },
      {
        path: 'workflow/quality',
        loadComponent: () =>
          import('./features/workflow/quality/quality.component'),
        data: { breadcrumb: 'الجودة' }
      },
      {
        path: 'workflow/packing',
        loadComponent: () =>
          import('./features/workflow/packing/packing.component'),
        data: { breadcrumb: 'التغليف' }
      },
      {
        path: 'workflow/archiving',
        loadComponent: () =>
          import('./features/workflow/archiving/archiving.component'),
        data: { breadcrumb: 'التخزين' }
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/user-management/user-management.component'),
        data: { breadcrumb: 'إدارة المستخدمين' }
      },
      {
        path: 'storage-locations',
  loadComponent: () => import('./features/storage-locations/storage-locations.component')
      },

      {
        path: 'user-sessions',
        loadComponent: () =>
          import('./features/user-sessions/user-sessions.component'),
        data: { breadcrumb: 'جلسات المستخدمين' }
      },
      { path: '**', redirectTo: 'dashboard' }
    ]
  }

];

