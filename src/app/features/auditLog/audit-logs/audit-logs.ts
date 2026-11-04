import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil, debounceTime } from 'rxjs';
import { AuditLog, ActorLookup, BatchLookup, CommitteeLookup, DeliveryOrderLookup, AuditLogFilter } from '../model/auditLog.model';
import { AuditLogsService } from '../service/audit-logs-service';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './audit-logs.html',
  styleUrls: ['./audit-logs.scss']
})
export default class AuditLogsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  form!: FormGroup;

  logs: AuditLog[] = [];
  loading = false;
  errorMsg = '';

  // UI
  showAdvanced = false;
  skeletonRows = Array.from({ length: 8 });

  // pagination
  pageNumber = 1;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];
  totalCount = 0;
  totalPages = 0;
  hasNextPage = false;
  hasPreviousPage = false;

  // lookups
  actions: string[] = [];
  actors: ActorLookup[] = [];
  batches: BatchLookup[] = [];
  committees: CommitteeLookup[] = [];
  deliveryOrders: DeliveryOrderLookup[] = [];

  constructor(private fb: FormBuilder, private api: AuditLogsService) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      searchTerm: [''],
      from: [''],
      to: [''],
      action: [''],
      userId: [''],
      batchId: [''],
      committeeId: [{ value: '', disabled: true }],
      boxId: [''],
      deliveryOrderId: [''],
      ascending: ['false']
    });

    this.loadLookups();

    this.form.get('batchId')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(batchId => this.onBatchChange(batchId));

    this.form.get('searchTerm')!.valueChanges
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.onSearch());

    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- UI ----------
  toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
  }

  /** عدد الفلاتر المتقدمة المفعّلة (يظهر على الزر) */
  get advancedCount(): number {
    const v = this.form?.getRawValue();
    if (!v) return 0;
    let n = 0;
    if (v.batchId) n++;
    if (v.committeeId) n++;
    if (v.deliveryOrderId) n++;
    if (v.boxId) n++;
    if (v.ascending === 'true') n++;
    return n;
  }

  // ---------- Lookups ----------
  private loadLookups(): void {
    forkJoin({
      actions: this.api.getActions(),
      actors: this.api.getActors(),
      batches: this.api.getBatches(),
      deliveryOrders: this.api.getDeliveryOrders()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        this.actions = res.actions;
        this.actors = res.actors;
        this.batches = res.batches;
        this.deliveryOrders = res.deliveryOrders;
      });
  }

  private onBatchChange(batchId: any): void {
    const committeeCtrl = this.form.get('committeeId')!;
    committeeCtrl.setValue('', { emitEvent: false });
    this.committees = [];

    if (!batchId) {
      committeeCtrl.disable({ emitEvent: false });
      return;
    }

    committeeCtrl.enable({ emitEvent: false });
    this.api.getCommittees(+batchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => (this.committees = list));
  }

  // ---------- Data ----------
  private buildFilter(): AuditLogFilter {
    const v = this.form.value;
    const num = (x: any) => (x == null || x === '' ? null : +x);
    const dt = (x: string) => (x ? new Date(x).toISOString() : null);

    return {
      searchTerm: v.searchTerm?.trim() || null,
      from: dt(v.from),
      to: dt(v.to),
      action: v.action || null,
      userId: num(v.userId),
      batchId: num(v.batchId),
      committeeId: num(v.committeeId),
      boxId: num(v.boxId),
      deliveryOrderId: num(v.deliveryOrderId),
      ascending: v.ascending === 'true',
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      isPaged: true
    };
  }

  loadData(): void {
    this.loading = true;
    this.errorMsg = '';

    this.api.search(this.buildFilter())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.logs = res.items;
          this.totalCount = res.totalCount;
          this.totalPages = res.totalPages;
          this.hasNextPage = res.hasNextPage;
          this.hasPreviousPage = res.hasPreviousPage;
          this.loading = false;
        },
        error: () => {
          this.errorMsg = 'حدث خطأ أثناء تحميل البيانات';
          this.logs = [];
          this.totalCount = 0;
          this.loading = false;
        }
      });
  }

  onSearch(): void {
    this.pageNumber = 1;
    this.loadData();
  }

  onReset(): void {
    this.form.reset({
      searchTerm: '', from: '', to: '', action: '', userId: '',
      batchId: '', committeeId: '', boxId: '', deliveryOrderId: '',
      ascending: 'false'
    });
    this.form.get('committeeId')!.disable({ emitEvent: false });
    this.committees = [];
    this.onSearch();
  }

  // ---------- Pagination ----------
  goToPage(page: number): void {
    if (page < 1 || (this.totalPages && page > this.totalPages) || page === this.pageNumber) return;
    this.pageNumber = page;
    this.loadData();
  }

  onPageSizeChange(size: string): void {
    this.pageSize = +size;
    this.onSearch();
  }

  get pages(): (number | '...')[] {
    const total = this.totalPages;
    const current = this.pageNumber;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const result: (number | '...')[] = [1];
    if (current > 3) result.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) result.push(i);
    if (current < total - 2) result.push('...');
    result.push(total);
    return result;
  }

  get fromItem(): number {
    return this.totalCount === 0 ? 0 : (this.pageNumber - 1) * this.pageSize + 1;
  }

  get toItem(): number {
    return Math.min(this.pageNumber * this.pageSize, this.totalCount);
  }

  // ---------- UI helpers ----------
  actionClass(action: string): string {
    const a = (action || '').toLowerCase();
    if (a.includes('create') || a.includes('add')) return 'badge-success';
    if (a.includes('update') || a.includes('edit') || a.includes('activate')) return 'badge-warning';
    if (a.includes('delete') || a.includes('remove')) return 'badge-danger';
    if (a.includes('login') || a.includes('logout')) return 'badge-info';
    return 'badge-default';
  }

  trackByIndex = (index: number) => index;
}