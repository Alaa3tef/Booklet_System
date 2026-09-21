import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
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
      { path: '**', redirectTo: 'dashboard' }
    ]
  }
];
