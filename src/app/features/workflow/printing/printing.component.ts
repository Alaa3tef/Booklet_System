import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { SelectOption } from '../../../core/models/committee.model';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';

const DONE = 'تم الانتهاء';
const REJECTED = 'مرفوض';
const PENDING = 'قيد الطباعة';

interface ReviewUser {
  id: number;
  name: string;
  role: string;
}

/** صف static: بنضيف رقم اللجنة عشان الفلتر */
type PrintingRow = WorkflowStatusRow & { committeeNumber: string };

// ==========================================
// Static data
// ==========================================

const STATIC_GOVERNORATES: SelectOption[] = [
  { label: 'كل المحافظات', value: '' },
  { label: 'عمّان', value: '1' },
  { label: 'إربد', value: '2' },
  { label: 'الزرقاء', value: '3' },
  { label: 'العقبة', value: '4' }
];

const STATIC_SUBJECTS: SelectOption[] = [
  { label: 'كل المواد', value: '' },
  { label: 'اللغة العربية', value: '1' },
  { label: 'الرياضيات', value: '2' },
  { label: 'العلوم', value: '3' },
  { label: 'اللغة الإنجليزية', value: '4' }
];

function buildStaticRows(): PrintingRow[] {
  const govs = STATIC_GOVERNORATES.slice(1);
  const subs = STATIC_SUBJECTS.slice(1);

  return Array.from({ length: 14 }, (_, i) => {
    const status = i % 7 === 5 ? DONE : i % 7 === 6 ? REJECTED : PENDING;

    return {
      id: i + 1,
      index: i + 1,
      subject: subs[i % subs.length].label,
      governorate: govs[i % govs.length].label,
      committeeNumber: String(100 + i),
      status,
      statusTone: status === DONE ? 'success' : status === REJECTED ? 'danger' : 'warning',
      rejectionReason: status === REJECTED ? 'يوجد خطأ في ترتيب الصفحات ويجب إعادة الطباعة.' : ''
    } as PrintingRow;
  });
}

@Component({
  selector: 'app-printing',
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
  templateUrl: './printing.component.html',
  styleUrl: './printing.component.scss',
  // الـ dialogs بتتعمل render برا الـ component، فبنستخدم None مع prefix "pr-" بدل ::ng-deep
  encapsulation: ViewEncapsulation.None
})
export default class PrintingComponent {
  private readonly committeeInput$ = new Subject<string>();

  readonly essentials = [
    'البحث بالمحافظة',
    'البحث بالمادة',
    'البحث برقم اللجنة',
    'تسجيل انتهاء الطباعة'
  ];

  readonly reviewUsers: ReviewUser[] = [
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

  // ==========================================
  // Lookups (static)
  // ==========================================

  readonly governorates = signal<SelectOption[]>(STATIC_GOVERNORATES);
  readonly subjects = signal<SelectOption[]>(STATIC_SUBJECTS);
  readonly governoratesLoading = signal(false);
  readonly subjectsLoading = signal(false);

  // ==========================================
  // Filters
  // ==========================================

  selectedGovernorate = '';
  selectedSubject = '';
  selectedCommittee = '';

  get hasActiveFilters(): boolean {
    return !!(this.selectedGovernorate || this.selectedSubject || this.selectedCommittee.trim());
  }

  // ==========================================
  // Data (static)
  // ==========================================

  private readonly allRows = signal<any[]>(buildStaticRows());

  readonly rows = signal<WorkflowStatusRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);

  // ==========================================
  // Pagination
  // ==========================================

  readonly pageSize = signal(6);
  readonly currentPage = signal(1);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const cur = this.currentPage();

