import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import { CommonModule } from '@angular/common';

import { RouterLink } from '@angular/router';

import { AvatarModule } from 'primeng/avatar';

import { ButtonModule } from 'primeng/button';

import { TooltipModule } from 'primeng/tooltip';


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
    AvatarModule,
    ButtonModule,
    TooltipModule
  ],

  templateUrl: './header.component.html',

  styleUrl: './header.component.scss'
})
export class HeaderComponent {


  @Input()
  breadcrumbs: Breadcrumb[] = [
    {
      label: 'الرئيسية',
      route: '/dashboard'
    }
  ];


  @Input()
  userName = 'أحمد محمد';


  @Input()
  userRole = 'Super Admin';


  @Output()
  menuToggle = new EventEmitter<void>();


  notificationsCount = 3;


  /**
   * Open mobile sidebar
   */
  toggleMenu(): void {

    this.menuToggle.emit();

  }


  /**
   * Notification click
   */
  openNotifications(): void {

    console.log('Open notifications');

  }


  /**
   * User menu
   */
  openUserMenu(): void {

    console.log('Open user menu');

  }

}