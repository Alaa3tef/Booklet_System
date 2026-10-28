import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { Lookups } from '../../../shared/services/lookups';

interface ReviewUser { id: number; name: string; role: string; avatar?: string; }
interface SelectOption { label: string; value: string | number; }
type FilterKey = 'governorate' | 'subject' | 'committee';
type StepState = 'done' | 'current' | 'pending' | 'rejected';

const ST_PENDING  = 'بانتظار الاعتماد';
const ST_READY    = 'جاهز للطباعة';
const ST_REJECTED = 'مرفوض';

@Component({
  selector: 'app-printing-approved',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    SelectModule, InputTextModule, MultiSelectModule,
    DialogModule, ButtonModule, TextareaModule, TooltipModule, ToastModule,
    WorkflowStepLayoutComponent
  ],
  templateUrl: './printing-approved.component.html',
  styleUrl: './printing-approved.component.scss'
})
export default class PrintingApprovedComponent implements OnInit {

  private readonly lookupService = inject(Lookups);
  private readonly messageService = inject(MessageService);

  readonly essentials = ['البحث بالمحافظة', 'البحث بالمادة', 'اعتماد المادة للطباعة'];

  // ==========================================
  // FILTER OPTIONS
  // ==========================================
  readonly governorates = signal<SelectOption[]>([{ label: 'كل المحافظات', value: 'all' }]);
  readonly subjects     = signal<SelectOption[]>([{ label: 'كل المواد', value: 'all' }]);

  ngOnInit(): void { this.loadLookups(); }

  loadLookups(): void {
    forkJoin({
      governorates: this.lookupService.getLookupGovernorateData(),
      subjects: this.lookupService.getLookupSubjectData()
    }).subscribe({
      next: (res: any) => {
        const g = res.governorates?.data?.data ?? [];
        const s = res.subjects?.data?.data ?? [];

        this.governorates.set([
          { label: 'كل المحافظات', value: 'all' },
          ...g.map((i: any) => ({ label: i.nameAr ?? i.name, value: i.id }))
        ]);
        this.subjects.set([
          { label: 'كل المواد', value: 'all' },
          ...s.map((i: any) => ({ label: i.name, value: i.id }))
        ]);
      },
      error: err => {
        console.error('Error loading lookups:', err);
        this.messageService.add({
          severity: 'error', summary: 'خطأ', life: 3000,
          detail: err.error?.message || 'فشل تحميل بيانات القوائم'
        });
      }
    });
  }

  // ==========================================
  // REVIEW USERS
  // ==========================================
  readonly reviewUsers: ReviewUser[] = [
    { id: 1, name: 'أحمد محمد',  role: 'مراجع أول' },
    { id: 2, name: 'محمد علي',   role: 'مراجع جودة' },
    { id: 3, name: 'سارة أحمد',  role: 'مراجع محتوى' },
    { id: 4, name: 'محمود حسن',  role: 'مراجع نهائي' }
  ];

  // ==========================================
  // DATA  (replace with your API)
  // ==========================================
  private static readonly REJECT_TEXT =
    'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الطباعة.';

  readonly rows = signal<WorkflowStatusRow[]>([
    { index: 1,  committeeNumber: 'COM-1001', subject: 'اللغة العربية', governorate: 'القاهرة',    status: ST_PENDING,  statusTone: 'warning' },
    { index: 2,  committeeNumber: 'COM-1002', subject: 'الرياضيات',     governorate: 'الجيزة',     status: ST_READY,    statusTone: 'success' },
    { index: 3,  committeeNumber: 'COM-1003', subject: 'العلوم',        governorate: 'الإسكندرية', status: ST_REJECTED, statusTone: 'danger', rejectionReason: PrintingApprovedComponent.REJECT_TEXT },
    { index: 4,  committeeNumber: 'COM-1004', subject: 'اللغة العربية', governorate: 'القاهرة',    status: ST_PENDING,  statusTone: 'warning' },
    { index: 5,  committeeNumber: 'COM-1005', subject: 'الرياضيات',     governorate: 'الجيزة',     status: ST_PENDING,  statusTone: 'warning' },
    { index: 6,  committeeNumber: 'COM-1006', subject: 'العلوم',        governorate: 'الإسكندرية', status: ST_READY,    statusTone: 'success' },
    { index: 7,  committeeNumber: 'COM-1007', subject: 'اللغة العربية', governorate: 'القاهرة',    status: ST_PENDING,  statusTone: 'warning' },
    { index: 8,  committeeNumber: 'COM-1008', subject: 'الرياضيات',     governorate: 'الجيزة',     status: ST_PENDING,  statusTone: 'warning' },
    { index: 9,  committeeNumber: 'COM-1009', subject: 'العلوم',        governorate: 'الإسكندرية', status: ST_REJECTED, statusTone: 'danger', rejectionReason: PrintingApprovedComponent.REJECT_TEXT },
    { index: 10, committeeNumber: 'COM-1010', subject: 'اللغة العربية', governorate: 'القاهرة',    status: ST_PENDING,  statusTone: 'warning' },
    { index: 11, committeeNumber: 'COM-1011', subject: 'الرياضيات',     governorate: 'الجيزة',     status: ST_PENDING,  statusTone: 'warning' },
    { index: 12, committeeNumber: 'COM-1012', subject: 'العلوم',        governorate: 'الإسكندرية', status: ST_PENDING,  statusTone: 'warning' }
  ]);

