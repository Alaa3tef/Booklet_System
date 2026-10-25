
import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  ViewEncapsulation,
  WritableSignal,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, Observable, of } from 'rxjs';

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
  committeeNumber: string | number;
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
  encapsulation: ViewEncapsulation.None
})
export default class PackingComponent implements OnInit {
  private readonly lookups = inject(Lookups);
  private readonly destroyRef = inject(DestroyRef);

  readonly PENDING = PENDING;
  readonly DONE = DONE;
  readonly REJECTED = REJECTED;

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
    { label: '6', value: 6 },
    { label: '12', value: 12 },
    { label: '24', value: 24 }
  ];

  // =====================================================
  // Lookup data
  // =====================================================

  readonly subjectOptions = signal<Option[]>([]);
  readonly governorateOptions = signal<Option[]>([]);

  readonly subjectsLoading = signal(false);
  readonly governoratesLoading = signal(false);

  readonly subjectsError = signal(false);
  readonly governoratesError = signal(false);

  // =====================================================
  // Committee data
  // =====================================================

  readonly rows = signal<PackingRow[]>([]);

  private readonly fallbackSubjects = [
    'اللغة العربية',
    'الرياضيات',
    'العلوم',
    'اللغة الإنجليزية'
  ];

  private readonly fallbackGovernorates = [
    'القاهرة',
    'الجيزة',
    'المنوفية',
    'الإسكندرية'
  ];

  ngOnInit(): void {
    this.loadSubjects();
    this.loadGovernorates();
  }

  loadSubjects(): void {
    this.loadLookup(
      this.lookups.getLookupSubjectData(),
      ['name', 'subjectName', 'subject', 'subjectTitle', 'title', 'arabicName'],
      ['id', 'subjectId', 'subjectID', 'value'],
      this.subjectOptions,
      this.subjectsLoading,
      this.subjectsError
    );
  }

  loadGovernorates(): void {
    this.loadLookup(
      this.lookups.getLookupGovernorateData(),
      ['name', 'governorateName', 'governorate', 'title', 'arabicName'],
      ['id', 'governorateId', 'governorateID', 'value'],
      this.governorateOptions,
      this.governoratesLoading,
      this.governoratesError
    );
  }

  private loadLookup(
    request$: Observable<unknown>,
    nameKeys: string[],
    idKeys: string[],
    target: WritableSignal<Option[]>,
    loading: WritableSignal<boolean>,
    hasError: WritableSignal<boolean>
  ): void {
    loading.set(true);
    hasError.set(false);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading packing lookup:', error);
          hasError.set(true);
          target.set([]);
          return of(null);
        }),
        finalize(() => {
          loading.set(false);
          this.rebuildRowsFromLookups();
        })
      )
      .subscribe(response => {
        if (response === null) {
          return;
        }

        const options = this.extractItems(response)
          .map(item => {
            if (typeof item === 'string' || typeof item === 'number') {
              const label = String(item).trim();
              return label ? { label, value: label } : null;
            }

            if (!item || typeof item !== 'object') {
              return null;
            }

            const rawName = nameKeys
              .map(key => item[key])
              .find(value => value !== null && value !== undefined && String(value).trim() !== '');

            if (rawName === undefined) {
              return null;
            }

            const label = String(rawName).trim();

            const rawId = idKeys
              .map(key => item[key])
              .find(value => value !== null && value !== undefined && String(value).trim() !== '');

            // نخلي القيمة string لتوافق Option.value
            const value = rawId !== undefined ? String(rawId) : label;

            return label ? { label, value } : null;
          })
          .filter((option): option is Option => option !== null);

        // منع تكرار نفس الاختيار
        const uniqueOptions = Array.from(
          new Map(options.map(option => [option.value, option])).values()
        );

        target.set(uniqueOptions);
      });
  }

  /**
   * يدعم الاستجابات الشائعة مثل:
   * [...]
   * { data: [...] }
   * { data: { data: [...] } }
   * { result: [...] }
   * { items: [...] }
   */
  private extractItems(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    const possibleArrays = [
      response?.data,
      response?.data?.data,
      response?.data?.items,
      response?.data?.results,
      response?.result,
      response?.result?.data,
      response?.result?.items,
      response?.items,
      response?.results,
      response?.records
    ];

    return possibleArrays.find(Array.isArray) ?? [];
  }

  /**
   * بيانات اللجان هنا تجريبية.
   * أسماء المواد والمحافظات تُؤخذ من الـ API بعد تحميل القوائم.
   * عند توفر API اللجان، يمكن استبدال هذه الدالة ببيانات الباك إند.
   */
  private rebuildRowsFromLookups(): void {
    if (this.subjectsLoading() || this.governoratesLoading()) {
      return;
    }

    const subjects = this.subjectOptions().map(option => option.label);
    const governorates = this.governorateOptions().map(option => option.label);

    const availableSubjects = subjects.length ? subjects : this.fallbackSubjects;
    const availableGovernorates = governorates.length
      ? governorates
      : this.fallbackGovernorates;

    const mockRows: PackingRow[] = [
      {
        index: 1,
        subject: availableSubjects[0],
        committeeNumber: '101',
        governorate: availableGovernorates[0],
        qrCode: 'QR-PACK-101',
        status: DONE,
        statusTone: 'success'
      },
      {
        index: 2,
        subject: availableSubjects[0],
        committeeNumber: '102',
        governorate: availableGovernorates[1 % availableGovernorates.length],
        qrCode: 'QR-PACK-102',
        status: PENDING,
        statusTone: 'warning'
      },
      {
        index: 3,
        subject: availableSubjects[1 % availableSubjects.length],
        committeeNumber: '103',
        governorate: availableGovernorates[0],
        qrCode: 'QR-PACK-103',
        status: PENDING,
        statusTone: 'warning'
      },
      {
        index: 4,
        subject: availableSubjects[1 % availableSubjects.length],
        committeeNumber: '104',
        governorate: availableGovernorates[2 % availableGovernorates.length],
        qrCode: 'QR-PACK-104',
        status: PENDING,
        statusTone: 'warning'
      }
    ];

    this.rows.set(mockRows);
    this.currentPage.set(1);
    this.applyFilters();
  }

  // =====================================================
  // Filters
  // =====================================================

  readonly subjectFilter = signal<string | null>(null);
  readonly governorateFilter = signal<string | null>(null);
  readonly committeeFilter = signal('');
  readonly statusFilter = signal<string | null>(null);

  private readonly appliedFilters = signal({
    subject: null as string | null,
    governorate: null as string | null,
    committee: ''
  });

  private readonly searchedRows = computed(() => {
    const { subject, governorate, committee } = this.appliedFilters();
    const term = committee.trim();

    return this.rows().filter(row =>
      (!subject || row.subject === this.getOptionLabel(this.subjectOptions(), subject)) &&
      (
        !governorate ||
        row.governorate === this.getOptionLabel(this.governorateOptions(), governorate)
      ) &&
      (!term || String(row.committeeNumber ?? '').includes(term))
    );
  });

  readonly filteredRows = computed(() => {
    const status = this.statusFilter();

    return status
      ? this.searchedRows().filter(row => row.status === status)
      : this.searchedRows();
  });

  readonly statusTabs = computed(() => {
    const filtered = this.searchedRows();
    const count = (status: string) =>
      filtered.filter(row => row.status === status).length;

    return [
      {
        key: null as string | null,
        label: 'الكل',
        icon: 'pi-th-large',
        tone: 'neutral',
        count: filtered.length
      },
      {
        key: PENDING,
        label: PENDING,
        icon: 'pi-clock',
        tone: 'warning',
        count: count(PENDING)
      },
      {
        key: DONE,
        label: DONE,
        icon: 'pi-check-circle',
        tone: 'success',
        count: count(DONE)
      },
      {
        key: REJECTED,
        label: 'مرفوضة',
        icon: 'pi-times-circle',
        tone: 'danger',
        count: count(REJECTED)
      }
    ];
  });

  readonly hasActiveFilters = computed(() => {
    const filters = this.appliedFilters();

    return !!(
      filters.subject ||
      filters.governorate ||
      filters.committee.trim()
    );
  });

  private getOptionLabel(options: Option[], value: string): string {
    return options.find(option => option.value === value)?.label ?? value;
  }

  applyFilters(): void {
    this.appliedFilters.set({
      subject: this.subjectFilter(),
      governorate: this.governorateFilter(),
      committee: this.committeeFilter().trim()
    });

    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.subjectFilter.set(null);
    this.governorateFilter.set(null);
    this.committeeFilter.set('');
    this.statusFilter.set(null);
    this.applyFilters();
  }

  setStatus(status: string | null): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  // =====================================================
  // Pagination
  // =====================================================

  readonly pageSize = signal(6);
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
    const current = this.currentPage();

    if (total <= 4) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    if (current <= 2) {
      return [1, 2, 3, 'dots', total];
    }

    if (current >= total - 1) {
      return [1, 'dots', total - 2, total - 1, total];
    }

    return [1, 'dots', current, 'dots', total];
  });

  readonly paginationStart = computed(() =>
    this.filteredRows().length
      ? (this.currentPage() - 1) * this.pageSize() + 1
      : 0
  );

  readonly paginationEnd = computed(() =>
    Math.min(
      this.currentPage() * this.pageSize(),
      this.filteredRows().length
    )
  );

  goToPage(page: number): void {
    if (
      page < 1 ||
      page > this.totalPages() ||
      page === this.currentPage()
    ) {
      return;
    }

    this.currentPage.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  // =====================================================
  // Card helpers
  // =====================================================

  statusIcon(row: PackingRow): string {
    if (row.status === DONE) {
      return 'pi-check-circle';
    }

    if (row.status === REJECTED) {
      return 'pi-times-circle';
    }

    return 'pi-clock';
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
  scanResult: any | null = null;

  openScanDialog(row: PackingRow): void {
    if (!this.isPending(row)) {
      return;
    }
    console.log("edit")
    this.selectedRow = row;
    this.isScanning = false;
    this.scanCompleted = false;
    this.scanMessage = '';
    this.scanResult = null;
    this.scanDialogVisible = true;
  }

  startScan(): void {
    if (this.isScanning || this.scanCompleted || !this.selectedRow) {
      return;
    }

    this.isScanning = true;
    this.scanMessage = 'جاري قراءة QR الغلاف الخارجي...';

    // محاكاة مؤقتة لعملية الـ Scan إلى حين ربط الـ API.
    setTimeout(() => {
      if (!this.selectedRow || !this.scanDialogVisible) {
        this.isScanning = false;
        return;
      }

      const row = this.selectedRow;

      this.scanResult = {
        qrCode: `${row.qrCode}-OUTER`,
        subject: row.subject,
        committeeNumber: row.committeeNumber,
        governorate: row.governorate,
        scanType: 'الغلاف الخارجي للجنة',
        scannedAt: new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      this.isScanning = false;
      this.scanCompleted = true;
      this.scanMessage = 'تمت قراءة QR الغلاف الخارجي بنجاح.';
    }, 1400);
  }

  confirmPacking(): void {
    if (!this.selectedRow || !this.scanCompleted) {
      return;
    }

    const row = this.selectedRow;

    // استبدلي الجزء ده باستدعاء API تأكيد التغليف عند توفره.
    console.info('Confirm Packing', {
      committeeNumber: row.committeeNumber,
      subject: row.subject,
      scan: this.scanResult
    });

    this.updateStatus(row.index, DONE, 'success');
    this.scanDialogVisible = false;
    this.resetScanState();
  }

  closeScanDialog(): void {
    if (this.isScanning) {
      return;
    }

    this.scanDialogVisible = false;
    this.resetScanState();
  }

  private resetScanState(): void {
    this.selectedRow = null;
    this.scanResult = null;
    this.scanCompleted = false;
    this.scanMessage = '';
    this.isScanning = false;
  }

  private updateStatus(
    index: number,
    status: string,
    statusTone: PackingRow['statusTone']
  ): void {
    this.rows.update(rows =>
      rows.map(row =>
        row.index === index
          ? { ...row, status, statusTone }
          : row
      )
    );
  }

  // =====================================================
  // Reject dialog
  // =====================================================

  rejectDialogVisible = false;
  rejectReason = '';
  selectedReviewers: Array<{ id: number; name: string; role: string }> = [];
  rejectSubmitting = false;

  openRejectDialog(): void {
    if (!this.selectedRow || !this.scanCompleted) {
      return;
    }

    this.rejectReason = '';
    this.selectedReviewers = [];
    this.rejectDialogVisible = true;
  }

  get isRejectFormValid(): boolean {
    return (
      this.rejectReason.trim().length >= 10 &&
      this.selectedReviewers.length > 0
    );
  }

  submitRejection(): void {
    if (
      !this.selectedRow ||
      !this.isRejectFormValid ||
      this.rejectSubmitting
    ) {
      return;
    }

    this.rejectSubmitting = true;

    const row = this.selectedRow;

    console.info('Packing Rejection', {
      rowIndex: row.index,
      subject: row.subject,
      committeeNumber: row.committeeNumber,
      governorate: row.governorate,
      scan: this.scanResult,
      reason: this.rejectReason.trim(),
      reviewerIds: this.selectedReviewers.map(user => user.id)
    });

    // محاكاة مؤقتة للحفظ إلى حين ربط الـ API.
    setTimeout(() => {
      this.updateStatus(row.index, REJECTED, 'danger');

      this.rejectSubmitting = false;
      this.rejectDialogVisible = false;
      this.scanDialogVisible = false;

      this.rejectReason = '';
      this.selectedReviewers = [];

      this.resetScanState();
    }, 800);
  }

  closeRejectDialog(): void {
    if (this.rejectSubmitting) {
      return;
    }

    this.rejectDialogVisible = false;
    this.rejectReason = '';
    this.selectedReviewers = [];
  }
}
