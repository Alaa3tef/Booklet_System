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
      role: 'it',

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
      role: 'planning'
    },

    {
      label: 'الطباعة',
      icon: 'pi pi-print',
      route: '/workflow/printing',
      role: 'printing'
    },

    {
      label: 'الجودة',
      icon: 'pi pi-verified',
      route: '/workflow/quality',
      role: 'quality'
    },

    {
      label: 'التغليف',
      icon: 'pi pi-box',
      route: '/workflow/packing',
      role: 'packing'
    },

    {
      label: 'التخزين',
      icon: 'pi pi-database',
      route: '/workflow/archiving',
      role: 'archive'
    },

    {
      label: 'إدارة المستخدمين',
      icon: 'pi pi-users',
      route: '/users',
      role: 'it'
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

    // IT / ADMIN: يشوف كل حاجة
    if (this.isITRole(currentRole)) {
      return this.navItems();
    }

    const roleRouteMap: Record<string, string> = {
      planning: '/workflow/planning',
      printing: '/workflow/printing',
      quality: '/workflow/quality',
      packing: '/workflow/packing',
      archiving: '/workflow/archiving',
      archive: '/workflow/archiving'
    };

    const workflowRoute = roleRouteMap[currentRole];

    return this.navItems().filter(item => {

      // الرئيسية دايمًا ظاهرة
      if (item.route === '/dashboard') {
        return true;
      }

      // المجموعات (فيها children) تظهر لـ IT فقط
      if (item.children) {
        return false;
      }

      // صفحة الـ workflow الخاصة بالمستخدم فقط
      return !!workflowRoute && item.route === workflowRoute;
    });

  });

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

  private isITRole(role: string): boolean {

    return [
      'it',
      'admin',
      'administrator',
      'super admin',
      'superadmin',

      'مسؤول النظام',
      'مسؤول النظام it',
      'مدير النظام',
      'مدير النظام it',

      'system admin',
      'system administrator'
    ].includes(role);

  }

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