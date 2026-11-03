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
      route: '/dashboard',
      roles: ['Top',  'superadmin', 'it']
    },

    // إدارة البيانات الأساسية (IT فقط)
    {
      label: 'إدارة البيانات الأساسية',
      icon: 'pi pi-database',
      expanded: false,
          roles: ['it'],

      children: [
        {
          label: 'إدارة اللجان',
          icon: 'pi pi-circle-fill',
          route: '/committees/setup',

        },

      ]
    },

    {
      label: 'الإعداد',
      icon: 'pi pi-sliders-h',
      route: '/workflow/planning',
      roles: ['projectmanagment' , 'superadmin']
    },

    {
      label: 'اعتماد الطباعة',
      icon: 'pi pi-sliders-h',
      route: '/workflow/printing-approved',
      roles: ['prequality' , 'superadmin']
    },

    {
      label: 'الطباعة',
      icon: 'pi pi-print',
      route: '/workflow/printing',
      roles: ['printing' , 'superadmin']
    },

    {
      label: 'الجودة',
      icon: 'pi pi-verified',
      route: '/workflow/quality',
      roles: ['quality' , 'superadmin']
    },

    {
      label: 'التغليف',
      icon: 'pi pi-box',
      route: '/workflow/packing',
      roles: ['packing' , 'superadmin']
    },

    {
      label: 'التخزين',
      icon: 'pi pi-database',
      route: '/workflow/archiving',
      roles: ['warehouse' , 'superadmin']
    },



    {
      label: 'إدارة المخازن والتخزين',
      icon: 'pi pi-building',
      expanded: false,
      roles: ['superadmin'],
      children: [
        {
          label: 'إدارة المخازن',
          icon: 'pi pi-building',
          route: '/warehouses'

        },
        {
          label: 'مواقع التخزين',
          icon: 'pi pi-map-marker',
          route: '/storage-locations'
        }
      ]
    },
    {
      label: 'إدارة المستخدمين والجلسات',
      icon: 'pi pi-users',
      expanded: false,
      roles: ['superadmin'],
      children: [
        {
          label: 'إدارة المستخدمين',
          icon: 'pi pi-users',
          route: '/users'
        },
        {
          label: 'جلسات المستخدمين',
          icon: 'pi pi-shield',
          route: '/user-sessions'
        }
      ]
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
    // Dashboard is restricted to system administrators and top management.
    if (item.route === '/dashboard') {
      return [
        'superadmin', 'super admin', 'it',
        'مسؤول النظام it', 'مدير النظام it',
        'top', 'top management', 'topmanagment'
      ]
        .includes(currentRole);
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
      'projectmanagment',
      'printing',
      'print',
      'quality',
      'packing',
      'packaging',
      'archiving',
      'archive',
      'prequality',

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

  // private isITRole(role: string): boolean {

  //   return [
  //     'it',
  //     'admin',
  //     'administrator',
  //     'super admin',
  //     'superadmin',
  //     'superman',
  //     'super_admin',
  //     'topmanagment',
  //     'top managment',
  //     'top management',

  //     'مسؤول النظام',
  //     'مسؤول النظام it',
  //     'مدير النظام',
  //     'مدير النظام it',

  //     'system admin',
  //     'system administrator'
  //   ].includes(role);

  // }

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

  // toggle(item: NavItem): void {

  //   if (!item.children) return;

  //   this.navItems.update(items =>
  //     items.map(i =>
  //       i.label === item.label
  //         ? { ...i, expanded: !i.expanded }
  //         : i
  //     )
  //   );
  // }


toggle(selectedItem: NavItem): void {
  const wasExpanded = selectedItem.expanded;

  // Close all parent menus
  this.navItems().forEach((item: NavItem) => {
    if (item.children?.length) {
      item.expanded = false;
    }
  });

  // Toggle the selected menu
  selectedItem.expanded = !wasExpanded;

  // Notify Angular that the signal value has changed
  this.navItems.update(items => [...items]);
}


  // ==================================================
  // MOBILE SIDEBAR
  // ==================================================

  closeSidebar(): void {

    this.closeMobile.emit();

  }

}
