import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink  } from '@angular/router';

import { AvatarModule } from 'primeng/avatar';
import { AuthService } from '../../core/services/auth.service';

export interface Breadcrumb {
  label: string;
  route?: string;
}

interface HeaderNotification {
  id: number;
  title: string;
  message: string;
  icon: string;
  read: boolean;
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
export class HeaderComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private midnightTimer?: ReturnType<typeof setTimeout>;
  private readonly router = inject(Router);

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

  readonly showNotifications = signal(false);


  readonly currentDate = signal(new Date());
  profileData!: any;

  constructor() {
    this.scheduleDateRefresh();
  }

ngOnInit(): void {
  this.profile()
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

      // Still clear local session and go to login
      // this.router.navigate(['/login']);
    }
  });
}
profile() {
  this.closeUserMenu();
  this.authService.profile().subscribe({
        next: (response) => {
      console.log('Logout response:', response);
      this.profileData = response.data;
    },
    error: (error) => {
      console.error('Logout error:', error);

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
