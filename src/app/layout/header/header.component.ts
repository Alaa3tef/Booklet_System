import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import { CommonModule } from '@angular/common';

import { RouterLink } from '@angular/router';

import { AvatarModule } from 'primeng/avatar';


export interface Breadcrumb {
  label: string;
  route?: string;
}


@Component({
  selector: 'app-header',

  standalone: true,

  imports: [
    CommonModule,
    RouterLink,
    AvatarModule
  ],

  templateUrl: './header.component.html',

  styleUrl: './header.component.scss'
})
export class HeaderComponent {


  /* =====================================================
     INPUTS
  ===================================================== */

  @Input()
  breadcrumbs: Breadcrumb[] = [

    {
      label: 'الرئيسية',
      route: '/dashboard'
    },

    {
      label: 'إدارة البيانات الأساسية'
    },

    {
      label: 'إعداد اللجان'
    }

  ];


  @Input()
  userName = 'أحمد محمد';


  @Input()
  userRole = 'Super Admin';


  /* =====================================================
     OUTPUT
  ===================================================== */

  @Output()
  menuToggle = new EventEmitter<void>();


  /* =====================================================
     NOTIFICATIONS
  ===================================================== */

  notificationsCount = 3;


  /* =====================================================
     MOBILE MENU
  ===================================================== */

  toggleMenu(): void {

    this.menuToggle.emit();

  }


  /* =====================================================
     NOTIFICATIONS
  ===================================================== */

  openNotifications(): void {

    // ضعي هنا فتح Notification Panel
    // أو PrimeNG Overlay / Menu
  }


  /* =====================================================
     USER MENU
  ===================================================== */

  openUserMenu(): void {

    // ضعي هنا فتح User Menu
    // أو PrimeNG Menu
  }

}