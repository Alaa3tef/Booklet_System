import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewEncapsulation, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { Lookups } from '../../../shared/services/lookups';
import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';

const PENDING = 'قيد التغليف';
const DONE = 'تم التغليف';
const REJECTED = 'مرفوض';

interface PackingRow extends WorkflowStatusRow {
  governorate: string;
  qrCode: string;
}

interface PackingScanResult {
  qrCode: string;
  subject: string;
  committeeNumber: any;
  governorate: string;
  scanType: string;
  scannedAt: string;
}

interface Option {
  label: string;
  value: string;
}

@Component({
  selector: 'app-packing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    TextareaModule,
    TooltipModule,
    WorkflowStepLayoutComponent
  ],
  templateUrl: './packing.component.html',
  styleUrl: './packing.component.scss',
  // الـ dialogs بتتعمل render برا الـ component، فبنستخدم None مع prefix "pk-" بدل ::ng-deep
  encapsulation: ViewEncapsulation.None
})
export default class PackingComponent implements OnInit {
  private readonly lookups = inject(Lookups);
  private readonly destroyRef = inject(DestroyRef);

  readonly essentials = [
    'تغليف الأظرف الصغيرة للجنة في ظرف كبير',
    'عمل Scan للـ QR الخارجي للجنة بالكامل',
    'تسجيل حالة التغليف'
  ];

  readonly reviewUsers = [
    { id: 1, name: 'أحمد محمد', role: 'مراجع أول' },
    { id: 2, name: 'محمد علي', role: 'مراجع جودة' },
    { id: 3, name: 'سارة أحمد', role: 'مراجع محتوى' },
    { id: 4, name: 'محمود حسن', role: 'مراجع نهائي' }
  ];

