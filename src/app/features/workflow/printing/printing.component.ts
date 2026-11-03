import { CommonModule } from '@angular/common';
import {
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, forkJoin } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import {
  PrintingCommittee,
  PrintingService,
  PrintingBatch,
  PrintingBatchFilters
} from './service/printing-service';

import { Lookups } from '../../../shared/services/lookups';

// ==========================================
// Interfaces
// ==========================================

interface Totals {
  committees: number;
  requiredBooklets: number;
  bonusBooklets: number;
  booklets: number;
  requiredEnvelopes: number;
  bonusEnvelopes: number;
  envelopes: number;
  boxes: number;
}

interface SelectOption {
  label: string;
  value: number;
}

const EMPTY_TOTALS: Totals = {
  committees: 0,
  requiredBooklets: 0,
  bonusBooklets: 0,
  booklets: 0,
  requiredEnvelopes: 0,
  bonusEnvelopes: 0,
  envelopes: 0,
  boxes: 0
};

// ==========================================
// Helpers
// ==========================================

function sum(list: PrintingCommittee[]): Totals {
  return list.reduce<Totals>(
    (t, c) => ({
      committees: t.committees + 1,
      requiredBooklets: t.requiredBooklets + c.requiredBooklets,
      bonusBooklets: t.bonusBooklets + c.bonusBooklets,
      booklets: t.booklets + c.requiredBooklets + c.bonusBooklets,
      requiredEnvelopes: t.requiredEnvelopes + c.requiredEnvelopes,
      bonusEnvelopes: t.bonusEnvelopes + c.bonusEnvelopes,
      envelopes: t.envelopes + c.requiredEnvelopes + c.bonusEnvelopes,
      boxes: t.boxes + c.boxCount
    }),
    { ...EMPTY_TOTALS }
  );
}

function errorMessage(error: any, fallback: string): string {
  return error?.error?.message || error?.message || fallback;
}

/**
 * Extract array from API response:
 * { data: { data: [...] } }
 * { data: [...] }
 * { items: [...] }
 * [...]
 */
function extractList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.result)) return res.result;
  return [];
}

/** بناء أزرار الصفحات (1 2 3 ... n) */
function buildPages(total: number, current: number): (number | 'dots')[] {

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
}

// ==========================================
// Component
// ==========================================

@Component({
  selector: 'app-printing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TooltipModule,
    WorkflowStepLayoutComponent
  ],
  templateUrl: './printing.component.html',
  styleUrl: './printing.component.scss',
  encapsulation: ViewEncapsulation.None
})
export default class PrintingComponent implements OnInit, OnDestroy {

  private readonly printingService = inject(PrintingService);
  private readonly lookups = inject(Lookups);

  // ==========================================
  // Page configuration
  // ==========================================

  readonly essentials = [
    'البحث بالمحافظة',
    'البحث بالمادة',
    'عرض اللجان',
    'تسجيل انتهاء الطباعة'
  ];

  readonly pageSizes = [
    { label: '6', value: 6 },
    { label: '12', value: 12 },
    { label: '24', value: 24 }
  ];

  constructor() {
    // البحث برقم اللجنة (debounce عشان منبعتش request مع كل حرف)
    this.committeeSearch$
      .pipe(debounceTime(400), takeUntilDestroyed())
      .subscribe(() => {
        this.committeesPage.set(1);
        this.loadCommittees(true);
      });
  }

  ngOnInit(): void {
    this.loadLookups();
    this.loadBatches();
  }

  ngOnDestroy(): void {
    this.batchesSub?.unsubscribe();
    this.committeesSub?.unsubscribe();
  }

  // ==========================================
  // Batches (Server-side pagination)
  // GET api/Printing/batches
  // ==========================================

