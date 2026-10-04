import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

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
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private midnightTimer?: ReturnType<typeof setTimeout>;

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

  @Input()
  sidebarOpen = false;

  /* =====================================================
     OUTPUT
  ===================================================== */

  @Output()
  menuToggle = new EventEmitter<void>();

  /* =====================================================
     PROFILE (مشترك من AuthService - signal)
  ===================================================== */

  readonly profileData = this.authService.profileData;

  /* =====================================================
     NOTIFICATIONS
  ===================================================== */

  readonly showNotifications = signal(false);

  /* =====================================================
     DATE
  ===================================================== */

  readonly currentDate = signal(new Date());

  /* =====================================================
     USER DROPDOWN
  ===================================================== */

  readonly showUserDropdown = signal(false);

  constructor() {
    this.scheduleDateRefresh();
  }

  ngOnInit(): void {
    // مش هيبعت request تاني لو الـ Sidebar أو أي حد حمّلها قبله
    this.authService.loadProfile();
  }

  get currentDayLabel(): string {
    return new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(this.currentDate());
  }

  get currentDateLabel(): string {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(this.currentDate());
  }

  get currentUser() {
    return this.authService.currentUser();
  }

  /* =====================================================
     MOBILE MENU
  ===================================================== */

  toggleMenu(): void {
    this.menuToggle.emit();
  }

  private scheduleDateRefresh(): void {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 1, 0);

    this.midnightTimer = setTimeout(() => {
      this.currentDate.set(new Date());
      this.scheduleDateRefresh();
    }, nextMidnight.getTime() - now.getTime());
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

    this.authService.logout().subscribe({
      next: (response) => {
        console.log('Logout response:', response);
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        // الـ finalize في الـ service بيمسح الـ session، فنروح للـ login برضه
        this.router.navigate(['/login']);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper')) {
      this.closeUserMenu();
    }
    if (!target.closest('.notification-wrapper')) {
      this.showNotifications.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
    }
  }
}
