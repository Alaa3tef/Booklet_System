import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';

interface QualityRow extends WorkflowStatusRow {
  committeeNumber: string;
  governorate: string;
  qrCode: string;
}

interface ScanStep {
  id: number;
  type: 'envelope' | 'cover';
  title: string;
  subtitle: string;

  scanned: boolean;
  scanning: boolean;

  qrCode: string;
  data: ScanResult | null;
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

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    ButtonModule,
    DialogModule,
    MultiSelectModule,
    TableModule,
    TextareaModule,
    TooltipModule,
    WorkflowStepLayoutComponent
  ],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss'
})
export default class QualityComponent {
  // ==========================================
// PAGINATION
// ==========================================

readonly pageSize = signal(5);

readonly currentPage = signal(1);

readonly totalPages = computed(() => {
  return Math.max(
    1,
    Math.ceil(
      this.filteredRows().length / this.pageSize()
    )
  );
});

readonly paginatedRows = computed(() => {

  const page = this.currentPage();
  const size = this.pageSize();

  const start = (page - 1) * size;
  const end = start + size;

  return this.filteredRows().slice(start, end);
});

readonly paginationPages = computed(() => {

  const total = this.totalPages();
  const current = this.currentPage();

  // 4 صفحات أو أقل
  if (total <= 4) {
    return Array.from(
      { length: total },
      (_, index) => index + 1
    );
  }

  // أول الصفحات
  if (current <= 2) {
    return [1, 2, 3, 'dots', total];
  }

  // آخر الصفحات
  if (current >= total - 1) {
    return [
      1,
      'dots',
      total - 2,
      total - 1,
      total
    ];
  }

  // الصفحات الوسط
  return [
    1,
    'dots',
    current,
    'dots',
    total
  ];
});

readonly paginationStart = computed(() => {

  if (this.filteredRows().length === 0) {
    return 0;
  }

  return (
    (this.currentPage() - 1) *
      this.pageSize() +
    1
  );
});

readonly paginationEnd = computed(() => {

  return Math.min(
    this.currentPage() * this.pageSize(),
    this.filteredRows().length
  );
});


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


previousPage(): void {
  this.goToPage(this.currentPage() - 1);
}


nextPage(): void {
  this.goToPage(this.currentPage() + 1);
}


onPageSizeChange(): void {
  this.currentPage.set(1);
}
   rejectionReasonDialogVisible = false;
    selectedRejectionReason = '';
    selectedRow: any | null = null;
  readonly essentials = [
    'مسح QR الخاص بكل مادة',
    'مسح جميع أظرف اللجنة',
    'مسح الغلاف النهائي',
    'مراجعة بيانات الـ QR',
    'تسجيل نتيجة المراجعة'
  ];

  // =========================
  // Main table
  // =========================

  readonly rows = signal<QualityRow[]>([
    {
      index: 1,
      subject: 'اللغة العربية',
      committeeNumber: '101',
      governorate: 'القاهرة',
      qrCode: 'QR-COMMITTEE-101',
      status: 'قيد المراجعة',
      statusTone: 'info'
    },
    {
      index: 2,
      subject: 'الرياضيات',
      committeeNumber: '102',
      governorate: 'الجيزة',
      qrCode: 'QR-COMMITTEE-102',
      status: 'قيد المراجعة',
      statusTone: 'info'
    },
    {
      index: 3,
      subject: 'اللغة الإنجليزية',
      committeeNumber: '103',
      governorate: 'القاهرة',
      qrCode: 'QR-COMMITTEE-103',
      status: 'تم المراجعة',
      statusTone: 'success'
    }
  ]);

  // ==========================================
  // SEARCH FILTERS
  // ==========================================

  // القيم اللي المستخدم بيكتبها/بيختارها (لسه مطبقتش)
  readonly subjectFilter = signal<string | null>(null);
  readonly governorateFilter = signal<string | null>(null);
  readonly committeeFilter = signal('');

  // القيم المطبقة فعليًا بعد الضغط على "بحث"
  private readonly appliedFilters = signal({
    subject: null as string | null,
    governorate: null as string | null,
    committee: ''
  });

  // خيارات الـ dropdown بتتولد تلقائيًا من البيانات
  readonly subjectOptions = computed(() =>
    [...new Set(this.rows().map(r => r.subject))]
      .map(value => ({ label: value, value }))
  );

