import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime } from 'rxjs';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { UserSession } from './model/user-session.model';
import { UserSessionsService } from './service/user-sessions.service';

@Component({
  selector: 'app-user-sessions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './user-sessions.component.html',
  styleUrl: './user-sessions.component.scss'
})
export default class UserSessionsComponent implements OnInit {
  private readonly api = inject(UserSessionsService);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  private listSub?: Subscription;
  private readonly search$ = new Subject<string>();

  // ==========================================
  // DATA
  // ==========================================

  readonly rows = signal<UserSession[]>([]);
  readonly totalCount = signal(0);
  readonly totalActiveSessions = signal(0);
  readonly totalInactiveSessions = signal(0);
  readonly pageNumber = signal(1);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalCount() / this.pageSize()))
  );
  readonly paginationStart = computed(() =>
    this.totalCount() === 0 ? 0 : (this.pageNumber() - 1) * this.pageSize() + 1
  );
  readonly paginationEnd = computed(() =>
    Math.min(this.pageNumber() * this.pageSize(), this.totalCount())
  );
  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const current = this.pageNumber();

    if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
    if (current <= 3) return [1, 2, 3, 'dots', total];
    if (current >= total - 2) return [1, 'dots', total - 2, total - 1, total];
    return [1, 'dots', current, 'dots', total];
  });

  // ==========================================
  // FILTERS
  // ==========================================

  readonly searchInput = signal('');
  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | 'online' | 'offline'>('all');

  readonly statusOptions = [
    { label: 'جميع المستخدمين', value: 'all' },
    { label: 'متصل (توكن نشط)', value: 'online' },
    { label: 'مسجّل الخروج', value: 'offline' }
  ];

  /** online = isActive is true (active token, hasn't expired / been revoked) */
  readonly filtered = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    return this.rows().filter(s => {
      const matchesSearch =
        !term ||
        s.fullName.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        (s.currentSessionIp ?? '').includes(term) ||
        (s.lastSessionIp ?? '').includes(term);

      const matchesStatus =
        status === 'all' ||
        (status === 'online' && s.isActive) ||
        (status === 'offline' && !s.isActive);

      return matchesSearch && matchesStatus;
    });
  });

  readonly onlineCount = computed(() => this.totalActiveSessions());
  readonly offlineCount = computed(() => this.totalInactiveSessions());

  readonly hasActiveFilters = computed(
    () => this.statusFilter() !== 'all' || !!this.searchTerm()
  );

  // ==========================================
  // REVOKE (force logout)
  // ==========================================

  revokeVisible = false;
  readonly revokeTarget = signal<UserSession | null>(null);
  readonly revoking = signal(false);

  // ==========================================
  // INIT
  // ==========================================

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        if (term === this.searchTerm()) return;
        this.searchTerm.set(term);
        this.pageNumber.set(1);
        this.load();
      });

    this.load();
  }

  // ==========================================
  // LOAD
  // ==========================================

  load(): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(false);

    this.listSub = this.api.getAll(this.pageNumber(), this.pageSize()).subscribe({
      next: res => {
        const page = res.data;
        this.rows.set(Array.isArray(page?.data) ? page.data : []);
        this.totalCount.set(page?.totalCount ?? 0);
        this.totalActiveSessions.set(page?.totalActiveSessions ?? 0);
        this.totalInactiveSessions.set(page?.totalInactiveSessions ?? 0);
        this.pageNumber.set(page?.currentPage ?? this.pageNumber());
        this.pageSize.set(page?.pageSize ?? this.pageSize());
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.totalCount.set(0);
        this.totalActiveSessions.set(0);
        this.totalInactiveSessions.set(0);
        this.loadError.set(true);
        this.loading.set(false);
      }
    });
  }

  // ==========================================
  // FILTER ACTIONS
  // ==========================================

  onSearchInput(value: string): void {
    this.searchInput.set(value);
    this.search$.next(value.trim());
  }

  onStatusChange(value: 'all' | 'online' | 'offline'): void {
    this.statusFilter.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  clearFilters(): void {
    this.statusFilter.set('all');
    this.searchInput.set('');
    this.searchTerm.set('');
    this.pageNumber.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.pageNumber()) return;
    this.pageNumber.set(page);
    this.load();
  }

  previousPage(): void {
    this.goToPage(this.pageNumber() - 1);
  }

  nextPage(): void {
    this.goToPage(this.pageNumber() + 1);
  }

  // ==========================================
  // REVOKE SESSION
  // ==========================================

  openRevoke(s: UserSession): void {
    this.revokeTarget.set(s);
    this.revokeVisible = true;
  }

  closeRevoke(): void {
    if (this.revoking()) return;
    this.revokeVisible = false;
    this.revokeTarget.set(null);
  }

  confirmRevoke(): void {
    const target = this.revokeTarget();
    if (!target || this.revoking()) return;

    this.revoking.set(true);
    this.api.revokeSession(target.userId).subscribe({
      next: () => {
        this.revoking.set(false);
        this.revokeVisible = false;
        this.revokeTarget.set(null);
        this.toast.add({
          severity: 'success',
          summary: 'تم بنجاح',
          detail: `تم إنهاء جلسة ${target.fullName} بنجاح`
        });
        this.load();
      },
      error: err => {
        this.revoking.set(false);
        const msg = err?.error?.message ?? 'حدث خطأ أثناء إنهاء الجلسة';
        this.toast.add({ severity: 'error', summary: 'خطأ', detail: msg });
      }
    });
  }

  // ==========================================
  // HELPERS
  // ==========================================

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  initials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/);
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return (parts[0] || 'م').slice(0, 2);
  }
}
