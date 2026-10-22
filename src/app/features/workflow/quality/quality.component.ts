import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
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

const PENDING = 'قيد المراجعة';
const DONE = 'تم المراجعة';
const REJECTED = 'مرفوض';

interface QualityRow extends WorkflowStatusRow {
  committeeNumber: string;
  governorate: string;
  qrCode: string;
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
  type: 'envelope' | 'cover';
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
  // الـ dialogs بتتعمل render برا الـ component، فبنستخدم None مع prefix "qc-" بدل ::ng-deep
  encapsulation: ViewEncapsulation.None
})
export default class QualityComponent {
  readonly essentials = [
    'مسح QR الخاص بكل مادة',
    'مسح جميع أظرف اللجنة',
    'مسح الغلاف النهائي',
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
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '20', value: 20 }
  ];

  // =========================
  // Data
  // =========================

  readonly rows = signal<QualityRow[]>([
    { index: 1, subject: 'اللغة العربية', committeeNumber: '101', governorate: 'القاهرة', qrCode: 'QR-COMMITTEE-101', status: PENDING, statusTone: 'info' },
    { index: 2, subject: 'الرياضيات', committeeNumber: '102', governorate: 'الجيزة', qrCode: 'QR-COMMITTEE-102', status: PENDING, statusTone: 'info' },
    { index: 3, subject: 'اللغة الإنجليزية', committeeNumber: '103', governorate: 'القاهرة', qrCode: 'QR-COMMITTEE-103', status: DONE, statusTone: 'success' }
  ]);

  // =========================
  // Filters
  // =========================

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

  readonly subjectOptions = computed(() => this.optionsOf(r => r.subject));
  readonly governorateOptions = computed(() => this.optionsOf(r => r.governorate));

  /** الصفوف بعد البحث (قبل تبويب الحالة) - تُستخدم لعدّادات التبويبات */
  private readonly searchedRows = computed(() => {
    const { subject, governorate, committee } = this.appliedFilters();
    const term = committee.trim();

    return this.rows().filter(
      r =>
        (!subject || r.subject === subject) &&
        (!governorate || r.governorate === governorate) &&
        (!term || r.committeeNumber.includes(term))
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
      { key: PENDING, label: 'قيد المراجعة', icon: 'pi-clock', tone: 'info', count: count(PENDING) },
      { key: DONE, label: 'تمت المراجعة', icon: 'pi-check-circle', tone: 'success', count: count(DONE) },
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

  private optionsOf(pick: (r: QualityRow) => string) {
    return [...new Set(this.rows().map(pick))].map(value => ({ label: value, value }));
  }

  // =========================
  // Pagination
  // =========================

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

  // =========================
  // Card helpers
  // =========================

  statusIcon(row: QualityRow): string {
    return row.status === DONE ? 'pi-check-circle' : row.status === REJECTED ? 'pi-times-circle' : 'pi-clock';
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

  selectedRow: any | null = null;
  scanDialogVisible = false;
  scanSteps: ScanStep[] = [];
  currentScanIndex = 0;
  scanMessage = '';
  isScanning = false;

  openScanDialog(row: QualityRow): void {
    if (!this.isPending(row)) return;

    this.selectedRow = row;
    this.currentScanIndex = 0;
    this.scanMessage = '';
    this.isScanning = false;
    this.scanSteps = this.createScanSteps();
    this.scanDialogVisible = true;
  }

  private createScanSteps(): ScanStep[] {
    const step = (id: number, type: ScanStep['type'], title: string, subtitle: string): ScanStep => ({
      id, type, title, subtitle, scanned: false, scanning: false, qrCode: '', data: null
    });

    return [
      step(1, 'envelope', 'الظرف الأول', 'QR الخاص بالظرف الأول'),
      step(2, 'envelope', 'الظرف الثاني', 'QR الخاص بالظرف الثاني'),
      step(3, 'envelope', 'الظرف الثالث', 'QR الخاص بالظرف الثالث'),
      step(4, 'cover', 'الغلاف النهائي', 'QR الخاص بالغلاف الداخلي')
    ];
  }

  get currentStep(): ScanStep | null {
    return this.scanSteps[this.currentScanIndex] ?? null;
  }

  startScan(): void {
    if (this.isScanning || !this.currentStep || !this.selectedRow) return;

    const step = this.currentStep;
    this.isScanning = true;
    step.scanning = true;
    this.scanMessage = 'جاري قراءة بيانات الـ QR...';

    // Mock scanner
    setTimeout(() => {
      const row = this.selectedRow!;
      const isCover = step.type === 'cover';
      const qrCode = isCover ? `${row.qrCode}-COVER` : `${row.qrCode}-ENV-${step.id}`;

      step.data = {
        qrCode,
        material: row.subject,
        committeeNumber: row.committeeNumber,
        governorate: row.governorate,
        envelopeNumber: isCover ? undefined : step.id,
        scanType: isCover ? 'الغلاف النهائي' : `الظرف ${step.id}`,
        scannedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };
      step.qrCode = qrCode;
      step.scanned = true;
      step.scanning = false;
      this.isScanning = false;
      this.scanMessage = `تم قراءة ${step.title} بنجاح`;

      // الانتقال التلقائي للمرحلة التالية
      if (this.currentScanIndex < this.scanSteps.length - 1) {
        setTimeout(() => this.currentScanIndex++, 600);
      }
    }, 1400);
  }

  selectScanStep(index: number): void {
    // لا تسمح بالدخول لمرحلة لم يصل إليها المستخدم
    if (this.scanSteps.slice(0, index).every(s => s.scanned)) {
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
    return this.scanSteps.length > 0 && this.scanSteps.every(s => s.scanned);
  }

  get completedScans(): number {
    return this.scanSteps.filter(s => s.scanned).length;
  }

  get scanProgress(): number {
    return this.scanSteps.length ? Math.round((this.completedScans / this.scanSteps.length) * 100) : 0;
  }

  approveMaterial(): void {
    if (!this.selectedRow || !this.allScansCompleted) return;

    this.updateStatus(this.selectedRow.index, DONE, 'success');
    this.scanDialogVisible = false;
  }

  closeScanDialog(): void {
    if (this.isScanning) return;

    this.scanDialogVisible = false;
    this.selectedRow = null;
    this.scanSteps = [];
    this.currentScanIndex = 0;
    this.scanMessage = '';
  }

  private updateStatus(index: number, status: string, statusTone: QualityRow['statusTone']): void {
    this.rows.update(rows => rows.map(r => (r.index === index ? { ...r, status, statusTone } : r)));
  }

  // =========================
  // Reject dialog
  // =========================

  rejectDialogVisible = false;
  rejectReason = '';
  selectedReviewers: any[] = [];
  rejectSubmitting = false;

  openRejectDialog(): void {
    if (!this.selectedRow || !this.allScansCompleted) return;

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

    console.log('QUALITY REJECTION REQUEST', {
      rowIndex: row.index,
      subject: row.subject,
      committeeNumber: row.committeeNumber,
      governorate: row.governorate,
      scans: this.scanSteps.map(s => ({ scanType: s.title, qrCode: s.qrCode })),
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

  // =========================
  // Rejection reason (view)
  // =========================

  rejectionReasonDialogVisible = false;
  selectedRejectionReason = '';

  openRejectionReasonDialog(row: WorkflowStatusRow): void {
    if (row.status !== REJECTED) return;

    this.selectedRow = row;
    this.selectedRejectionReason = row.rejectionReason?.trim() || 'لم يتم تسجيل سبب الرفض.';
    this.rejectionReasonDialogVisible = true;
  }

  closeRejectionReasonDialog(): void {
    this.rejectionReasonDialogVisible = false;
    this.selectedRejectionReason = '';
    this.selectedRow = null;
  }
}