  readonly batches = signal<PrintingBatch[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');

  // بيانات الـ pagination اللي راجعة من السيرفر
  readonly pageSize = signal(6);
  readonly currentPage = signal(1);
  readonly total = signal(0);
  readonly totalPages = signal(1);

  private batchesSub?: Subscription;

  loadBatches(silent = false): void {

    if (!silent) {
      this.loading.set(true);
    }

    this.loadError.set('');

    const filters: PrintingBatchFilters = {
      governorateId: this.selectedGovernorate(),
      subjectId: this.selectedSubject(),
      search: this.search(),
      pageNumber: this.currentPage(),
      pageSize: this.pageSize()
    };

    // إلغاء أي request قديم لسه شغال
    this.batchesSub?.unsubscribe();

    this.batchesSub = this.printingService.getBatches(filters).subscribe({

      next: result => {

        // لو الصفحة الحالية بقت فاضية (مثلاً بعد انتهاء طباعة آخر عنصر) نرجع صفحة
        if (
          result.items.length === 0 &&
          this.currentPage() > 1 &&
          result.totalCount > 0
        ) {
          this.currentPage.set(Math.max(1, result.totalPages));
          this.loadBatches(true);
          return;
        }

        this.batches.set(result.items);
        this.total.set(result.totalCount);
        this.totalPages.set(Math.max(1, result.totalPages));
        this.loading.set(false);
      },

      error: (error: unknown) => {
        console.error('Failed to load batches:', error);

        this.loadError.set(
          errorMessage(error, 'تعذر تحميل قائمة المواد. حاول مرة أخرى.')
        );

        this.loading.set(false);
      }

    });
  }

  // ==========================================
  // Lookups
  // Governorates / Subjects
  // ==========================================

  private readonly lookupGovernorates = signal<SelectOption[]>([]);
  private readonly lookupSubjects = signal<SelectOption[]>([]);

  readonly lookupsLoading = signal(false);

  readonly governorateOptions = computed<SelectOption[]>(
    () => this.lookupGovernorates()
  );

  readonly subjectOptions = computed<SelectOption[]>(
    () => this.lookupSubjects()
  );

  private loadLookups(): void {

    this.lookupsLoading.set(true);

    forkJoin({
      governorates: this.lookups.getLookupGovernorateData(),
      subjects: this.lookups.getLookupSubjectData()
    }).subscribe({

      next: ({ governorates, subjects }) => {

        this.lookupGovernorates.set(
          this.toOptions(governorates, 'governorate')
        );

        this.lookupSubjects.set(
          this.toOptions(subjects, 'subject')
        );

        this.lookupsLoading.set(false);
      },

      error: (error: unknown) => {
        console.error('Failed to load lookups:', error);
        this.lookupsLoading.set(false);
      }

    });
  }

  /**
   * تحويل بيانات الـ Lookup إلى { label, value }
   * الـ value هنا هو الـ ID وليس الاسم.
   */
  private toOptions(
    response: any,
    type: 'governorate' | 'subject'
  ): SelectOption[] {

    const list = extractList(response);

    const options = list
      .filter(item => item?.isActive !== false)
      .map(item => {

        const id =
          item?.id ??
          item?.governorateId ??
          item?.subjectId ??
          item?.value;

        const name =
          item?.name ??
          item?.nameAr ??
          item?.arabicName ??
          item?.subjectName ??
          item?.governorateName ??
          item?.label;

        return {
          label: String(name ?? '').trim(),
          value: Number(id)
        };

      })
      .filter(item =>
        item.label.length > 0 &&
        Number.isFinite(item.value) &&
        item.value > 0
      );

    // منع تكرار الـ IDs
    const unique = new Map<number, SelectOption>();

    options.forEach(option => {
      unique.set(option.value, option);
    });

    return [...unique.values()].sort(
      (a, b) => a.label.localeCompare(b.label, 'ar')
    );
  }

  // ==========================================
  // Filters
  // Server-side filtering
  // ==========================================

  readonly search = signal('');

  readonly selectedGovernorate = signal<number | null>(null);

  readonly selectedSubject = signal<number | null>(null);

  readonly hasActiveFilters = computed(
    () =>
      this.selectedGovernorate() !== null ||
      this.selectedSubject() !== null ||
      !!this.search().trim()
  );

  onGovernorateChange(value: number | null): void {
    this.selectedGovernorate.set(value);
    this.currentPage.set(1);
    this.loadBatches();
  }

  onSubjectChange(value: number | null): void {
    this.selectedSubject.set(value);
    this.currentPage.set(1);
    this.loadBatches();
  }

  /**
   * البحث النصي (Search) - متاح لو تم تفعيل حقل البحث في الصفحة
   */
  onSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(1);
    this.loadBatches();
  }

  resetFilters(): void {
    this.search.set('');
    this.selectedGovernorate.set(null);
    this.selectedSubject.set(null);
    this.currentPage.set(1);
    this.loadBatches();
  }

  /** الكروت المعروضة = الصفحة الحالية القادمة من السيرفر */
  readonly pageBatches = computed(() => this.batches());

  /** عدد اللجان قيد الطباعة في الصفحة المعروضة */
  readonly totalPending = computed(
    () =>
      this.batches().reduce(
        (total, batch) => total + batch.pendingCommittees,
        0
      )
  );

  // ==========================================
  // Batches Pagination helpers
  // ==========================================

  readonly paginationPages = computed<(number | 'dots')[]>(
    () => buildPages(this.totalPages(), this.currentPage())
  );

  readonly paginationStart = computed(() =>
    this.total() === 0
      ? 0
      : (this.currentPage() - 1) * this.pageSize() + 1
  );

  readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.total())
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
    this.loadBatches();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadBatches();
  }

  // ==========================================
  // Batch card helpers
  // ==========================================

  statusLabel(status: string): string {

    switch (status) {

      case 'ReadyForPrinting':
        return 'جاهزة للطباعة';

      case 'InProgress':
        return 'قيد الطباعة';

      case 'Completed':
      case 'Done':
        return 'مكتملة';

      case 'Pending':
      case 'NotStarted':
        return 'لم تبدأ';

      default:
        return status || '—';
    }
  }

  tone(
    batch: PrintingBatch
  ): 'success' | 'warning' | 'info' {

    if (batch.pendingCommittees === 0) {
      return 'success';
    }

    return batch.status === 'InProgress' ||
      batch.status === 'ReadyForPrinting'
      ? 'warning'
      : 'info';
  }

  trackBatch = (_: number, b: PrintingBatch) => b.id;

  trackCommittee = (_: number, c: PrintingCommittee) => c.id;

  // ==========================================
  // Committees Dialog (Server-side pagination + SearchTerm)
  // GET api/Printing/batches/{batchId}/committees
  // ==========================================

  committeesDialogVisible = false;

  readonly activeBatch = signal<PrintingBatch | null>(null);

  readonly committees = signal<PrintingCommittee[]>([]);

  readonly committeesLoading = signal(false);

  readonly committeesError = signal('');

  /** رقم اللجنة (SearchTerm) */
  readonly dialogSearch = signal('');

  // pagination اللجان
  readonly committeesPage = signal(1);
  readonly committeesPageSize = signal(12);
  readonly committeesTotal = signal(0);
  readonly committeesTotalPages = signal(1);

  private committeesSub?: Subscription;
  private readonly committeeSearch$ = new Subject<string>();

  /** إجماليات اللجان الظاهرة في الصفحة الحالية */
  readonly totals = computed(() => sum(this.committees()));

  /** الصفوف المعروضة = الصفحة الحالية من السيرفر */
  readonly dialogRows = computed(() => this.committees());

  readonly committeesPaginationPages = computed<(number | 'dots')[]>(
    () => buildPages(this.committeesTotalPages(), this.committeesPage())
  );

  readonly committeesStart = computed(() =>
    this.committeesTotal() === 0
      ? 0
      : (this.committeesPage() - 1) * this.committeesPageSize() + 1
  );

  readonly committeesEnd = computed(() =>
    Math.min(
      this.committeesPage() * this.committeesPageSize(),
      this.committeesTotal()
    )
  );

  openCommittees(batch: PrintingBatch): void {

    this.activeBatch.set(batch);

    this.committees.set([]);

    this.dialogSearch.set('');

    this.committeesPage.set(1);
    this.committeesTotal.set(0);
    this.committeesTotalPages.set(1);

    this.selected.set(new Map());

    this.printError.set('');

    this.committeesDialogVisible = true;

    this.loadCommittees();
  }

  /**
   * @param silent     بدون spinner (مثلاً أثناء البحث أو بعد الحفظ)
   * @param afterPrint لو true وملقيناش لجان خالص نقفل الدايلوج
   */
  loadCommittees(silent = false, afterPrint = false): void {

    const batch = this.activeBatch();

    if (!batch) {
      return;
    }

    if (!silent) {
      this.committeesLoading.set(true);
    }

    this.committeesError.set('');

    this.committeesSub?.unsubscribe();

    this.committeesSub = this.printingService
      .getCommittees(batch.id, {
        pageNumber: this.committeesPage(),
        pageSize: this.committeesPageSize(),
        searchTerm: this.dialogSearch()
      })
      .subscribe({

        next: result => {

          // الصفحة بقت فاضية (بعد الطباعة مثلاً) -> نرجع لآخر صفحة موجودة
          if (
            result.items.length === 0 &&
            this.committeesPage() > 1 &&
            result.totalCount > 0
          ) {
            this.committeesPage.set(Math.max(1, result.totalPages));
            this.loadCommittees(true, afterPrint);
            return;
          }

          this.committees.set(result.items);
          this.committeesTotal.set(result.totalCount);
          this.committeesTotalPages.set(Math.max(1, result.totalPages));
          this.committeesLoading.set(false);

          // مفيش أي لجان متبقية بعد الطباعة -> نقفل الدايلوج
          if (
            afterPrint &&
            result.totalCount === 0 &&
            !this.dialogSearch().trim()
          ) {
            this.closeCommittees();
          }
        },

        error: (error: unknown) => {

          console.error('Failed to load committees:', error);

          this.committeesError.set(
            errorMessage(error, 'تعذر تحميل اللجان. حاول مرة أخرى.')
          );

          this.committeesLoading.set(false);
        }

      });
  }

  /** البحث برقم اللجنة -> SearchTerm */
  onDialogSearch(value: string): void {
    this.dialogSearch.set(value);
    this.committeeSearch$.next(value.trim());
  }

  goToCommitteesPage(page: number): void {

    if (
      page < 1 ||
      page > this.committeesTotalPages() ||
      page === this.committeesPage()
    ) {
      return;
    }

    this.committeesPage.set(page);
    this.loadCommittees(true);
  }

  onCommitteesPageSizeChange(size: number): void {
    this.committeesPageSize.set(size);
    this.committeesPage.set(1);
    this.loadCommittees(true);
  }

  closeCommittees(): void {

    this.committeesSub?.unsubscribe();

    this.committeesDialogVisible = false;

    this.activeBatch.set(null);

    this.committees.set([]);

    this.committeesTotal.set(0);
    this.committeesTotalPages.set(1);
    this.committeesPage.set(1);

    this.dialogSearch.set('');

    this.selected.set(new Map());

    this.committeesError.set('');

    this.printError.set('');
  }

  // ==========================================
  // Multi Selection
  // (محفوظ عبر الصفحات: بنخزّن اللجنة نفسها مش الـ id بس)
  // ==========================================

  readonly selected = signal<Map<number, PrintingCommittee>>(new Map());

  readonly selectedIds = computed(
    () => new Set(this.selected().keys())
  );

  readonly selectedCommittees = computed(
    () => [...this.selected().values()]
  );

  readonly selectedCount = computed(
    () => this.selected().size
  );

  readonly selectedTotals = computed(
    () => sum(this.selectedCommittees())
  );

  /** هل كل لجان الصفحة الحالية محددة؟ */
  readonly allSelected = computed(() => {

    const list = this.dialogRows();

    return (
      list.length > 0 &&
      list.every(c => this.selected().has(c.id))
    );
  });

  readonly someSelected = computed(
    () =>
      this.dialogRows().some(c => this.selected().has(c.id)) &&
      !this.allSelected()
  );

  isSelected(c: PrintingCommittee): boolean {
    return this.selected().has(c.id);
  }

  toggleRow(c: PrintingCommittee): void {

    if (this.printSubmitting()) {
      return;
    }

    this.selected.update(map => {

      const next = new Map(map);

      if (next.has(c.id)) {
        next.delete(c.id);
      } else {
        next.set(c.id, c);
      }

      return next;
    });
  }

  /** تحديد / إلغاء تحديد كل لجان الصفحة الحالية */
  toggleAll(): void {

    const list = this.dialogRows();
    const all = this.allSelected();

    this.selected.update(map => {

      const next = new Map(map);

      if (all) {
        list.forEach(c => next.delete(c.id));
      } else {
        list.forEach(c => next.set(c.id, c));
      }

      return next;
    });
  }

  clearSelection(): void {
    this.selected.set(new Map());
  }

  booklets(c: PrintingCommittee): number {
    return c.requiredBooklets + c.bonusBooklets;
  }

  envelopes(c: PrintingCommittee): number {
    return c.requiredEnvelopes + c.bonusEnvelopes;
  }

  // ==========================================
  // Finish Printing
  // ==========================================

  confirmDialogVisible = false;

  readonly printSubmitting = signal(false);

  readonly printError = signal('');

  openConfirmDialog(): void {

    if (!this.selectedCount()) {
      return;
    }

    this.printError.set('');

    this.confirmDialogVisible = true;
  }

  closeConfirmDialog(): void {

    if (this.printSubmitting()) {
      return;
    }

    this.confirmDialogVisible = false;
  }

  confirmFinish(): void {

    const batch = this.activeBatch();

    const committeeIds = [...this.selectedIds()];

    if (
      !batch ||
      !committeeIds.length ||
      this.printSubmitting()
    ) {
      return;
    }

    this.printSubmitting.set(true);
    this.printError.set('');

    this.printingService
      .printCommittees(batch.id, committeeIds)
      .subscribe({

        next: () => {

          this.printSubmitting.set(false);
          this.confirmDialogVisible = false;
          this.clearSelection();

          // إعادة تحميل اللجان (ولو مفيش لجان متبقية الدايلوج هيتقفل)
          this.loadCommittees(true, true);

          // تحديث البطاقات الرئيسية
          this.loadBatches(true);
        },

        error: (error: unknown) => {

          console.error('Failed to register printing:', error);

          this.printSubmitting.set(false);

          this.printError.set(
            errorMessage(
              error,
              'تعذر تسجيل انتهاء الطباعة. حاول مرة أخرى.'
            )
          );
        }

      });
  }
}