import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Breadcrumb, HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  sidebarOpen = false;

  userName = 'أحمد محمد';

  userRole = 'Super Admin';

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


  /**
   * فتح / غلق الـ Sidebar
   */
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }


  /**
   * غلق الـ Sidebar
   */
  closeSidebar(): void {
    this.sidebarOpen = false;
  }
}
