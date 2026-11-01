
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
import { forkJoin } from 'rxjs';

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
export default class PrintingComponent implements OnInit {

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

  ngOnInit(): void {
    this.loadLookups();
    this.loadBatches();
  }

  // ==========================================
  // Batches
  // GET api/Printing/batches
  // ==========================================

  readonly batches = signal<PrintingBatch[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');

  loadBatches(silent = false): void {

    if (!silent) {
      this.loading.set(true);
    }

    this.loadError.set('');

    const filters: PrintingBatchFilters = {
      governorateId: this.selectedGovernorate(),
      subjectId: this.selectedSubject()
    };

    this.printingService.getBatches(filters).subscribe({

      next: batches => {
        this.batches.set(batches);
        this.loading.set(false);

        // التأكد إن الصفحة الحالية موجودة بعد الفلترة
        if (this.currentPage() > this.totalPages()) {
          this.currentPage.set(1);
        }
      },

      error: (error: unknown) => {
        console.error('Failed to load batches:', error);

        this.loadError.set(
          errorMessage(
            error,
            'تعذر تحميل قائمة المواد. حاول مرة أخرى.'
          )
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
   * تحويل بيانات الـ Lookup إلى:
   * {
   *   label: 'اسم المحافظة',
   *   value: GovernorateId
   * }
   *
   * مهم:
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

  /**
   * البحث بالمحافظة
   * إرسال GovernorateId إلى API
   */
  onGovernorateChange(value: number | null): void {

    this.selectedGovernorate.set(value);

    this.currentPage.set(1);

    this.loadBatches();
  }

  /**
   * البحث بالمادة
   * إرسال SubjectId إلى API
   */
  onSubjectChange(value: number | null): void {

    this.selectedSubject.set(value);

    this.currentPage.set(1);

    this.loadBatches();
  }

  /**
   * البحث النصي - متاح لو تم تفعيل حقل البحث
   */
  onSearch(value: string): void {

    this.search.set(value);

    this.currentPage.set(1);
  }

  /**
   * إعادة تعيين الفلاتر
   */
  resetFilters(): void {

    this.search.set('');

    this.selectedGovernorate.set(null);

    this.selectedSubject.set(null);

    this.currentPage.set(1);

    this.loadBatches();
  }

  /**
   * النتائج المعروضة.
   * المحافظة والمادة تتم فلترتهما من السيرفر.
   */
  readonly filteredBatches = computed(() => {

    const q = this.search().trim().toLowerCase();

    if (!q) {
      return this.batches();
    }

    return this.batches().filter(b =>
      [
        b.label,
        b.subject,
        b.governorate,
        b.round
      ].some(v =>
        (v ?? '').toLowerCase().includes(q)
      )
    );
  });

  readonly total = computed(
    () => this.filteredBatches().length
  );

  readonly totalPending = computed(
    () =>
      this.filteredBatches().reduce(
        (total, batch) => total + batch.pendingCommittees,
        0
      )
  );

  // ==========================================
  // Pagination
  // ==========================================

  readonly pageSize = signal(6);

  readonly currentPage = signal(1);

  readonly totalPages = computed(() =>
    Math.max(
      1,
      Math.ceil(this.total() / this.pageSize())
    )
  );

  readonly pageBatches = computed(() => {

    const page = Math.min(
      this.currentPage(),
      this.totalPages()
    );

    const start = (page - 1) * this.pageSize();

    return this.filteredBatches().slice(
      start,
      start + this.pageSize()
    );
  });

  readonly paginationPages = computed<(number | 'dots')[]>(() => {

    const total = this.totalPages();

    const current = this.currentPage();

    if (total <= 4) {
      return Array.from(
        { length: total },
        (_, i) => i + 1
      );
    }

    if (current <= 2) {
      return [1, 2, 3, 'dots', total];
    }

    if (current >= total - 1) {
      return [
        1,
        'dots',
        total - 2,
        total - 1,
        total
      ];
    }

    return [
      1,
      'dots',
      current,
      'dots',
      total
    ];
  });

  readonly paginationStart = computed(() =>
    this.total() === 0
      ? 0
      : (this.currentPage() - 1) * this.pageSize() + 1
  );

  readonly paginationEnd = computed(() =>
    Math.min(
      this.currentPage() * this.pageSize(),
      this.total()
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

  // ==========================================
  // Batch card helpers
  // ==========================================

  statusLabel(status: string): string {

    switch (status) {

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

    return batch.status === 'InProgress'
      ? 'warning'
      : 'info';
  }

  trackBatch = (_: number, b: PrintingBatch) => b.id;

  trackCommittee = (_: number, c: PrintingCommittee) => c.id;

  // ==========================================
  // Committees Dialog
  // ==========================================

  committeesDialogVisible = false;

  readonly activeBatch = signal<PrintingBatch | null>(null);

  readonly committees = signal<PrintingCommittee[]>([]);

  readonly committeesLoading = signal(false);

  readonly committeesError = signal('');

  readonly dialogSearch = signal('');

  readonly totals = computed(
    () => sum(this.committees())
  );

  readonly dialogRows = computed(() => {

    const q = this.dialogSearch().trim();

    return q
      ? this.committees().filter(c =>
          c.committeeNumber.includes(q)
        )
      : this.committees();
  });

  openCommittees(batch: PrintingBatch): void {

    this.activeBatch.set(batch);

    this.committees.set([]);

    this.dialogSearch.set('');

    this.selectedIds.set(new Set());

    this.printError.set('');

    this.finishedAll.set(false);

    this.committeesDialogVisible = true;

    this.loadCommittees();
  }

  loadCommittees(silent = false): void {

    const batch = this.activeBatch();

    if (!batch) {
      return;
    }

    if (!silent) {
      this.committeesLoading.set(true);
    }

    this.committeesError.set('');

    this.printingService.getCommittees(batch.id).subscribe({

      next: list => {

        this.committees.set(list);

        this.committeesLoading.set(false);

        const ids = new Set(
          list.map(c => c.id)
        );

        this.selectedIds.update(set =>
          new Set(
            [...set].filter(id => ids.has(id))
          )
        );
      },

      error: (error: unknown) => {

        console.error('Failed to load committees:', error);

        this.committeesError.set(
          errorMessage(
            error,
            'تعذر تحميل اللجان. حاول مرة أخرى.'
          )
        );

        this.committeesLoading.set(false);
      }

    });
  }

  closeCommittees(): void {

    this.committeesDialogVisible = false;

    this.activeBatch.set(null);

    this.committees.set([]);

    this.selectedIds.set(new Set());

    this.committeesError.set('');

    this.printError.set('');

    this.finishedAll.set(false);
  }

  // ==========================================
  // Multi Selection
  // ==========================================

  readonly selectedIds = signal<Set<number>>(new Set());

  readonly selectedCommittees = computed(() =>
    this.committees().filter(
      c => this.selectedIds().has(c.id)
    )
  );

  readonly selectedCount = computed(
    () => this.selectedIds().size
  );

  readonly selectedTotals = computed(
    () => sum(this.selectedCommittees())
  );

  readonly allSelected = computed(() => {

    const list = this.dialogRows();

    return (
      list.length > 0 &&
      list.every(c =>
        this.selectedIds().has(c.id)
      )
    );
  });

  readonly someSelected = computed(
    () =>
      this.selectedCount() > 0 &&
      !this.allSelected()
  );

  isSelected(c: PrintingCommittee): boolean {
    return this.selectedIds().has(c.id);
  }

  toggleRow(c: PrintingCommittee): void {

    if (this.printSubmitting()) {
      return;
    }

    this.selectedIds.update(set => {

      const next = new Set(set);

      next.has(c.id)
        ? next.delete(c.id)
        : next.add(c.id);

      return next;
    });
  }

  toggleAll(): void {

    const list = this.dialogRows();

    this.selectedIds.update(set => {

      const next = new Set(set);

      if (this.allSelected()) {

        list.forEach(c => next.delete(c.id));

      } else {

        list.forEach(c => next.add(c.id));

      }

      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
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

  readonly finishedAll = signal(false);

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

  const committeeIds = [
    ...this.selectedIds()
  ];

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

        this.confirmDialogVisible = false;
        this.clearSelection();

        // إعادة تحميل اللجان بعد تسجيل انتهاء الطباعة
        this.printingService
          .getCommittees(batch.id)
          .subscribe({

            next: list => {

              this.committees.set(list);

              this.committeesLoading.set(false);
              this.printSubmitting.set(false);

              // لو مفيش أي لجان متبقية، نقفل الدايلوج
              if (list.length === 0) {

                this.closeCommittees();

              } else {

                // لسه فيه لجان قيد الطباعة
                this.finishedAll.set(false);

              }

              // تحديث البطاقات الرئيسية
              this.loadBatches(true);
            },

            error: (error: unknown) => {

              console.error(
                'Failed to reload committees:',
                error
              );

              this.printSubmitting.set(false);

              this.loadCommittees(true);

              this.loadBatches(true);
            }

          });

      },

      error: (error: unknown) => {

        console.error(
          'Failed to register printing:',
          error
        );

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
