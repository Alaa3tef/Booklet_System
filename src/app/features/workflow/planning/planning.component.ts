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
import { MessageService } from 'primeng/api';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { Lookups } from '../../../shared/services/lookups';

interface ReviewUser { id: number; name: string; role: string; avatar?: string; }
interface SelectOption { label: string; value: string | number; }
type FilterKey = 'governorate' | 'subject' | 'committee';
type StepState = 'done' | 'current' | 'pending' | 'rejected';

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    SelectModule, InputTextModule, MultiSelectModule,
    DialogModule, ButtonModule, TextareaModule, TooltipModule,
    WorkflowStepLayoutComponent
  ],
  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss'
})
export default class PlanningComponent implements OnInit {

  private readonly lookupService = inject(Lookups);
  private readonly messageService = inject(MessageService);

  // ==========================================
  // ESSENTIALS
  // ==========================================
  readonly essentials = ['البحث بالمحافظة', 'البحث بالمادة', 'تغيير حالة المادة'];

  // ==========================================
  // FILTER OPTIONS (signals, so filters react when lookups arrive)
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
  // TABLE DATA  (replace with your API)
  // ==========================================
  readonly rows = signal<WorkflowStatusRow[]>([
    { index: 1, committeeNumber: 'COM-1001', subject: 'اللغة العربية', governorate: 'القاهرة',    status: 'جاهز للطباعة', statusTone: 'success' },
    { index: 2, committeeNumber: 'COM-1002', subject: 'الرياضيات',     governorate: 'الجيزة',     status: 'قيد الإعداد',  statusTone: 'warning' },
    { index: 3, committeeNumber: 'COM-1003', subject: 'العلوم',        governorate: 'الإسكندرية', status: 'مرفوض',        statusTone: 'danger',
      rejectionReason: 'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الخطة.' },
    { index: 4, committeeNumber: 'COM-1004', subject: 'اللغة العربية', governorate: 'القاهرة',    status: 'جاهز للطباعة', statusTone: 'success' },
    { index: 5, committeeNumber: 'COM-1005', subject: 'الرياضيات',     governorate: 'الجيزة',     status: 'قيد الإعداد',  statusTone: 'warning' },
    { index: 6, committeeNumber: 'COM-1006', subject: 'العلوم',        governorate: 'الإسكندرية', status: 'مرفوض',        statusTone: 'danger',
      rejectionReason: 'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الخطة.' },
    { index: 7, committeeNumber: 'COM-1007', subject: 'اللغة العربية', governorate: 'القاهرة',    status: 'جاهز للطباعة', statusTone: 'success' },
    { index: 8, committeeNumber: 'COM-1008', subject: 'الرياضيات',     governorate: 'الجيزة',     status: 'قيد الإعداد',  statusTone: 'warning' },
    { index: 9, committeeNumber: 'COM-1009', subject: 'العلوم',        governorate: 'الإسكندرية', status: 'مرفوض',        statusTone: 'danger',
      rejectionReason: 'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الخطة.' },
      { index: 1, committeeNumber: 'COM-1001', subject: 'اللغة العربية', governorate: 'القاهرة',    status: 'جاهز للطباعة', statusTone: 'success' },
    { index: 2, committeeNumber: 'COM-1002', subject: 'الرياضيات',     governorate: 'الجيزة',     status: 'قيد الإعداد',  statusTone: 'warning' },
    { index: 3, committeeNumber: 'COM-1003', subject: 'العلوم',        governorate: 'الإسكندرية', status: 'مرفوض',        statusTone: 'danger',
      rejectionReason: 'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الخطة.' },
    { index: 4, committeeNumber: 'COM-1004', subject: 'اللغة العربية', governorate: 'القاهرة',    status: 'جاهز للطباعة', statusTone: 'success' },
    { index: 5, committeeNumber: 'COM-1005', subject: 'الرياضيات',     governorate: 'الجيزة',     status: 'قيد الإعداد',  statusTone: 'warning' },
    { index: 6, committeeNumber: 'COM-1006', subject: 'العلوم',        governorate: 'الإسكندرية', status: 'مرفوض',        statusTone: 'danger',
      rejectionReason: 'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الخطة.' },
      { index: 1, committeeNumber: 'COM-1001', subject: 'اللغة العربية', governorate: 'القاهرة',    status: 'جاهز للطباعة', statusTone: 'success' },
    { index: 2, committeeNumber: 'COM-1002', subject: 'الرياضيات',     governorate: 'الجيزة',     status: 'قيد الإعداد',  statusTone: 'warning' },
    { index: 3, committeeNumber: 'COM-1003', subject: 'العلوم',        governorate: 'الإسكندرية', status: 'مرفوض',        statusTone: 'danger',
      rejectionReason: 'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الخطة.' },
    { index: 4, committeeNumber: 'COM-1004', subject: 'اللغة العربية', governorate: 'القاهرة',    status: 'جاهز للطباعة', statusTone: 'success' },
    { index: 5, committeeNumber: 'COM-1005', subject: 'الرياضيات',     governorate: 'الجيزة',     status: 'قيد الإعداد',  statusTone: 'warning' },
    { index: 6, committeeNumber: 'COM-1006', subject: 'العلوم',        governorate: 'الإسكندرية', status: 'مرفوض',        statusTone: 'danger',
      rejectionReason: 'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الخطة.' }
  ]);

