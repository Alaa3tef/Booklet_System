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

import { BatchCommittee, BatchDetails, PlanningBatch, PlanningService } from './service/planning-batch';

interface ReviewUser { id: number; name: string; role: string; avatar?: string; }
interface SelectOption { label: string; value: string | number; }
type FilterKey = 'governorate' | 'subject' | 'batch';
type StepState = 'done' | 'current' | 'pending' | 'rejected';

const READY = 'جاهز لاعتماد الطباعة';
const PREPARING = 'قيد الإعداد';
const REJECTED = 'مرفوض';

/** a card = one planning batch (من api/Planning/batches/for-approve) */
interface PlanningRow extends WorkflowStatusRow {
  batchId: number;
  batchName: string;
  year: number;
  roundName: string;
  totalCommittees: number;
  nextStatusNameAr: string;
}

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
  private readonly planningService = inject(PlanningService);
  private readonly messageService = inject(MessageService);

  // ==========================================
  // ESSENTIALS
  // ==========================================
  readonly essentials = ['البحث بالمحافظة', 'البحث بالمادة', 'عرض تفاصيل الدفعة', 'تغيير حالة المادة'];

  // ==========================================
  // FILTER OPTIONS
  // ==========================================
  readonly governorates = signal<SelectOption[]>([{ label: 'كل المحافظات', value: 'all' }]);
  readonly subjects     = signal<SelectOption[]>([{ label: 'كل المواد', value: 'all' }]);

  ngOnInit(): void {
    this.loadLookups();
    this.loadBatches();
  }

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
  // CARDS DATA  — GET api/Planning/batches/for-approve
  // ==========================================
  readonly rows = signal<PlanningRow[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  loadBatches(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.planningService.getBatchesForApprove().subscribe({
      next: res => {
        this.rows.set((res.data ?? []).map((b, i) => this.toRow(b, i)));
        this.loading.set(false);
        this.currentPage.set(1);
      },
      error: err => {
        console.error('Error loading batches:', err);
        this.loading.set(false);
        this.loadError.set(true);
        this.messageService.add({
          severity: 'error', summary: 'خطأ', life: 3000,
          detail: err.error?.message || 'فشل تحميل دفعات التخطيط'
        });
      }
    });
  }

  /** "قنا/عربي" -> governorate = قنا , subject = عربي */
  private toRow(b: PlanningBatch, i: number): PlanningRow {
    const [governorate, ...rest] = (b.batchName ?? '').split('/').map(s => s.trim());

    return {
      index: i + 1,
      committeeNumber: String(b.batchId),
      subject: rest.join('/') || b.batchName,
      governorate: governorate || '-',
      status: PREPARING,
      statusTone: 'warning',
      batchId: b.batchId,
      batchName: b.batchName,
      year: b.year,
      roundName: (b.roundName ?? '').trim(),
      totalCommittees: b.totalCommittees,
      nextStatusNameAr: b.nextStatusNameAr
    } as PlanningRow;
  }

  // ==========================================
  // FILTERS  (applied immediately)
  // ==========================================
  readonly searchGovernorate = signal<string | number>('all');
  readonly searchSubject     = signal<string | number>('all');
  readonly searchBatch       = signal('');

  setGovernorate(v: string | number): void { this.searchGovernorate.set(v ?? 'all'); this.resetPage(); }
  setSubject(v: string | number): void     { this.searchSubject.set(v ?? 'all');     this.resetPage(); }
  setBatch(v: string): void                { this.searchBatch.set(v ?? '');          this.resetPage(); }

  private labelOf(options: SelectOption[], value: string | number): string | null {
    if (value === 'all') return null;
    return options.find(o => o.value === value)?.label ?? null;
  }

  /** "عربي" must match "اللغة العربية" and vice versa */
  private same(a: string | undefined, b: string): boolean {
    const x = (a ?? '').trim();
    const y = (b ?? '').trim();
    return !!x && !!y && (x.includes(y) || y.includes(x));
  }

  readonly filteredRows = computed(() => {
    const gov = this.labelOf(this.governorates(), this.searchGovernorate());
    const sub = this.labelOf(this.subjects(), this.searchSubject());
    const q = this.searchBatch().trim().toLowerCase();

    return this.rows().filter(r =>
      (!gov || this.same(r.governorate, gov)) &&
      (!sub || this.same(r.subject, sub)) &&
      (!q || r.batchName.toLowerCase().includes(q) || String(r.batchId).includes(q))
    );
  });

  /** feeds the "filters applied" bar */
  readonly activeFilters = computed(() => {
    const list: { key: FilterKey; title: string; value: string }[] = [];
    const gov = this.labelOf(this.governorates(), this.searchGovernorate());
    const sub = this.labelOf(this.subjects(), this.searchSubject());
    const q = this.searchBatch().trim();

    if (gov) list.push({ key: 'governorate', title: 'المحافظة', value: gov });
    if (sub) list.push({ key: 'subject', title: 'المادة', value: sub });
    if (q)   list.push({ key: 'batch', title: 'الدفعة', value: q });
    return list;
  });

  removeFilter(key: FilterKey): void {
    if (key === 'governorate') this.searchGovernorate.set('all');
    if (key === 'subject')     this.searchSubject.set('all');
    if (key === 'batch')       this.searchBatch.set('');
    this.resetPage();
  }

  clearFilters(): void {
    this.searchGovernorate.set('all');
    this.searchSubject.set('all');
    this.searchBatch.set('');
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
  trackerSteps(row: PlanningRow): { label: string; state: StepState }[] {
    const next = row.nextStatusNameAr || READY;

    switch (row.status) {
      case READY:
        return [{ label: PREPARING, state: 'done' }, { label: READY, state: 'current' }];
      case REJECTED:
        return [{ label: PREPARING, state: 'done' }, { label: REJECTED, state: 'rejected' }];
      default:
        return [{ label: PREPARING, state: 'current' }, { label: next, state: 'pending' }];
    }
  }

  // ==========================================
  // BATCH DETAILS  — GET api/Planning/batches/{id}
  // ==========================================
  detailsVisible = false;

  readonly detailsRow = signal<PlanningRow | null>(null);
  readonly details = signal<BatchDetails | null>(null);
  readonly detailsLoading = signal(false);
  readonly detailsError = signal(false);
  readonly detailsSearch = signal('');

  openDetails(row: PlanningRow): void {
    this.detailsRow.set(row);
    this.detailsSearch.set('');
    this.detailsVisible = true;
    this.loadDetails();
  }

  loadDetails(): void {
    const row = this.detailsRow();
    if (!row) return;

    this.detailsLoading.set(true);
    this.detailsError.set(false);
    this.details.set(null);

    this.planningService.getBatchDetails(row.batchId).subscribe({
      next: res => {
        this.details.set(res.data ?? null);
        this.detailsLoading.set(false);
      },
      error: err => {
        console.error('Error loading batch details:', err);
        this.detailsLoading.set(false);
        this.detailsError.set(true);
        this.messageService.add({
          severity: 'error', summary: 'خطأ', life: 3000,
          detail: err.error?.message || 'فشل تحميل تفاصيل الدفعة'
        });
      }
    });
  }

  closeDetails(): void {
    this.detailsVisible = false;
    this.detailsRow.set(null);
    this.details.set(null);
    this.detailsError.set(false);
    this.detailsSearch.set('');
  }

  /** the 6 summary tiles at the top of the dialog */
  readonly detailsStats = computed(() => {
    const d = this.details();
    if (!d) return [];

    return [
      { label: 'عدد اللجان',          value: d.totalCommittees,       icon: 'pi-building' },
      { label: 'الكراسات المطلوبة',   value: d.totalRequiredBooklets, icon: 'pi-book' },
      { label: 'الكراسات الإضافية',   value: d.totalBonusBooklets,    icon: 'pi-plus-circle' },
      { label: 'الأظرف المطلوبة',     value: d.totalRequiredEnvelopes, icon: 'pi-envelope' },
      { label: 'الأظرف الإضافية',     value: d.totalBonusEnvelopes,   icon: 'pi-plus' },
      { label: 'عدد الصناديق',        value: d.totalBoxes,            icon: 'pi-box' }
    ];
  });

  /** committees table, filtered by the search box (committee number / school / administration) */
  readonly detailsCommittees = computed(() => {
    const list = this.details()?.committees ?? [];
    const q = this.detailsSearch().trim().toLowerCase();
    if (!q) return list;

    return list.filter((c: BatchCommittee) =>
      String(c.committeeNumber).toLowerCase().includes(q) ||
      (c.schoolName ?? '').toLowerCase().includes(q) ||
      (c.educationalAdministration ?? '').toLowerCase().includes(q)
    );
  });

  // ==========================================
  // CHANGE STATUS -> READY
  // ==========================================
  markReady(row: PlanningRow): void {
    // API CALL WILL BE HERE, then reload the rows
    this.rows.update(rows => rows.map(r =>
      r.batchId === row.batchId
        ? { ...r, status: READY, statusTone: 'success', rejectionReason: undefined }
        : r));

    this.messageService.add({
      severity: 'success', summary: 'تمت العملية', life: 3000,
      detail: 'تم تحويل المادة إلى جاهز لاعتماد الطباعة'
    });
  }

  // ==========================================
  // REJECT DIALOG
  // ==========================================
  selectedRow: PlanningRow | null = null;

  rejectDialogVisible = false;
  rejectReason = '';
  selectedReviewers: ReviewUser[] = [];
  rejectSubmitting = false;

  openRejectDialog(row: PlanningRow): void {
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
      batchId: this.selectedRow.batchId,
      subject: this.selectedRow.subject,
      governorate: this.selectedRow.governorate,
      reason: this.rejectReason.trim(),
      reviewerIds: this.selectedReviewers.map(u => u.id)
    };
    console.log('Reject Request:', rejectionData);

    // API CALL WILL BE HERE
    setTimeout(() => {
      const batchId = this.selectedRow?.batchId;
      if (!batchId) { this.rejectSubmitting = false; return; }

      const reason = this.rejectReason.trim();
      this.rows.update(rows => rows.map(r =>
        r.batchId === batchId
          ? { ...r, status: REJECTED, statusTone: 'danger', rejectionReason: reason }
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

  openRejectionReasonDialog(row: PlanningRow): void {
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