  readonly governorateOptions = computed(() =>
    [...new Set(this.rows().map(r => r.governorate))]
      .map(value => ({ label: value, value }))
  );

  readonly filteredRows = computed(() => {
    const { subject, governorate, committee } = this.appliedFilters();
    const committeeTerm = committee.trim();

    return this.rows().filter(row =>
      (!subject || row.subject === subject) &&
      (!governorate || row.governorate === governorate) &&
      (!committeeTerm || row.committeeNumber.includes(committeeTerm))
    );
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

    this.appliedFilters.set({
      subject: null,
      governorate: null,
      committee: ''
    });

    this.currentPage.set(1);
  }
  // =========================
  // Scan Dialog
  // =========================

  scanDialogVisible = false;

  scanSteps: ScanStep[] = [];

  currentScanIndex = 0;

  scanMessage = '';

  isScanning = false;


  // =========================
  // Reject Dialog
  // =========================

  rejectDialogVisible = false;

  rejectReason = '';

  selectedReviewers: any[] = [];

  rejectSubmitting = false;


  readonly reviewUsers = [
    {
      id: 1,
      name: 'أحمد محمد',
      role: 'مراجع أول'
    },
    {
      id: 2,
      name: 'محمد علي',
      role: 'مراجع جودة'
    },
    {
      id: 3,
      name: 'سارة أحمد',
      role: 'مراجع محتوى'
    },
    {
      id: 4,
      name: 'محمود حسن',
      role: 'مراجع نهائي'
    }
  ];


  // =========================
  // Open scan
  // =========================

  openScanDialog(row: QualityRow): void {

    if (row.status === 'تم المراجعة' || row.status === 'مرفوض') {
      return;
    }

    this.selectedRow = row;

    this.currentScanIndex = 0;

    this.scanMessage = '';

    this.isScanning = false;

    this.scanSteps = this.createScanSteps();

    this.scanDialogVisible = true;
  }


  // =========================
  // Create scan stages
  // =========================

  private createScanSteps(): ScanStep[] {

    return [
      {
        id: 1,
        type: 'envelope',
        title: 'الظرف الأول',
        subtitle: 'QR الخاص بالظرف الأول',
        scanned: false,
        scanning: false,
        qrCode: '',
        data: null
      },
      {
        id: 2,
        type: 'envelope',
        title: 'الظرف الثاني',
        subtitle: 'QR الخاص بالظرف الثاني',
        scanned: false,
        scanning: false,
        qrCode: '',
        data: null
      },
      {
        id: 3,
        type: 'envelope',
        title: 'الظرف الثالث',
        subtitle: 'QR الخاص بالظرف الثالث',
        scanned: false,
        scanning: false,
        qrCode: '',
        data: null
      },
      {
        id: 4,
        type: 'cover',
        title: 'الغلاف النهائي',
        subtitle: 'QR الخاص بالغلاف الداخلي',
        scanned: false,
        scanning: false,
        qrCode: '',
        data: null
      }
    ];
  }


  // =========================
  // Current step
  // =========================

  get currentStep(): ScanStep | null {

    return this.scanSteps[this.currentScanIndex] ?? null;
  }


  // =========================
  // Scan
  // =========================

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


    // Mock scanner
    setTimeout(() => {

      const row = this.selectedRow!;

      const envelopeNumber =
        step.type === 'envelope'
          ? step.id
          : undefined;

      const qrCode =
        step.type === 'cover'
          ? `${row.qrCode}-COVER`
          : `${row.qrCode}-ENV-${step.id}`;


      const result: ScanResult = {
        qrCode,

        material: row.subject,

        committeeNumber: row.committeeNumber,

        governorate: row.governorate,

        envelopeNumber,

        scanType:
          step.type === 'cover'
            ? 'الغلاف النهائي'
            : `الظرف ${step.id}`,

        scannedAt: new Date().toLocaleTimeString(
          'ar-EG',
          {
            hour: '2-digit',
            minute: '2-digit'
          }
        )
      };


      step.scanned = true;

      step.scanning = false;

      step.qrCode = qrCode;

      step.data = result;

      this.isScanning = false;

      this.scanMessage =
        `تم قراءة ${step.title} بنجاح`;


      // Move automatically to next scan
      if (this.currentScanIndex < this.scanSteps.length - 1) {

        setTimeout(() => {

          this.currentScanIndex++;

        }, 600);
      }

    }, 1400);
  }


  // =========================
  // Select scan step
  // =========================

