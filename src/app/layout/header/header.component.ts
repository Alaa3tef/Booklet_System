import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { AuthService } from '../../core/services/auth.service';

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
  private readonly authService = inject(AuthService);

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
     USER DROPDOWN
  ===================================================== */
  showUserDropdown = signal(false);

  get currentUser() {
    return this.authService.currentUser();
  }

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
    // Notification panel handler
  }

  /* =====================================================
     USER MENU
  ===================================================== */

  openUserMenu(): void {
    this.showUserDropdown.update((v) => !v);
  }

  closeUserMenu(): void {
    this.showUserDropdown.set(false);
  }

  logout(): void {
    this.closeUserMenu();
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper')) {
      this.closeUserMenu();
    }
  }
}