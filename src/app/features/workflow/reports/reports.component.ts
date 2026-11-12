import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AuthService } from '../../../core/services/auth.service';
import { DepartmentReportsComponent } from './components/department-reports/department-reports.component';
import { WarehouseReportsComponent } from './components/warehouse-reports/warehouse-reports.component';
import { ManagementReportsComponent } from './components/management-reports/management-reports.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    ProgressSpinnerModule,
    DepartmentReportsComponent,
    WarehouseReportsComponent,
    ManagementReportsComponent
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  encapsulation: ViewEncapsulation.None
})
export default class ReportsComponent implements OnInit {

  private readonly authService = inject(AuthService);

  readonly manualRoleOverride = signal<string | null>(null);

  /**
   * قراءة دور المستخدم الحالي من AuthService
   */
  readonly rawRole = computed(() => {
    return this.manualRoleOverride()
      || this.authService.profileRole()
      || this.authService.currentUser()?.role
      || '';
  });

  /**
   * تسوية اسم الدور بدون فراغات وحروف صغيرة
   */
  readonly roleNormalized = computed(() => {
    return (this.rawRole() || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  });

  /**
   * تحديد نوع تقرير الشاشة بناءً على الدور:
   * 1. warehouse  ← Warehouse (المخزن: مواقع الصناديق + العمل خلال فترة + التتبع)
   * 2. management ← Super Admin / Management / Planning (متابعة الإنتاج)
   * 3. operations ← Printing / Quality / Packing (الشكل الحالي)
   */
  readonly reportType = computed<'warehouse' | 'management' | 'operations'>(() => {
    const role = this.roleNormalized();

    // أدوار المخزن
    if (['warehouse', 'ware', 'storage', 'archiving', 'مخزن', 'المخزن'].some(r => role.includes(r))) {
      return 'warehouse';
    }

    // أدوار الإدارة والتخطيط والمدير
    if (['superadmin', 'top', 'topmanagement', 'topmanagment', 'planning', 'projectmanagement', 'projectmanagment', 'plan', 'ادارة', 'إدارة', 'تخطيط'].some(r => role.includes(r))) {
      return 'management';
    }

    // أدوار الأقسام التشغيلية (الطباعة / الجودة / التغليف)
    return 'operations';
  });

  /**
   * التحقق مما إذا كان المستخدم مديراً أو SuperAdmin لعرض مفتاح التبديل الاختياري
   */
  readonly isSuperAdmin = computed(() => {
    const role = (this.authService.profileRole() || this.authService.currentUser()?.role || '')
      .trim().toLowerCase().replace(/[\s_-]+/g, '');
    return role === 'superadmin' || role.includes('top');
  });

  ngOnInit(): void {
    if (!this.authService.profileRole() && !this.authService.currentUser()?.role) {
      this.authService.loadProfile();
    }
  }

  setRoleOverride(role: string | null): void {
    this.manualRoleOverride.set(role);
  }
}