  // ==========================================
  // FILTERS
  // ==========================================
  readonly searchGovernorate = signal<string | number>('all');
  readonly searchSubject     = signal<string | number>('all');
  readonly searchCommittee   = signal('');

  setGovernorate(v: string | number): void { this.searchGovernorate.set(v ?? 'all'); this.resetPage(); }
  setSubject(v: string | number): void     { this.searchSubject.set(v ?? 'all');     this.resetPage(); }
  setCommittee(v: string): void            { this.searchCommittee.set(v ?? '');      this.resetPage(); }

  private labelOf(options: SelectOption[], value: string | number): string | null {
    if (value === 'all') return null;
    return options.find(o => o.value === value)?.label ?? null;
  }

  readonly filteredRows = computed(() => {
    const gov = this.labelOf(this.governorates(), this.searchGovernorate());
    const sub = this.labelOf(this.subjects(), this.searchSubject());
    const com = this.searchCommittee().trim().toLowerCase();

    return this.rows().filter(r =>
      (!gov || r.governorate === gov) &&
      (!sub || r.subject === sub) &&
      (!com || String(r.committeeNumber).toLowerCase().includes(com))
    );
  });

  readonly activeFilters = computed(() => {
    const list: { key: FilterKey; title: string; value: string }[] = [];
    const gov = this.labelOf(this.governorates(), this.searchGovernorate());
    const sub = this.labelOf(this.subjects(), this.searchSubject());
    const com = this.searchCommittee().trim();
    if (gov) list.push({ key: 'governorate', title: 'المحافظة',   value: gov });
    if (sub) list.push({ key: 'subject',     title: 'المادة',      value: sub });
    if (com) list.push({ key: 'committee',   title: 'رقم اللجنة', value: com });
    return list;
  });

  /** quick stats for the summary strip */
  readonly stats = computed(() => {
    const all = this.rows();
    return {
      pending:  all.filter(r => r.status === ST_PENDING).length,
      ready:    all.filter(r => r.status === ST_READY).length,
      rejected: all.filter(r => r.status === ST_REJECTED).length
    };
  });

  removeFilter(key: FilterKey): void {
    if (key === 'governorate') this.searchGovernorate.set('all');
    if (key === 'subject')     this.searchSubject.set('all');
    if (key === 'committee')   this.searchCommittee.set('');
    this.resetPage();
  }

  clearFilters(): void {
    this.searchGovernorate.set('all');
    this.searchSubject.set('all');
    this.searchCommittee.set('');
    this.resetPage();
  }

