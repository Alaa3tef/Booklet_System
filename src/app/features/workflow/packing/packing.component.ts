import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { SelectModule } from 'primeng/select';

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

@Component({
  selector: 'app-packing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    DialogModule,
    MultiSelectModule,
    ButtonModule,
    TextareaModule, SelectModule,
    WorkflowStepLayoutComponent
  ],
  templateUrl: './packing.component.html',
  styleUrl: './packing.component.scss'
})
export default class PackingComponent {

  // =====================================================
  // Page essentials
  // =====================================================

  readonly essentials = [
    'تغليف الأظرف الصغيرة للجنة في ظرف كبير',
    'عمل Scan للـ QR الخارجي للجنة بالكامل',
    'تسجيل حالة التغليف'
  ];


  // =====================================================
  // Packing rows
  // =====================================================

  readonly rows = signal<PackingRow[]>([
    {
      index: 1,
      subject: 'اللغة العربية',
      committeeNumber: '101',
      governorate: 'القاهرة',
      qrCode: 'QR-PACK-101',
      status: 'تم التغليف',
      statusTone: 'success'
    },
    {
      index: 2,
      subject: 'اللغة العربية',
      committeeNumber: '102',
      governorate: 'الجيزة',
      qrCode: 'QR-PACK-102',
      status: 'قيد التغليف',
      statusTone: 'warning'
    },
    {
      index: 3,
      subject: 'اللغة العربية',
      committeeNumber: '103',
      governorate: 'القاهرة',
      qrCode: 'QR-PACK-103',
      status: 'قيد التغليف',
      statusTone: 'warning'
    },
    {
      index: 4,
      subject: 'الرياضيات',
      committeeNumber: '104',
      governorate: 'المنوفية',
      qrCode: 'QR-PACK-104',
      status: 'قيد التغليف',
      statusTone: 'warning'
    }
  ]);

    // ==========================================
  // SEARCH FILTERS
  // ==========================================

  // القيم اللي المستخدم بيختارها/بيكتبها (لسه مطبقتش)
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
(!committeeTerm || (row.committeeNumber ?? '').includes(committeeTerm))    );
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
  // =====================================================
  // Scan Dialog
  // =====================================================

  scanDialogVisible = false;

  selectedRow: PackingRow | null = null;

  isScanning = false;

  scanCompleted = false;

  scanMessage = '';

  scanResult: PackingScanResult | null = null;


  // =====================================================
  // Reject Dialog
  // =====================================================

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


  // =====================================================
  // Open Scan
  // =====================================================

  openScanDialog(row: PackingRow): void {

    if (
      row.status === 'تم التغليف' ||
      row.status === 'مرفوض'
    ) {
      return;
    }

    this.selectedRow = row;

    this.isScanning = false;

    this.scanCompleted = false;

    this.scanMessage = '';

    this.scanResult = null;

    this.scanDialogVisible = true;
  }


  // =====================================================
  // Start Scan
  // =====================================================

  startScan(): void {

    if (
      this.isScanning ||
      this.scanCompleted ||
      !this.selectedRow
    ) {
      return;
    }

    this.isScanning = true;

    this.scanMessage =
      'جاري قراءة QR الغلاف الخارجي...';


    // Mock Scan
    setTimeout(() => {

      const row = this.selectedRow!;

      this.scanResult = {

        qrCode:
          `${row.qrCode}-OUTER`,

        subject:
          row.subject,

        committeeNumber:
          row.committeeNumber,

        governorate:
          row.governorate,

        scanType:
          'الغلاف الخارجي للجنة',

        scannedAt:
          new Date().toLocaleTimeString(
            'ar-EG',
            {
              hour: '2-digit',
              minute: '2-digit'
            }
          )
      };


      this.isScanning = false;

      this.scanCompleted = true;

      this.scanMessage =
        'تم قراءة QR الغلاف الخارجي بنجاح';

    }, 1400);
  }


  // =====================================================
  // Confirm Packing
  // =====================================================

  confirmPacking(): void {

    if (
      !this.selectedRow ||
      !this.scanCompleted
    ) {
      return;
    }

    const row = this.selectedRow;


    // هنا بعدين هيتحط API
    console.info(
      'Confirm Packing',
      {
        committeeNumber:
          row.committeeNumber,

        subject:
          row.subject,

        scan:
          this.scanResult
      }
    );


    this.rows.update(rows =>
      rows.map(item =>
        item.index === row.index
          ? {
              ...item,
              status: 'تم التغليف',
              statusTone: 'success'
            }
          : item
      )
    );


    this.scanMessage =
      `تم تغليف مادة ${row.subject} بنجاح`;

    this.scanDialogVisible = false;
  }


  // =====================================================
  // Open Reject Dialog
  // =====================================================

  openRejectDialog(): void {

    if (
      !this.selectedRow ||
      !this.scanCompleted
    ) {
      return;
    }

    this.rejectReason = '';

    this.selectedReviewers = [];

    this.rejectDialogVisible = true;
  }


  // =====================================================
  // Reject Validation
  // =====================================================

  get isRejectFormValid(): boolean {

    return (
      this.rejectReason.trim().length >= 10 &&
      this.selectedReviewers.length > 0
    );
  }


  // =====================================================
  // Submit Rejection
  // =====================================================

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

      rowIndex:
        row.index,

      subject:
        row.subject,

      committeeNumber:
        row.committeeNumber,

      governorate:
        row.governorate,

      scan:
        this.scanResult,

      reason:
        this.rejectReason.trim(),

      reviewerIds:
        this.selectedReviewers.map(
          user => user.id
        )
    };


    console.info(
      'Packing Rejection',
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

      this.selectedRow = null;

      this.rejectReason = '';

      this.selectedReviewers = [];

    }, 800);
  }


  // =====================================================
  // Close Scan Dialog
  // =====================================================

  closeScanDialog(): void {

    if (this.isScanning) {
      return;
    }

    this.scanDialogVisible = false;

    this.selectedRow = null;

    this.scanResult = null;

    this.scanCompleted = false;

    this.scanMessage = '';
  }


  // =====================================================
  // Close Reject Dialog
  // =====================================================

  closeRejectDialog(): void {

    if (this.rejectSubmitting) {
      return;
    }

    this.rejectDialogVisible = false;

    this.rejectReason = '';

    this.selectedReviewers = [];
  }


  // =====================================================
  // Check if row has action
  // =====================================================

  hasActions(row: PackingRow): boolean {

    return (
      row.status !== 'تم التغليف' &&
      row.status !== 'مرفوض'
    );
  }
}