  readonly pageSizes = [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '20', value: 20 }
  ];

  // =====================================================
  // Data
  // =====================================================

  readonly rows = signal<PackingRow[]>([
    { index: 1, subject: 'اللغة العربية', committeeNumber: '101', governorate: 'القاهرة', qrCode: 'QR-PACK-101', status: DONE, statusTone: 'success' },
    { index: 2, subject: 'اللغة العربية', committeeNumber: '102', governorate: 'الجيزة', qrCode: 'QR-PACK-102', status: PENDING, statusTone: 'warning' },
    { index: 3, subject: 'اللغة العربية', committeeNumber: '103', governorate: 'القاهرة', qrCode: 'QR-PACK-103', status: PENDING, statusTone: 'warning' },
    { index: 4, subject: 'الرياضيات', committeeNumber: '104', governorate: 'المنوفية', qrCode: 'QR-PACK-104', status: PENDING, statusTone: 'warning' }
  ]);

  // =====================================================
  // Lookups (API)
  // =====================================================

  readonly subjectOptions = signal<Option[]>([]);
  readonly governorateOptions = signal<Option[]>([]);
  readonly subjectsLoading = signal(false);
  readonly governoratesLoading = signal(false);

  ngOnInit(): void {
    this.load(
      this.lookups.getLookupSubjectData(),
      ['name', 'subjectName', 'subject'],
      this.subjectOptions,
      this.subjectsLoading
    );
    this.load(
      this.lookups.getLookupGovernorateData(),
      ['name', 'governorateName', 'governorate'],
      this.governorateOptions,
      this.governoratesLoading
    );
  }

  /** بيحمّل lookup ويحوّله لـ options (نفس المنطق للمواد والمحافظات) */
  private load(
    request$: any,
    nameKeys: string[],
    target: WritableSignal<Option[]>,
    loading: WritableSignal<boolean>
  ): void {
    loading.set(true);

    request$
      .pipe(
        catchError(error => {
          console.error('Error loading lookup:', error);
          return of([]);
        }),
        finalize(() => loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response: any) => {
        const options = this.extractItems(response)
          .map((item: any) => {
            const name = String(nameKeys.map(k => item?.[k]).find(v => v != null) ?? '');
            return { label: name, value: name };
          })
          .filter(o => o.label.trim() !== '');

        target.set(options);
      });
  }

  // يدعم أكثر من شكل شائع لاستجابة الـ API
  private extractItems(response: any): any[] {
    if (Array.isArray(response)) return response;

    return (
      [response?.data, response?.data?.data, response?.result, response?.result?.data, response?.items].find(
        Array.isArray
      ) ?? []
    );
  }

  // =====================================================
  // Filters
  // =====================================================

  readonly subjectFilter = signal<string | null>(null);
  readonly governorateFilter = signal<string | null>(null);
  readonly committeeFilter = signal('');

  /** تبويب الحالة بيتطبق فورًا */
  readonly statusFilter = signal<string | null>(null);

  private readonly appliedFilters = signal({
    subject: null as string | null,
    governorate: null as string | null,
    committee: ''
  });

  /** الصفوف بعد البحث (قبل تبويب الحالة) - تُستخدم لعدّادات التبويبات */
  private readonly searchedRows = computed(() => {
    const { subject, governorate, committee } = this.appliedFilters();
    const term = committee.trim();

    return this.rows().filter(
      r =>
        (!subject || r.subject === subject) &&
        (!governorate || r.governorate === governorate) &&
        (!term || String(r.committeeNumber ?? '').includes(term))
    );
  });

  readonly filteredRows = computed(() => {
    const status = this.statusFilter();
    return status ? this.searchedRows().filter(r => r.status === status) : this.searchedRows();
  });

  readonly statusTabs = computed(() => {
    const rows = this.searchedRows();
    const count = (s: string) => rows.filter(r => r.status === s).length;

    return [
      { key: null as string | null, label: 'الكل', icon: 'pi-th-large', tone: 'neutral', count: rows.length },
      { key: PENDING, label: 'قيد التغليف', icon: 'pi-clock', tone: 'warning', count: count(PENDING) },
      { key: DONE, label: 'تم التغليف', icon: 'pi-check-circle', tone: 'success', count: count(DONE) },
      { key: REJECTED, label: 'مرفوضة', icon: 'pi-times-circle', tone: 'danger', count: count(REJECTED) }
    ];
  });

  readonly hasActiveFilters = computed(() => {
    const f = this.appliedFilters();
    return !!(f.subject || f.governorate || f.committee.trim());
  });

  applyFilters(): void {
    this.appliedFilters.set({
      subject: this.subjectFilter(),
      governorate: this.governorateFilter(),
      committee: this.committeeFilter()
    });
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.subjectFilter.set(null);
    this.governorateFilter.set(null);
    this.committeeFilter.set('');
    this.applyFilters();
  }

  setStatus(status: string | null): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  // =====================================================
  // Pagination
  // =====================================================

  readonly pageSize = signal(5);
  readonly currentPage = signal(1);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize()))
  );

  readonly paginatedRows = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const cur = this.currentPage();

    if (total <= 4) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 2) return [1, 2, 3, 'dots', total];
    if (cur >= total - 1) return [1, 'dots', total - 2, total - 1, total];
    return [1, 'dots', cur, 'dots', total];
  });

  readonly paginationStart = computed(() =>
    this.filteredRows().length ? (this.currentPage() - 1) * this.pageSize() + 1 : 0
  );

  readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredRows().length)
  );

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.currentPage.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  // =====================================================
  // Card helpers
  // =====================================================

  statusIcon(row: PackingRow): string {
    return row.status === DONE ? 'pi-check-circle' : row.status === REJECTED ? 'pi-times-circle' : 'pi-clock';
  }

  isPending(row: PackingRow): boolean {
    return row.status === PENDING;
  }

  isDone(row: PackingRow): boolean {
    return row.status === DONE;
  }

  isRejected(row: PackingRow): boolean {
    return row.status === REJECTED;
  }

  // =====================================================
  // Scan dialog
  // =====================================================

  scanDialogVisible = false;
  selectedRow: PackingRow | null = null;
  isScanning = false;
  scanCompleted = false;
  scanMessage = '';
  scanResult: PackingScanResult | null = null;

  openScanDialog(row: PackingRow): void {
    if (!this.isPending(row)) return;

    this.selectedRow = row;
    this.isScanning = false;
    this.scanCompleted = false;
    this.scanMessage = '';
    this.scanResult = null;
    this.scanDialogVisible = true;
  }

  startScan(): void {
    if (this.isScanning || this.scanCompleted || !this.selectedRow) return;

    this.isScanning = true;
    this.scanMessage = 'جاري قراءة QR الغلاف الخارجي...';

    // Mock Scan
    setTimeout(() => {
      const row = this.selectedRow!;

      this.scanResult = {
        qrCode: `${row.qrCode}-OUTER`,
        subject: row.subject,
        committeeNumber: row.committeeNumber,
        governorate: row.governorate,
        scanType: 'الغلاف الخارجي للجنة',
        scannedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };

      this.isScanning = false;
      this.scanCompleted = true;
      this.scanMessage = 'تم قراءة QR الغلاف الخارجي بنجاح';
    }, 1400);
  }

  confirmPacking(): void {
    if (!this.selectedRow || !this.scanCompleted) return;

    const row = this.selectedRow;

    // هنا بعدين هيتحط API
    console.info('Confirm Packing', {
      committeeNumber: row.committeeNumber,
      subject: row.subject,
      scan: this.scanResult
    });

    this.updateStatus(row.index, DONE, 'success');
    this.scanDialogVisible = false;
  }

  closeScanDialog(): void {
    if (this.isScanning) return;

    this.scanDialogVisible = false;
    this.selectedRow = null;
    this.scanResult = null;
    this.scanCompleted = false;
    this.scanMessage = '';
  }

  private updateStatus(index: number, status: string, statusTone: PackingRow['statusTone']): void {
    this.rows.update(rows => rows.map(r => (r.index === index ? { ...r, status, statusTone } : r)));
  }

  // =====================================================
  // Reject dialog
  // =====================================================

  rejectDialogVisible = false;
  rejectReason = '';
  selectedReviewers: any[] = [];
  rejectSubmitting = false;

  openRejectDialog(): void {
    if (!this.selectedRow || !this.scanCompleted) return;

    this.rejectReason = '';
    this.selectedReviewers = [];
    this.rejectDialogVisible = true;
  }

  get isRejectFormValid(): boolean {
    return this.rejectReason.trim().length >= 10 && this.selectedReviewers.length > 0;
  }

  submitRejection(): void {
    if (!this.selectedRow || !this.isRejectFormValid) return;

    this.rejectSubmitting = true;
    const row = this.selectedRow;

    console.info('Packing Rejection', {
      rowIndex: row.index,
      subject: row.subject,
      committeeNumber: row.committeeNumber,
      governorate: row.governorate,
      scan: this.scanResult,
      reason: this.rejectReason.trim(),
      reviewerIds: this.selectedReviewers.map(u => u.id)
    });

    // Mock API
    setTimeout(() => {
      this.updateStatus(row.index, REJECTED, 'danger');
      this.rejectSubmitting = false;
      this.rejectDialogVisible = false;
      this.scanDialogVisible = false;
      this.selectedRow = null;
      this.rejectReason = '';
      this.selectedReviewers = [];
    }, 800);
  }

  closeRejectDialog(): void {
    if (this.rejectSubmitting) return;

    this.rejectDialogVisible = false;
    this.rejectReason = '';
    this.selectedReviewers = [];
  }
}