    if (total <= 4) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 2) return [1, 2, 3, 'dots', total];
    if (cur >= total - 1) return [1, 'dots', total - 2, total - 1, total];
    return [1, 'dots', cur, 'dots', total];
  });

  readonly paginationStart = computed(() =>
    this.total() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1
  );

  readonly paginationEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.total()));

  constructor() {
    this.reload();

    // البحث برقم اللجنة (بعد ما المستخدم يوقف كتابة)
    this.committeeInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.onFilterChange());
  }

  /** فلترة + pagination على الداتا الـ static */
  reload(): void {
    const govLabel = this.governorates().find(o => o.value === this.selectedGovernorate)?.label;
    const subLabel = this.subjects().find(o => o.value === this.selectedSubject)?.label;
    const committee = this.selectedCommittee.trim();

    const filtered = this.allRows().filter(
      r =>
        (!this.selectedGovernorate || r.governorate === govLabel) &&
        (!this.selectedSubject || r.subject === subLabel) &&
        (!committee || r.committeeNumber.includes(committee))
    );

    const start = (this.currentPage() - 1) * this.pageSize();

    this.total.set(filtered.length);
    this.rows.set(filtered.slice(start, start + this.pageSize()));
  }

  /** أي تغيير في الفلاتر يرجّع لأول صفحة */
  onFilterChange(): void {
    this.currentPage.set(1);
    this.reload();
  }

  onCommitteeInput(value: string): void {
    this.selectedCommittee = value;
    this.committeeInput$.next(value.trim());
  }

  resetFilters(): void {
    this.selectedGovernorate = '';
    this.selectedSubject = '';
    this.selectedCommittee = '';
    this.onFilterChange();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;

    this.currentPage.set(page);
    this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.onFilterChange();
  }

  /** تعديل صف في الداتا الـ static (بديل الـ API) */
  private updateRow(id: number | string, changes: Partial<any>): void {
    this.allRows.update(list => list.map(r => (r.id === id ? { ...r, ...changes } : r)));
    this.reload();
  }

  // ==========================================
  // Card helpers
  // ==========================================

  isDone(row: WorkflowStatusRow): boolean {
    return row.status === DONE;
  }

  isRejected(row: WorkflowStatusRow): boolean {
    return row.status === REJECTED;
  }

  isPending(row: WorkflowStatusRow): boolean {
    return !this.isDone(row) && !this.isRejected(row);
  }

  statusIcon(row: WorkflowStatusRow): string {
    return this.isDone(row) ? 'pi-check-circle' : this.isRejected(row) ? 'pi-times-circle' : 'pi-clock';
  }

  // ==========================================
  // Finish printing (with confirmation)
  // ==========================================

  selectedRow: any | null = null;

  confirmDialogVisible = false;
  finishSubmitting = false;

  openConfirmDialog(row: WorkflowStatusRow): void {
    if (!this.isPending(row)) return;

    this.selectedRow = row;
    this.confirmDialogVisible = true;
  }

  closeConfirmDialog(): void {
    if (this.finishSubmitting) return;

    this.confirmDialogVisible = false;
    this.selectedRow = null;
  }

  confirmFinish(): void {
    if (!this.selectedRow || this.finishSubmitting) return;

    this.updateRow(this.selectedRow.id, { status: DONE, statusTone: 'success' } as Partial<PrintingRow>);
    this.confirmDialogVisible = false;
    this.selectedRow = null;
  }

  // ==========================================
  // Reject dialog
  // ==========================================

  rejectDialogVisible = false;
  rejectReason = '';
  selectedReviewers: ReviewUser[] = [];
  rejectSubmitting = false;

  get isRejectFormValid(): boolean {
    return this.rejectReason.trim().length >= 10 && this.selectedReviewers.length > 0;
  }

  openRejectDialog(row: WorkflowStatusRow): void {
    if (!this.isPending(row)) return;

    this.selectedRow = row;
    this.rejectReason = '';
    this.selectedReviewers = [];
    this.rejectSubmitting = false;
    this.rejectDialogVisible = true;
  }

  closeRejectDialog(): void {
    if (this.rejectSubmitting) return;

    this.rejectDialogVisible = false;
    this.selectedRow = null;
    this.rejectReason = '';
    this.selectedReviewers = [];
  }

  submitRejection(): void {
    if (!this.selectedRow || !this.isRejectFormValid) return;

    this.updateRow(this.selectedRow.id, {
      status: REJECTED,
      statusTone: 'danger',
      rejectionReason: this.rejectReason.trim()
    } as Partial<PrintingRow>);

    this.rejectDialogVisible = false;
    this.selectedRow = null;
    this.rejectReason = '';
    this.selectedReviewers = [];
  }

  // ==========================================
  // View rejection reason
  // ==========================================

  rejectionReasonDialogVisible = false;
  selectedRejectionReason = '';

  openRejectionReasonDialog(row: WorkflowStatusRow): void {
    if (!this.isRejected(row)) return;

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