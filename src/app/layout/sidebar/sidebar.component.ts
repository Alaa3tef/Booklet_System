import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  RouterLink,
  RouterLinkActive
} from '@angular/router';

import { NavItem } from '../../core/models/nav-item.model';


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
export class SidebarComponent {

  // ==================================================
  // INPUTS
  // ==================================================

  @Input()
  mobileOpen = false;


  @Input()
  userRole = 'IT';


  // ==================================================
  // OUTPUTS
  // ==================================================

  @Output()
  closeMobile = new EventEmitter<void>();


  // ==================================================
  // NAVIGATION ITEMS
  // ==================================================

  readonly navItems = signal<NavItem[]>([

    {
      label: 'الرئيسية',
      icon: 'pi pi-home',
      route: '/dashboard'
    },

    {
      label: 'إدارة البيانات الأساسية',
      icon: 'pi pi-database',
      expanded: true,

      children: [
        // {
        //   label: 'المحافظات',
        //   icon: 'pi pi-circle-fill',
        //   route: '/governorates'
        // },

        // {
        //   label: 'المواد',
        //   icon: 'pi pi-circle-fill',
        //   route: '/materials'
        // },

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
      route: '/workflow/planning'
    },

    {
      label: 'الطباعة',
      icon: 'pi pi-print',
      route: '/workflow/printing'
    },

    {
      label: 'الجودة',
      icon: 'pi pi-verified',
      route: '/workflow/quality'
    },

    {
      label: 'التغليف',
      icon: 'pi pi-box',
      route: '/workflow/packing'
    },

    {
      label: 'التخزين',
      icon: 'pi pi-database',
      route: '/workflow/archiving'
    },

    // {
    //   label: 'إنتاج الملفات',
    //   icon: 'pi pi-file-export',
    //   route: '/production'
    // },

    // {
    //   label: 'المتابعة والتقارير',
    //   icon: 'pi pi-chart-bar',
    //   route: '/reports'
    // },

    {
      label: 'إدارة المستخدمين',
      icon: 'pi pi-users',
      route: '/users'
    },

    // {
    //   label: 'الإعدادات',
    //   icon: 'pi pi-cog',
    //   route: '/settings'
    // }

  ]);


  // ==================================================
  // ROLE THEME
  // ==================================================

  /**
   * Roles that should use the light sidebar theme.
   *
   * Planning
   * Printing
   * Quality
   * Packing
   * Archiving
   */
  isWorkflowUser(): boolean {

    const role = this.normalizeRole(this.userRole);

    const workflowRoles = [
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
    ];

    return workflowRoles.includes(role);
  }


  /**
   * Normalize role value
   */
  private normalizeRole(role: string): string {

    return (role || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }


  // ==================================================
  // GROUP TOGGLE
  // ==================================================

  toggle(item: NavItem): void {

    if (item.children) {
     console.log("toggle")
      item.expanded = !item.expanded;

    }

  }


  // ==================================================
  // MOBILE SIDEBAR
  // ==================================================

  closeSidebar(): void {

    this.closeMobile.emit();

  }

}