  // ==========================================
  // FILTERS  (applied immediately, no search button needed)
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

  // rows carry the NAME of the governorate / subject, so we compare by label
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

  /** feeds the "filters applied" bar */
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
  // PAGINATION  (6 per page = 2 rows x 3 cards)
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

  /**
   * Page numbers with dots (dots appear as soon as there are more than 3 pages
   * and at least one page is hidden):
   *   5 pages -> 1 2 ... 5  |  1 2 3 ... 5  |  1 2 3 4 5  |  1 ... 3 4 5  |  1 ... 4 5
   *   9 pages -> 1 2 ... 9  |  1 2 3 ... 9  |  1 ... 4 5 6 ... 9  |  1 ... 7 8 9
   */
  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const cur = Math.min(this.currentPage(), total);

    // first page + last page + the page before/after the current one
    const wanted = new Set<number>([1, total, cur - 1, cur, cur + 1]);
    const sorted = [...wanted].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);

    const pages: (number | 'dots')[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) pages.push('dots');   // hidden pages in between
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
  /** 2-step tracker: in preparation -> ready for printing (or rejected) */
  trackerSteps(row: WorkflowStatusRow): { label: string; state: StepState }[] {
    switch (row.status) {
      case 'جاهز للطباعة':
        return [{ label: 'قيد الإعداد', state: 'done' }, { label: 'جاهز للطباعة', state: 'current' }];
      case 'مرفوض':
        return [{ label: 'قيد الإعداد', state: 'done' }, { label: 'مرفوض', state: 'rejected' }];
      default:
        return [{ label: 'قيد الإعداد', state: 'current' }, { label: 'جاهز للطباعة', state: 'pending' }];
    }
  }

  // ==========================================
  // CHANGE STATUS -> READY
  // ==========================================
  markReady(row: WorkflowStatusRow): void {
    // API CALL WILL BE HERE, then reload the rows
    this.rows.update(rows => rows.map(r =>
      r.index === row.index
        ? { ...r, status: 'جاهز للطباعة', statusTone: 'success', rejectionReason: undefined }
        : r));

    this.messageService.add({
      severity: 'success', summary: 'تمت العملية', life: 3000,
      detail: 'تم تحويل المادة إلى جاهز للطباعة'
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
          ? { ...r, status: 'مرفوض', statusTone: 'danger', rejectionReason: reason }
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
    if (row.status !== 'مرفوض') return;
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