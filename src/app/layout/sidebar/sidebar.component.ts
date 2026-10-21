import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  RouterLink,
  RouterLinkActive
} from '@angular/router';

import { NavItem } from '../../core/models/nav-item.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,

  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive
  ],

  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {

  private readonly authService = inject(AuthService);

  // ==================================================
  // INPUTS
  // ==================================================

  @Input()
  mobileOpen = false;

  // ==================================================
  // OUTPUTS
  // ==================================================

  @Output()
  closeMobile = new EventEmitter<void>();

  // ==================================================
  // ROLE (مشترك من AuthService - signal)
  // ==================================================

  /**
   * الدور الحالي القادم من Profile API
   */
  readonly role = computed(() => this.authService.profileRole());

  // ==================================================
  // NAVIGATION ITEMS
  // ==================================================

  readonly navItems = signal<NavItem[]>([

    // الرئيسية
    {
      label: 'الرئيسية',
      icon: 'pi pi-home',
      route: '/dashboard'
    },

    // إدارة البيانات الأساسية (IT فقط)
    {
      label: 'إدارة البيانات الأساسية',
      icon: 'pi pi-database',
      expanded: true,
      roles: ['it'],

      children: [
        {
          label: 'إدارة اللجان',
          icon: 'pi pi-circle-fill',
          route: '/committees/setup'
        }
      ]
    },

    {
      label: 'الإعداد',
      icon: 'pi pi-sliders-h',
      route: '/workflow/planning',
      roles: ['planning']
    },

    {
      label: 'الطباعة',
      icon: 'pi pi-print',
      route: '/workflow/printing',
      roles: ['printing']
    },

    {
      label: 'الجودة',
      icon: 'pi pi-verified',
      route: '/workflow/quality',
      roles: ['quality']
    },

    {
      label: 'التغليف',
      icon: 'pi pi-box',
      route: '/workflow/packing',
      roles: ['packing']
    },

    {
      label: 'التخزين',
      icon: 'pi pi-database',
      route: '/workflow/archiving',
      roles: ['archive']
    },

    {
      label: 'إدارة المستخدمين',
      icon: 'pi pi-users',
      route: '/users',
      roles: ['it']
    }, 
     {
      label: 'مواقع التخزين',
      icon: 'pi pi-map-marker',
      route: '/storage-locations',
      roles: ['superadmin']
    }

  ] as any[]);

  // ==================================================
  // VISIBLE NAV ITEMS
  // ==================================================

  /**
   * IT:
   * يشوف كل الصفحات
   *
   * Workflow users:
   * Dashboard + الصفحة الخاصة بالـ role فقط
   */

readonly visibleNavItems = computed(() => {
  const currentRole = this.normalizeRole(this.role());

  return this.navItems().filter(item => {
    // الرئيسية متاحة للجميع
    if (item.route === '/dashboard') {
      return true;
    }

    // مواقع التخزين للـ SuperAdmin فقط
    if (item.route === '/storage-locations') {
      return currentRole === 'superadmin' ||
             currentRole === 'super admin';
    }

    // إدارة البيانات الأساسية: IT فقط
    if (item.label === 'إدارة البيانات الأساسية') {
      return currentRole === 'it';
    }

    // باقي العناصر حسب الدور المحدد لها
    if (item.roles?.length) {
      return item.roles.some(
        role => this.normalizeRole(role) === currentRole
      );
    }

    // إخفاء العناصر غير المحددة
    return false;
  });
});

private isITRole(role: string): boolean {
  return [
    'it',
    'مسؤول النظام it',
    'مدير النظام it'
  ].includes(this.normalizeRole(role));
}


  // ==================================================
  // ROLE THEME
  // ==================================================

  /**
   * Workflow users فقط يأخذوا الـ Light Sidebar
   * IT يأخذ الـ Dark Sidebar
   */
  isWorkflowUser(): boolean {

    const role = this.normalizeRole(this.role());

    return [
      'planning',
      'plan',
      'printing',
      'print',
      'quality',
      'packing',
      'packaging',
      'archiving',
      'archive',

      'التخطيط',
      'الإعداد',
      'الطباعة',
      'الجودة',
      'التغليف',
      'التخزين'
    ].includes(role);

  }

  // ==================================================
  // IT ROLE
  // ==================================================

  

  // ==================================================
  // NORMALIZE ROLE
  // ==================================================

  private normalizeRole(role: string): string {

    return (role || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  }

  // ==================================================
  // INIT
  // ==================================================

  ngOnInit(): void {
    // مش هيبعت request تاني لو الـ Header حمّلها قبله
    this.authService.loadProfile();
  }

  // ==================================================
  // GROUP TOGGLE
  // ==================================================

  toggle(item: NavItem): void {

    if (!item.children) return;

    this.navItems.update(items =>
      items.map(i =>
        i.label === item.label
          ? { ...i, expanded: !i.expanded }
          : i
      )
    );
  }

  // ==================================================
  // MOBILE SIDEBAR
  // ==================================================

  closeSidebar(): void {

    this.closeMobile.emit();

  }

}