  // ==========================================
  // PAGINATION
  // ==========================================
  readonly pageSize    = signal(6);
  readonly currentPage = signal(1);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize())));

  readonly paginatedRows = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  readonly paginationStart = computed(() =>
    this.filteredRows().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1);

  readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredRows().length));

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const cur = Math.min(this.currentPage(), total);
    const wanted = new Set<number>([1, total, cur - 1, cur, cur + 1]);
    const sorted = [...wanted].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);

    const pages: (number | 'dots')[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) pages.push('dots');
      pages.push(p);
    });
    return pages;
  });

  private resetPage(): void { this.currentPage.set(1); }
  onPageSizeChange(): void { this.resetPage(); }
  goToPage(p: number): void { if (p >= 1 && p <= this.totalPages()) this.currentPage.set(p); }
  previousPage(): void { this.goToPage(this.currentPage() - 1); }
  nextPage(): void     { this.goToPage(this.currentPage() + 1); }

  // ==========================================
  // CARD HELPERS
  // ==========================================
  trackerSteps(row: WorkflowStatusRow): { label: string; state: StepState }[] {
    switch (row.status) {
      case ST_READY:
        return [{ label: ST_PENDING, state: 'done' }, { label: ST_READY, state: 'current' }];
      case ST_REJECTED:
        return [{ label: ST_PENDING, state: 'done' }, { label: ST_REJECTED, state: 'rejected' }];
      default:
        return [{ label: ST_PENDING, state: 'current' }, { label: ST_READY, state: 'pending' }];
    }
  }

  // ==========================================
  // APPROVE -> READY FOR PRINTING
  // ==========================================
  // ==========================================
  // READY-FOR-PRINTING CONFIRMATION
  // ==========================================
  readyDialogVisible = false;

  markReady(row: WorkflowStatusRow): void {
    if (row.status === ST_READY || row.status === ST_REJECTED) return;
    this.selectedRow = row;
    this.readyDialogVisible = true;
  }

  closeReadyDialog(): void {
    this.readyDialogVisible = false;
    this.selectedRow = null;
  }

  confirmMarkReady(): void {
    const row = this.selectedRow;
    if (!row || row.status === ST_READY || row.status === ST_REJECTED) {
      this.closeReadyDialog();
      return;
    }

    // Replace this local update with the API call when its endpoint is available.
    this.rows.update(rows => rows.map(item =>
      item.index === row.index
        ? { ...item, status: ST_READY, statusTone: 'success', rejectionReason: undefined }
        : item
    ));

    this.readyDialogVisible = false;
    this.selectedRow = null;
    this.messageService.add({
      severity: 'success',
      summary: 'تم الاعتماد بنجاح',
      detail: 'تم تغيير حالة المادة إلى جاهز للطباعة',
      life: 3500
    });
  }

  // ==========================================
  // REJECT DIALOG
  // ==========================================
  selectedRow: WorkflowStatusRow | null = null;

  rejectDialogVisible = false;
  rejectReason = '';
  selectedReviewers: ReviewUser[] = [];
  rejectSubmitting = false;

  openRejectDialog(row: WorkflowStatusRow): void {
    this.selectedRow = row;
    this.rejectReason = '';
    this.selectedReviewers = [];
    this.rejectSubmitting = false;
    this.rejectDialogVisible = true;
  }

  closeRejectDialog(): void {
    if (this.rejectSubmitting) return;
    this.rejectDialogVisible = false;
    this.rejectReason = '';
    this.selectedReviewers = [];
  }

  get isRejectFormValid(): boolean {
    return this.rejectReason.trim().length >= 10 && this.selectedReviewers.length > 0;
  }

  submitRejection(): void {
    if (!this.selectedRow || !this.isRejectFormValid) return;

    this.rejectSubmitting = true;

    const rejectionData = {
      rowIndex: this.selectedRow.index,
      subject: this.selectedRow.subject,
      governorate: this.selectedRow.governorate,
      reason: this.rejectReason.trim(),
      reviewerIds: this.selectedReviewers.map(u => u.id)
    };
    console.log('Reject Request:', rejectionData);

    // API CALL WILL BE HERE
    setTimeout(() => {
      const rowIndex = this.selectedRow?.index;
      if (!rowIndex) { this.rejectSubmitting = false; return; }

      const reason = this.rejectReason.trim();
      this.rows.update(rows => rows.map(r =>
        r.index === rowIndex
          ? { ...r, status: ST_REJECTED, statusTone: 'danger', rejectionReason: reason }
          : r));

      this.rejectSubmitting = false;
      this.rejectDialogVisible = false;
      this.selectedRow = null;
      this.rejectReason = '';
      this.selectedReviewers = [];

      this.messageService.add({ severity: 'success', summary: 'تمت العملية', life: 3000, detail: 'تم رفض المادة بنجاح' });
    }, 800);
  }

  // ==========================================
  // VIEW REJECTION REASON
  // ==========================================
  rejectionReasonDialogVisible = false;
  selectedRejectionReason = '';

  openRejectionReasonDialog(row: WorkflowStatusRow): void {
    if (row.status !== ST_REJECTED) return;
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