  selectScanStep(index: number): void {

    // لا تسمح بالدخول لمرحلة لم يصل إليها المستخدم
    const previousStepsCompleted =
      this.scanSteps
        .slice(0, index)
        .every(step => step.scanned);

    if (!previousStepsCompleted) {
      return;
    }

    this.currentScanIndex = index;
  }


  // =========================
  // Next scan
  // =========================

  nextScan(): void {

    if (
      this.currentScanIndex <
      this.scanSteps.length - 1
    ) {

      this.currentScanIndex++;

      this.scanMessage = '';
    }
  }


  // =========================
  // Previous scan
  // =========================

  previousScan(): void {

    if (this.currentScanIndex > 0) {

      this.currentScanIndex--;

      this.scanMessage = '';
    }
  }


  // =========================
  // All scans completed
  // =========================

  get allScansCompleted(): boolean {

    return (
      this.scanSteps.length > 0 &&
      this.scanSteps.every(step => step.scanned)
    );
  }


  // =========================
  // Progress
  // =========================

  get completedScans(): number {

    return this.scanSteps.filter(
      step => step.scanned
    ).length;
  }


  get scanProgress(): number {

    if (!this.scanSteps.length) {
      return 0;
    }

    return Math.round(
      (this.completedScans /
        this.scanSteps.length) *
      100
    );
  }


  // =========================
  // Finish review
  // =========================

  approveMaterial(): void {

    if (
      !this.selectedRow ||
      !this.allScansCompleted
    ) {
      return;
    }

    const row = this.selectedRow;

    this.rows.update(rows =>
      rows.map(item =>
        item.index === row.index
          ? {
              ...item,
              status: 'تم المراجعة',
              statusTone: 'success'
            }
          : item
      )
    );


    this.scanMessage =
      `تمت مراجعة مادة ${row.subject} بنجاح`;


    this.scanDialogVisible = false;
  }


  // =========================
  // Open rejection
  // =========================

  openRejectDialog(): void {

    if (
      !this.selectedRow ||
      !this.allScansCompleted
    ) {
      return;
    }

    this.rejectReason = '';

    this.selectedReviewers = [];

    this.rejectDialogVisible = true;
  }


  // =========================
  // Reject validation
  // =========================

  get isRejectFormValid(): boolean {

    return (
      this.rejectReason.trim().length >= 10 &&
      this.selectedReviewers.length > 0
    );
  }


  // =========================
  // Submit rejection
  // =========================

  submitRejection(): void {

    if (
      !this.selectedRow ||
      !this.isRejectFormValid
    ) {
      return;
    }

    this.rejectSubmitting = true;

    const row = this.selectedRow;


    const rejectionData = {

      rowIndex: row.index,

      subject: row.subject,

      committeeNumber:
        row.committeeNumber,

      governorate:
        row.governorate,

      scans: this.scanSteps.map(step => ({
        scanType: step.title,
        qrCode: step.qrCode
      })),

      reason:
        this.rejectReason.trim(),

      reviewerIds:
        this.selectedReviewers.map(
          user => user.id
        )
    };


    console.log(
      'QUALITY REJECTION REQUEST',
      rejectionData
    );


    // Mock API
    setTimeout(() => {

      this.rows.update(rows =>
        rows.map(item =>
          item.index === row.index
            ? {
                ...item,
                status: 'مرفوض',
                statusTone: 'danger'
              }
            : item
        )
      );


      this.rejectSubmitting = false;

      this.rejectDialogVisible = false;

      this.scanDialogVisible = false;

      this.scanMessage =
        `تم رفض مادة ${row.subject} وإرسالها للمراجعة`;


      this.selectedRow = null;

      this.rejectReason = '';

      this.selectedReviewers = [];

    }, 800);
  }


  // =========================
  // Close scan dialog
  // =========================

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


  // =========================
  // Close reject dialog
  // =========================

  closeRejectDialog(): void {

    if (this.rejectSubmitting) {
      return;
    }

    this.rejectDialogVisible = false;

    this.rejectReason = '';

    this.selectedReviewers = [];
  }


  // =========================
  // Actions
  // =========================

  hasActions(row: QualityRow): boolean {

    return (
      row.status !== 'تم المراجعة' &&
      row.status !== 'مرفوض'
    );
  }

    openRejectionReasonDialog(
    row: WorkflowStatusRow
  ): void {

    if (row.status !== 'مرفوض') {
      return;
    }


    this.selectedRow = row;


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
