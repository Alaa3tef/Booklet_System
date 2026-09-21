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


  @Input()
  mobileOpen = false;


  @Output()
  closeMobile = new EventEmitter<void>();


  readonly navItems = signal<NavItem[]>([


    {
      label: 'الرئيسية',
      icon: 'pi pi-home',
      route: '/dashboard'
    },


    {
      label: 'متابعة الإنتاج',
      icon: 'pi pi-box',
      route: '/production'
    },


    {
      label: 'المواد',
      icon: 'pi pi-file',
      route: '/materials'
    },


    {
      label: 'اللجان',
      icon: 'pi pi-users',
      route: '/committees'
    },


    {
      label: 'الطباعة',
      icon: 'pi pi-print',
      route: '/workflow/printing'
    },


    {
      label: 'الجودة',
      icon: 'pi pi-search',
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


    {
      label: 'التقارير',
      icon: 'pi pi-chart-bar',
      route: '/reports'
    },


    {
      label: 'إدارة المستخدمين',
      icon: 'pi pi-users',
      route: '/users'
    },


    {
      label: 'الإعدادات',
      icon: 'pi pi-cog',
      route: '/settings'
    }

  ]);


  /**
   * Toggle menu group
   */

  toggle(item: NavItem): void {

    if (item.children) {

      item.expanded =
        !item.expanded;

    }

  }


  /**
   * Close mobile sidebar
   */

  closeSidebar(): void {

    this.closeMobile.emit();

  }

}