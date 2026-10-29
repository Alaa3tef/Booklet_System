
import { CommonModule } from '@angular/common';
import {
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  OnInit
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { Lookups } from '../../../shared/services/lookups';

const PENDING = 'قيد المراجعة';
const DONE = 'تم المراجعة';
const REJECTED = 'مرفوض';

interface QualityRow extends WorkflowStatusRow {
  committeeNumber: string;
  governorate: string;
  qrCode: string;
  envelopeCount?: number;
}

interface LookupOption {
  label: string;
  value: string;
}

interface ScanResult {
  qrCode: string;
  material: string;
  committeeNumber: string;
  governorate: string;
  envelopeNumber?: number;
  scanType: string;
  scannedAt: string;
}

interface ScanStep {
  id: number;
  type: 'envelope';
  title: string;
  subtitle: string;
  scanned: boolean;
  scanning: boolean;
  qrCode: string;
  data: ScanResult | null;
}

@Component({
  selector: 'app-quality',
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
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss',
  encapsulation: ViewEncapsulation.None
})
export default class QualityComponent implements OnInit {
  private readonly lookups = inject(Lookups);

  // =========================
  // Essentials
  // =========================
 educationals: any[] = [
    { label: 'كل الادارات التعليمية', value: 'all' },
    { label: 'EDU-001', value: 'EDU-001' },
    { label: 'EDU-002', value: 'EDU-002' },
    { label: 'EDU-003', value: 'EDU-003' },
    { label: 'EDU-004', value: 'EDU-004' },
    { label: 'EDU-005', value: 'EDU-005' },
    { label: 'EDU-006', value: 'EDU-006' },
    { label: 'EDU-007', value: 'EDU-007' },
    { label: 'EDU-008', value: 'EDU-008' },
    { label: 'EDU-009', value: 'EDU-009' },
    { label: 'EDU-010', value: 'EDU-010' },
    { label: 'EDU-011', value: 'EDU-011' }
  ];
   readonly searchEducation   = signal('');
   setEducation(v: string): void          { this.searchEducation.set(v ?? ''); this.resetPage(); }
  readonly essentials = [
    'مسح QR الخاص بكل مادة',
    'مسح جميع أظرف اللجنة',
    'مراجعة بيانات الـ QR',
    'تسجيل نتيجة المراجعة'
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

  // =========================
  // Lookup data from API
  // =========================

  readonly governorates = signal<LookupOption[]>([]);
  readonly subjects = signal<LookupOption[]>([]);

  readonly governoratesLoading = signal(false);
  readonly subjectsLoading = signal(false);

  readonly governoratesError = signal(false);
  readonly subjectsError = signal(false);

  ngOnInit(): void {
    this.loadGovernorates();
    this.loadSubjects();
  }

  private resetPage(): void { this.currentPage.set(1); }
  /**
   * تحميل المحافظات من:
   * GET api/Governorates
   */
  loadGovernorates(): void {
  this.governoratesLoading.set(true);
  this.governoratesError.set(false);

  // إفراغ القائمة قبل تحميل البيانات
  this.governorates.set([]);

  this.lookups.getLookupGovernorateData().subscribe({
    next: (response: any) => {
      const options = this.normalizeLookupOptions(response, [
        'governorateName',
        'nameAr',
        'arabicName',
        'governorate',
        'name',
        'title',
        'value'
      ]);

      this.governorates.set(options);
      this.governoratesLoading.set(false);
    },
    error: (error: unknown) => {
      console.error('Error loading governorates:', error);

      this.governorates.set([]);
      this.governoratesError.set(true);
      this.governoratesLoading.set(false);
    }
  });
}

  /**
   * تحميل المواد من:
   * GET api/Subjects
   */
  loadSubjects(): void {
  this.subjectsLoading.set(true);
  this.subjectsError.set(false);

  // إفراغ القائمة قبل تحميل البيانات
  this.subjects.set([]);

  this.lookups.getLookupSubjectData().subscribe({
    next: (response: any) => {
      const options = this.normalizeLookupOptions(response, [
        'subjectName',
        'nameAr',
        'arabicName',
        'subject',
        'name',
        'title',
        'value'
      ]);

      this.subjects.set(options);
      this.subjectsLoading.set(false);
    },
    error: (error: unknown) => {
      console.error('Error loading subjects:', error);

      this.subjects.set([]);
      this.subjectsError.set(true);
      this.subjectsLoading.set(false);
    }
  });
}

  /**
   * تحويل استجابة الـ API إلى:
   * [{ label: 'القاهرة', value: 'القاهرة' }]
   *
   * يدعم استجابة عبارة عن Array مباشرة أو داخل data/items/result.
   */
  private normalizeLookupOptions(
    response: any,
    nameKeys: string[]
  ): LookupOption[] {
    const items = this.extractLookupArray(response);

    const options = items
      .map((item: any): LookupOption | null => {
        if (typeof item === 'string' || typeof item === 'number') {
          const name = String(item).trim();

          return name
            ? { label: name, value: name }
            : null;
        }

        if (!item || typeof item !== 'object') {
          return null;
        }

        let name: string | null = null;

        for (const key of nameKeys) {
          const candidate = item[key];

          if (
            candidate !== null &&
            candidate !== undefined &&
            String(candidate).trim() !== ''
          ) {
            name = String(candidate).trim();
            break;
          }
        }

        if (!name) {
          return null;
        }

        return {
          label: name,
          value: name
        };
      })
      .filter((option): option is LookupOption => option !== null);

    // إزالة الأسماء المكررة
    return [
      ...new Map(
        options.map(option => [option.value, option])
      ).values()
    ];
  }

  /**
   * استخراج القائمة من أشكال الـ response الشائعة.
   */
  private extractLookupArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const possibleKeys = [
      'data',
      'items',
      'result',
      'results',
      'records'
    ];

    for (const key of possibleKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value;
      }

      if (value && typeof value === 'object') {
        const nested = this.extractLookupArray(value);

        if (nested.length > 0) {
          return nested;
        }
      }
    }

    return [];
  }

  // =========================
  // Committee rows
  // =========================

  readonly rows = signal<QualityRow[]>([
    {
      index: 1,
      subject: 'اللغة العربية',
      committeeNumber: '101',
      governorate: 'القاهرة',
      qrCode: 'QR-COMMITTEE-101',
      envelopeCount: 8,
      status: PENDING,
      statusTone: 'info'
    },
    {
      index: 2,
      subject: 'الرياضيات',
      committeeNumber: '102',
      governorate: 'الجيزة',
      qrCode: 'QR-COMMITTEE-102',
      envelopeCount: 8,
      status: PENDING,
      statusTone: 'info'
    },
    {
      index: 3,
      subject: 'اللغة الإنجليزية',
      committeeNumber: '103',
      governorate: 'القاهرة',
      qrCode: 'QR-COMMITTEE-103',
      envelopeCount: 8,
      status: DONE,
      statusTone: 'success'
    }
  ]);

  // =========================
  // Filters
  // =========================

  readonly subjectFilter = signal<string | null>(null);
  readonly governorateFilter = signal<string | null>(null);
   readonly educationFilter = signal<string | null>(null);
  readonly committeeFilter = signal('');
  readonly statusFilter = signal<string | null>(null);

  private readonly appliedFilters = signal({
    subject: null as string | null,
    governorate: null as string | null,
    education: null as string | null,
    committee: ''
  });

  /**
   * خيارات المواد والمحافظات تأتي من الـ API.
   * في حالة فشل تحميل القوائم نستخدم القيم الموجودة بالصفوف
   * حتى لا تصبح الفلاتر فارغة تماماً.
   */
  readonly subjectOptions = computed<LookupOption[]>(() =>
  this.subjects()
);

readonly governorateOptions = computed<LookupOption[]>(() =>
  this.governorates()
);

  private readonly searchedRows = computed(() => {
    const { subject, governorate, committee } =
      this.appliedFilters();

    const term = committee.trim();

    return this.rows().filter(row =>
      (!subject || row.subject === subject) &&
      (!governorate || row.governorate === governorate) &&
      (!term || row.committeeNumber.includes(term))
    );
  });

  readonly filteredRows = computed(() => {
    const status = this.statusFilter();

    return status
      ? this.searchedRows().filter(row => row.status === status)
      : this.searchedRows();
  });

  readonly statusTabs = computed(() => {
    const rows = this.searchedRows();

    const count = (status: string) =>
      rows.filter(row => row.status === status).length;

    return [
      {
        key: null as string | null,
        label: 'الكل',
        icon: 'pi-th-large',
        tone: 'neutral',
        count: rows.length
      },
      {
        key: PENDING,
        label: 'قيد المراجعة',
        icon: 'pi-clock',
        tone: 'info',
        count: count(PENDING)
      },
      {
        key: DONE,
        label: 'تمت المراجعة',
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

  applyFilters(): void {
    this.appliedFilters.set({
      subject: this.subjectFilter(),
      governorate: this.governorateFilter(),
      committee: this.committeeFilter(),
      education : this.educationFilter()
    });

    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.subjectFilter.set(null);
    this.governorateFilter.set(null);
    this.committeeFilter.set('');
    this.educationFilter.set(null)
    this.applyFilters();
  }

  setStatus(status: string | null): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  private optionsOf(
    pick: (row: QualityRow) => string
  ): LookupOption[] {
    return [
      ...new Set(this.rows().map(pick).filter(Boolean))
    ].map(value => ({
      label: value,
      value
    }));
  }

  // =========================
  // Pagination
  // =========================

  readonly pageSize = signal(6);
  readonly currentPage = signal(1);

  readonly totalPages = computed(() =>
    Math.max(
      1,
      Math.ceil(this.filteredRows().length / this.pageSize())
    )
  );

  readonly paginatedRows = computed(() => {
    const start =
      (this.currentPage() - 1) * this.pageSize();

    return this.filteredRows().slice(
      start,
      start + this.pageSize()
    );
  });

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 4) {
      return Array.from({ length: total }, (_, i) => i + 1);
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
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  // =========================
  // Card helpers
  // =========================

  statusIcon(row: QualityRow): string {
    return row.status === DONE
      ? 'pi-check-circle'
      : row.status === REJECTED
        ? 'pi-times-circle'
        : 'pi-clock';
  }

  isPending(row: QualityRow): boolean {
    return row.status === PENDING;
  }

  isDone(row: QualityRow): boolean {
    return row.status === DONE;
  }

  isRejected(row: QualityRow): boolean {
    return row.status === REJECTED;
  }

  // =========================
  // Scan dialog
  // =========================

  selectedRow: QualityRow | null = null;
  scanDialogVisible = false;
  scanSteps: ScanStep[] = [];
  currentScanIndex = 0;
  scanMessage = '';
  isScanning = false;

  openScanDialog(row: QualityRow): void {
    if (!this.isPending(row)) {
      return;
    }

    this.selectedRow = row;
    this.currentScanIndex = 0;
    this.scanMessage = '';
    this.isScanning = false;
    this.scanSteps = this.createScanSteps();
    this.scanDialogVisible = true;
  }

  private createScanSteps(): ScanStep[] {
    const envelopeCount = Math.max(
      1,
      Math.floor(this.selectedRow?.envelopeCount ?? 8)
    );

    return Array.from({ length: envelopeCount }, (_, index) => ({
      id: index + 1,
      type: 'envelope' as const,
      title: `الظرف ${index + 1}`,
      subtitle: `QR الخاص بالظرف رقم ${index + 1}`,
      scanned: false,
      scanning: false,
      qrCode: '',
      data: null
    }));
  }

  get currentStep(): ScanStep | null {
    return this.scanSteps[this.currentScanIndex] ?? null;
  }

  startScan(): void {
    if (
      this.isScanning ||
      !this.currentStep ||
      !this.selectedRow
    ) {
      return;
    }

    const step = this.currentStep;

    this.isScanning = true;
    step.scanning = true;
    this.scanMessage = 'جاري قراءة بيانات الـ QR...';

    // محاكاة مؤقتة لعملية المسح، إلى حين ربط الـ API الفعلي.
    setTimeout(() => {
      const row = this.selectedRow;

      if (!row) {
        this.isScanning = false;
        step.scanning = false;
        return;
      }

      const qrCode = `${row.qrCode}-ENV-${step.id}`;

      step.data = {
        qrCode,
        material: row.subject,
        committeeNumber: row.committeeNumber,
        governorate: row.governorate,
        envelopeNumber: step.id,
        scanType: `الظرف ${step.id}`,
        scannedAt: new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      step.qrCode = qrCode;
      step.scanned = true;
      step.scanning = false;

      this.isScanning = false;
      this.scanMessage = `تم قراءة ${step.title} بنجاح`;

      if (this.currentScanIndex < this.scanSteps.length - 1) {
        setTimeout(() => {
          if (this.scanDialogVisible) {
            this.currentScanIndex++;
          }
        }, 600);
      }
    }, 1400);
  }

  selectScanStep(index: number): void {
    if (
      index >= 0 &&
      index < this.scanSteps.length &&
      this.scanSteps.slice(0, index).every(step => step.scanned)
    ) {
      this.currentScanIndex = index;
    }
  }

  nextScan(): void {
    if (this.currentScanIndex < this.scanSteps.length - 1) {
      this.currentScanIndex++;
      this.scanMessage = '';
    }
  }

  previousScan(): void {
    if (this.currentScanIndex > 0) {
      this.currentScanIndex--;
      this.scanMessage = '';
    }
  }

  get allScansCompleted(): boolean {
    return (
      this.scanSteps.length > 0 &&
      this.scanSteps.every(step => step.scanned)
    );
  }

  get completedScans(): number {
    return this.scanSteps.filter(step => step.scanned).length;
  }

  get scanProgress(): number {
    return this.scanSteps.length
      ? Math.round(
          (this.completedScans / this.scanSteps.length) * 100
        )
      : 0;
  }

  approveMaterial(): void {
    if (!this.selectedRow || !this.allScansCompleted) {
      return;
    }

    this.updateStatus(this.selectedRow.index, DONE, 'success');
    this.scanDialogVisible = false;
  }

  closeScanDialog(): void {
    if (this.isScanning) {
      return;
    }

    this.scanDialogVisible = false;
    this.selectedRow = null;
    this.scanSteps = [];
    this.currentScanIndex = 0;
    this.scanMessage = '';
  }

  private updateStatus(
    index: number,
    status: string,
    statusTone: QualityRow['statusTone']
  ): void {
    this.rows.update(rows =>
      rows.map(row =>
        row.index === index
          ? { ...row, status, statusTone }
          : row
      )
    );
  }

  // =========================
  // Reject dialog
  // =========================

  rejectDialogVisible = false;
  rejectReason = '';
  selectedReviewers: { id: number; name: string; role: string }[] = [];
  rejectSubmitting = false;

  openRejectDialog(): void {
    if (!this.selectedRow || !this.allScansCompleted) {
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
    if (!this.selectedRow || !this.isRejectFormValid) {
      return;
    }

    this.rejectSubmitting = true;

    const row = this.selectedRow;

    console.log('QUALITY REJECTION REQUEST', {
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

    // محاكاة مؤقتة لعملية الرفض، إلى حين ربط الـ API الفعلي.
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
    if (this.rejectSubmitting) {
      return;
    }

    this.rejectDialogVisible = false;
    this.rejectReason = '';
    this.selectedReviewers = [];
  }

  // =========================
  // Rejection reason
  // =========================

  rejectionReasonDialogVisible = false;
  selectedRejectionReason = '';

  openRejectionReasonDialog(row: WorkflowStatusRow): void {
    if (row.status !== REJECTED) {
      return;
    }

    this.selectedRow = row as QualityRow;

    this.selectedRejectionReason =
      row.rejectionReason?.trim() ||
      'لم يتم تسجيل سبب الرفض.';

    this.rejectionReasonDialogVisible = true;
  }

  closeRejectionReasonDialog(): void {
    this.rejectionReasonDialogVisible = false;
    this.selectedRejectionReason = '';
    this.selectedRow = null;
  }
}