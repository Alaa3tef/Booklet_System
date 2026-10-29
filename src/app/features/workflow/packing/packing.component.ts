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

interface PackingEnvelope {
  id: number;
  qrCode: string;
  scanned: boolean;
  scannedAt: string | null;
}

interface PackingRow extends WorkflowStatusRow {
  governorate: string;
  qrCode: string;
  envelopes: PackingEnvelope[];
}

interface PackingScanResult {
  qrCode: string;
  subject: string;
  committeeNumber: string | number;
  governorate: string;
  scanType: string;
  scannedAt: string;
}

interface ScanStep {
  id: number;
  kind: 'envelope' | 'outer';
  title: string;
  subtitle: string;
  qrCode: string;
  scanned: boolean;
  scannedAt: string | null;
  data: any | null;
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

  // نفس مصدر الـ options اللي في صفحة الجودة
educationals = [ /* نفس الـ options */ ];

educationFilter = signal<string | number | null>(null);
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
  private createEnvelopes(committeeNumber: string, count: number): PackingEnvelope[] {
    return Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      qrCode: `QR-${committeeNumber}-ENV-${String(index + 1).padStart(2, '0')}`,
      scanned: false,
      scannedAt: null
    }));
  }

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
        envelopes: this.createEnvelopes('101', 12),
        status: DONE,
        statusTone: 'success'
      },
      {
        index: 2,
        subject: availableSubjects[0],
        committeeNumber: '102',
        governorate: availableGovernorates[1 % availableGovernorates.length],
        qrCode: 'QR-PACK-102',
        envelopes: this.createEnvelopes('102', 12),
        status: PENDING,
        statusTone: 'warning'
      },
      {
        index: 3,
        subject: availableSubjects[1 % availableSubjects.length],
        committeeNumber: '103',
        governorate: availableGovernorates[0],
        qrCode: 'QR-PACK-103',
        envelopes: this.createEnvelopes('103', 12),
        status: PENDING,
        statusTone: 'warning'
      },
      {
        index: 4,
        subject: availableSubjects[1 % availableSubjects.length],
        committeeNumber: '104',
        governorate: availableGovernorates[2 % availableGovernorates.length],
        qrCode: 'QR-PACK-104',
        envelopes: this.createEnvelopes('104', 12),
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
      filters.subject || this.educationFilter() ||
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
    this.educationFilter.set(null);
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
  // Scan dialog (envelopes + outer cover, one scanner)
  // =====================================================

  scanDialogVisible = false;
  selectedRow: PackingRow | null = null;

  scanSteps: ScanStep[] = [];
  currentScanIndex = 0;
  scanMessage = '';
  isScanning = false;

  private scanTimers: ReturnType<typeof setTimeout>[] = [];

  openScanDialog(row: PackingRow): void {
    if (!this.isPending(row)) {
      return;
    }

    this.clearScanTimers();

    this.selectedRow = row;
    this.currentScanIndex = 0;
    this.scanMessage = '';
    this.isScanning = false;
    this.scanSteps = this.createScanSteps(row);
    this.scanDialogVisible = true;
  }

  private createScanSteps(row: PackingRow): ScanStep[] {
    const envelopeSteps: ScanStep[] = row.envelopes.map(envelope => ({
      id: envelope.id,
      kind: 'envelope' as const,
      title: `الظرف رقم ${envelope.id}`,
      subtitle: envelope.qrCode,
      qrCode: envelope.qrCode,
      scanned: false,
      scannedAt: null,
      data: null
    }));

    const outerStep: ScanStep = {
      id: envelopeSteps.length + 1,
      kind: 'outer',
      title: 'الغلاف الخارجي',
      subtitle: `${row.qrCode}-OUTER`,
      qrCode: `${row.qrCode}-OUTER`,
      scanned: false,
      scannedAt: null,
      data: null
    };

    return [...envelopeSteps, outerStep];
  }

  get currentStep(): ScanStep | null {
    return this.scanSteps[this.currentScanIndex] ?? null;
  }

  get completedScans(): number {
    return this.scanSteps.filter(step => step.scanned).length;
  }

  get scanProgress(): number {
    return this.scanSteps.length
      ? Math.round((this.completedScans / this.scanSteps.length) * 100)
      : 0;
  }

  get scannedEnvelopeCount(): number {
    return this.scanSteps.filter(step => step.kind === 'envelope' && step.scanned).length;
  }

  get envelopeTotal(): number {
    return this.scanSteps.filter(step => step.kind === 'envelope').length;
  }

  get allScansCompleted(): boolean {
    return this.scanSteps.length > 0 && this.scanSteps.every(step => step.scanned);
  }

  get canConfirmPacking(): boolean {
    return this.allScansCompleted && !this.isScanning;
  }

  isStepLocked(index: number): boolean {
    return !this.scanSteps.slice(0, index).every(step => step.scanned);
  }

  selectScanStep(index: number): void {
    if (
      this.isScanning ||
      index < 0 ||
      index >= this.scanSteps.length ||
      this.isStepLocked(index)
    ) {
      return;
    }

    this.currentScanIndex = index;
    this.scanMessage = '';
  }

  startScan(): void {
    const step = this.currentStep;
    const row = this.selectedRow;

    if (this.isScanning || !step || !row || step.scanned) {
      return;
    }

    this.isScanning = true;
    this.scanMessage = `جاري قراءة QR ${step.title}...`;

    // محاكاة مؤقتة لعملية المسح، إلى حين ربط جهاز القراءة أو الـ API.
    this.scanTimers.push(
      setTimeout(() => {
        if (!this.scanDialogVisible || this.selectedRow !== row) {
          this.isScanning = false;
          return;
        }

        const scannedAt = new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit'
        });

        step.data = {
          qrCode: step.qrCode,
          subject: row.subject,
          committeeNumber: row.committeeNumber,
          governorate: row.governorate,
          scanType: step.kind === 'outer' ? 'الغلاف الخارجي للجنة' : step.title,
          scannedAt
        };

        step.scanned = true;
        step.scannedAt = scannedAt;

        this.isScanning = false;
        this.scanMessage = `تم قراءة ${step.title} بنجاح`;

        // الانتقال تلقائياً للخطوة التالية بعد نجاح القراءة
        const nextIndex = this.scanSteps.findIndex(
          (item, i) => i > this.currentScanIndex && !item.scanned
        );

        if (nextIndex !== -1) {
          this.scanTimers.push(
            setTimeout(() => {
              if (this.scanDialogVisible && this.selectedRow === row) {
                this.currentScanIndex = nextIndex;
                this.scanMessage = '';
              }
            }, 600)
          );
        }
      }, 1200)
    );
  }

  confirmPacking(): void {
    if (!this.selectedRow || !this.canConfirmPacking) {
      return;
    }

    const row = this.selectedRow;

    // استبدلي الجزء ده باستدعاء API تأكيد التغليف عند توفره.
    console.info('Confirm Packing', {
      committeeNumber: row.committeeNumber,
      subject: row.subject,
      scans: this.scanSteps.map(step => ({
        scanType: step.title,
        qrCode: step.qrCode,
        scannedAt: step.scannedAt
      }))
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
    this.clearScanTimers();

    this.selectedRow = null;
    this.scanSteps = [];
    this.currentScanIndex = 0;
    this.scanMessage = '';
    this.isScanning = false;
  }

  private clearScanTimers(): void {
    this.scanTimers.forEach(timer => clearTimeout(timer));
    this.scanTimers = [];
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
    if (!this.selectedRow || !this.canConfirmPacking) {
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
      scans: this.scanSteps.map(step => ({
        scanType: step.title,
        qrCode: step.qrCode
      })),
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