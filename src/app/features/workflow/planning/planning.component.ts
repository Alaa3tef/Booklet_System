import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError } from 'rxjs';

import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { Lookups } from '../../../shared/services/lookups';
import { CommitteeService } from '../../committee-setup/service/committee-service';
import {
  PlanningService,
  PlanningBatch,
  BatchDetails,
  GovernorateDeliveryReadiness,
  DeliveryOrderReadiness,
  DeliveryOrdersGovernoratesQuery
} from './service/planning-batch';

interface SelectOption {
  label: string;
  value: string | number;
}

type StepState = 'done' | 'current' | 'pending' | 'rejected';

function todayAsDateInput(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    InputTextModule,
    DialogModule,
    ButtonModule,
    TextareaModule,
    TooltipModule,
    TableModule,
    WorkflowStepLayoutComponent
  ],
  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss'
})
export default class PlanningComponent implements OnInit {
  private readonly lookupService = inject(Lookups);
  private readonly committeeService = inject(CommitteeService);
  private readonly planningService = inject(PlanningService);
  private readonly messageService = inject(MessageService);

  readonly essentials = [
    'البحث بالمحافظة والمادة',
    'تحديد دفعات المواد للاعتماد',
    'جاهزية أوامر التوزيع بالمحافظات',
    'عرض تفاصيل لجان الدفعة'
  ];

  // ==========================================
  // TABS ('materials' | 'delivery-orders')
  // ==========================================
  readonly activeTab = signal<'materials' | 'delivery-orders'>('materials');
  private deliveryLookupsLoaded = false;
  readonly deliveryLookupsLoading = signal(false);

  setTab(tab: 'materials' | 'delivery-orders'): void {
    this.activeTab.set(tab);
    if (tab === 'delivery-orders') {
      if (!this.deliveryLookupsLoaded && !this.deliveryLookupsLoading()) {
        this.loadDeliveryLookups();
      } else if (this.deliveryLookupsLoaded && !this.deliveryLoading()) {
        this.loadDeliveryGovernorates();
      }
    }
  }

  // ==========================================
  // LOOKUPS
  // ==========================================
  readonly governorates = signal<SelectOption[]>([{ label: 'كل المحافظات', value: 'all' }]);
  readonly subjects = signal<SelectOption[]>([{ label: 'كل المواد', value: 'all' }]);
  readonly rounds = signal<SelectOption[]>([{ label: 'كل الأدوار', value: 'all' }]);
  readonly educationalStages = signal<SelectOption[]>([{ label: 'كل المراحل', value: 'all' }]);
  readonly lookupsLoading = signal(false);

  readonly eligibleOptions: SelectOption[] = [
    { label: 'كل المحافظات', value: 'all' },
    { label: 'المؤهلة فقط (جاهزة للتوزيع)', value: 'true' },
    { label: 'غير المؤهلة', value: 'false' }
  ];

  // ==========================================
  // TAB 1: MATERIALS / BATCHES (دفعات المواد)
  // ==========================================
  readonly batches = signal<PlanningBatch[]>([]);
  readonly batchesLoading = signal(false);
  readonly approvingBatches = signal(false);

  readonly searchGovernorate = signal<string | number>('all');
  readonly searchSubject = signal<string | number>('all');
  readonly searchBatchQuery = signal('');

  private readonly selectedBatchIds = signal<Set<number>>(new Set<number>());

  readonly filteredBatches = computed(() => {
    const query = this.searchBatchQuery().trim().toLowerCase();
    const list = this.batches();
    if (!query) return list;
    return list.filter(b =>
      b.batchName?.toLowerCase().includes(query) ||
      String(b.batchId).includes(query) ||
      b.roundName?.toLowerCase().includes(query) ||
      b.statusNameAr?.toLowerCase().includes(query)
    );
  });

  readonly selectedBatches = computed(() =>
    this.filteredBatches().filter(b => this.selectedBatchIds().has(b.batchId))
  );

  readonly selectedCount = computed(() => this.selectedBatchIds().size);

  readonly allSelected = computed(() =>
    this.filteredBatches().length > 0 &&
    this.filteredBatches().every(b => this.selectedBatchIds().has(b.batchId))
  );

  readonly someSelected = computed(() =>
    this.selectedCount() > 0 && !this.allSelected()
  );

  isSelected(batch: PlanningBatch): boolean {
    return this.selectedBatchIds().has(batch.batchId);
  }

  toggleBatch(batch: PlanningBatch): void {
    this.selectedBatchIds.update(current => {
      const next = new Set(current);
      if (next.has(batch.batchId)) next.delete(batch.batchId);
      else next.add(batch.batchId);
      return next;
    });
  }

  toggleAll(): void {
    if (this.allSelected()) {
      this.clearSelection();
      return;
    }
    const next = new Set(this.selectedBatchIds());
    this.filteredBatches().forEach(b => next.add(b.batchId));
    this.selectedBatchIds.set(next);
  }

  clearSelection(): void {
    this.selectedBatchIds.set(new Set<number>());
  }

  approveSelectedBatches(): void {
    const batchIds = [...this.selectedBatchIds()];
    if (batchIds.length === 0 || this.approvingBatches()) return;

    this.approvingBatches.set(true);
    this.planningService.sendBatchesToPreQuality(batchIds).subscribe({
      next: response => {
        this.approvingBatches.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'تم الاعتماد',
          detail: response?.message || 'تم إرسال الدفعات إلى مرحلة ما قبل الجودة',
          life: 3000
        });
        this.clearSelection();
        this.loadBatches();
      },
      error: error => {
        this.approvingBatches.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ',
          detail: error?.error?.message || error?.message || 'فشل إرسال الدفعات إلى مرحلة ما قبل الجودة',
          life: 4000
        });
      }
    });
  }

  // ==========================================
  // PAGINATION FOR BATCHES
  // ==========================================
  readonly pageSize = signal(6);
  readonly currentPage = signal(1);

  readonly pageSizeOptions = [
    { label: '6', value: 6 },
    { label: '12', value: 12 },
    { label: '24', value: 24 },
    { label: 'الكل', value: 0 }
  ];

  readonly showAll = computed(() => this.pageSize() === 0);

  readonly totalPages = computed(() =>
    this.showAll()
      ? 1
      : Math.max(1, Math.ceil(this.filteredBatches().length / this.pageSize()))
  );

  readonly paginatedBatches = computed(() => {
    if (this.showAll()) return this.filteredBatches();
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize();
    return this.filteredBatches().slice(start, start + this.pageSize());
  });

  readonly paginationStart = computed(() => {
    if (this.filteredBatches().length === 0) return 0;
    return this.showAll() ? 1 : (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly paginationEnd = computed(() =>
    this.showAll()
      ? this.filteredBatches().length
      : Math.min(this.currentPage() * this.pageSize(), this.filteredBatches().length)
  );

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

  private resetPage(): void {
    this.currentPage.set(1);
  }

  onPageSizeChange(): void {
    this.resetPage();
  }

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) this.currentPage.set(p);
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  // Active filters helper
  readonly activeFilters = computed(() => {
    const list: { key: string; title: string; value: string }[] = [];
    const gov = this.labelOf(this.governorates(), this.searchGovernorate());
    const sub = this.labelOf(this.subjects(), this.searchSubject());
    const query = this.searchBatchQuery().trim();

    if (gov) list.push({ key: 'governorate', title: 'المحافظة', value: gov });
    if (sub) list.push({ key: 'subject', title: 'المادة', value: sub });
    if (query) list.push({ key: 'query', title: 'اسم/رقم الدفعة', value: query });
    return list;
  });

  removeFilter(key: string): void {
    if (key === 'governorate') this.searchGovernorate.set('all');
    if (key === 'subject') this.searchSubject.set('all');
    if (key === 'query') this.searchBatchQuery.set('');
    this.resetPage();
    this.loadBatches();
  }

  clearFilters(): void {
    this.searchGovernorate.set('all');
    this.searchSubject.set('all');
    this.searchBatchQuery.set('');
    this.resetPage();
    this.loadBatches();
  }

  setGovernorate(v: string | number): void {
    this.searchGovernorate.set(v ?? 'all');
    this.resetPage();
    this.loadBatches();
  }

  setSubject(v: string | number): void {
    this.searchSubject.set(v ?? 'all');
    this.resetPage();
    this.loadBatches();
  }

  setBatchQuery(v: string): void {
    this.searchBatchQuery.set(v ?? '');
    this.resetPage();
  }

  private labelOf(options: SelectOption[], value: string | number): string | null {
    if (value === 'all') return null;
    return options.find(o => o.value === value)?.label ?? null;
  }

  // ==========================================
  // TAB 2: DELIVERY ORDERS / GOVERNORATES
  // ==========================================
  readonly deliveryGovernorates = signal<GovernorateDeliveryReadiness[]>([]);
  readonly deliveryLoading = signal(false);

  readonly deliveryRoundId = signal<string | number>('all');
  readonly deliveryEligibleFilter = signal<string>('all');
  readonly createDeliveryYear = signal<number | null>(null);
  readonly createDeliveryRoundId = signal<string | number>('all');
  readonly createDeliveryEducationalStageId = signal<string | number>('all');
  readonly deliveryDate = signal(todayAsDateInput());
  readonly deliveryOrderDialogVisible = signal(false);
  readonly pendingDeliveryGovernorate = signal<GovernorateDeliveryReadiness | null>(null);
  readonly deliveryReadinessLoading = signal(false);
  readonly deliveryReadinessError = signal('');
  readonly deliveryCreateValidationError = signal('');
  readonly creatingDeliveryFor = signal<number | null>(null);
  readonly createdDeliveryOrders = signal<Record<number, boolean>>({});

  // ---------- reasons (blocking reasons + failed-create errors) ----------
  readonly deliveryErrors = signal<Record<number, string[]>>({});
  readonly reasonsDialogVisible = signal(false);
  readonly reasonsDialogGovernorate = signal<GovernorateDeliveryReadiness | null>(null);

  readonly reasonsDialogList = computed(() => {
    const gov = this.reasonsDialogGovernorate();
    if (!gov) return [];
    // read the signal so the list stays in sync with new errors
    this.deliveryErrors();
    return this.getReasons(gov);
  });

  /** blocking reasons from the API + errors from a failed create attempt */
  getReasons(gov: GovernorateDeliveryReadiness): string[] {
    const blocking = gov.blockingReasons ?? [];
    const failed = this.deliveryErrors()[gov.governorateId] ?? [];
    return [...new Set([...blocking, ...failed].filter(r => !!r?.trim()))];
  }

  /** an order was created in this session */
  hasOrder(gov: GovernorateDeliveryReadiness): boolean {
    return !!this.createdDeliveryOrders()[gov.governorateId];
  }

  /** error state = there are reasons and no successfully created order */
  hasError(gov: GovernorateDeliveryReadiness): boolean {
    return !this.hasOrder(gov) && this.getReasons(gov).length > 0;
  }

  openReasonsDialog(gov: GovernorateDeliveryReadiness): void {
    this.reasonsDialogGovernorate.set(gov);
    this.reasonsDialogVisible.set(true);
  }

  closeReasonsDialog(): void {
    this.reasonsDialogVisible.set(false);
    this.reasonsDialogGovernorate.set(null);
  }

  /**
   * Handles every common error shape:
   * string, {message}, {detail}, {errors: []}, ASP.NET {errors: {Field: []}}, {title}
   */
  private extractErrorMessages(error: any): string[] {
    const body = error?.error;
    const out: string[] = [];

    const push = (v: unknown) => {
      if (typeof v === 'string' && v.trim()) out.push(v.trim());
    };

    if (typeof body === 'string') push(body);

    if (body && typeof body === 'object') {
      push(body.message);
      push(body.detail);
      const errs = body.errors;
      if (Array.isArray(errs)) {
        errs.forEach((e: any) => push(typeof e === 'string' ? e : e?.message ?? e?.description));
      } else if (errs && typeof errs === 'object') {
        Object.values(errs).forEach((v: any) => (Array.isArray(v) ? v : [v]).forEach(push));
      }
      if (!out.length) push(body.title);
    }

    if (!out.length) {
      if (error?.status === 0) push('تعذر الاتصال بالخادم، تحقق من الشبكة.');
      else if (error?.status === 403) push('ليست لديك صلاحية إنشاء أمر التوزيع.');
      else if (error?.status === 404) push('المحافظة أو البيانات المطلوبة غير موجودة.');
      else if (error?.status >= 500) push('حدث خطأ في الخادم، حاول مرة أخرى لاحقًا.');
      else push(error?.message || 'حدث خطأ أثناء إنشاء أمر التوزيع');
    }
    return [...new Set(out)];
  }

  // ---------- delivery pagination ----------
  readonly deliveryPageSize = signal(6);
  readonly deliveryCurrentPage = signal(1);
  readonly deliveryShowAll = computed(() => this.deliveryPageSize() === 0);

  readonly totalGovernoratesCount = computed(() => this.deliveryGovernorates().length);
  readonly eligibleGovernoratesCount = computed(
    () => this.deliveryGovernorates().filter(g => g.canCreate).length
  );
  readonly totalBatchesSum = computed(() =>
    this.deliveryGovernorates().reduce((sum, g) => sum + (g.totalBatches || 0), 0)
  );
  readonly storedBatchesSum = computed(() =>
    this.deliveryGovernorates().reduce((sum, g) => sum + (g.storedBatches || 0), 0)
  );
  readonly totalCommitteesSum = computed(() =>
    this.deliveryGovernorates().reduce((sum, g) => sum + (g.totalCommittees || 0), 0)
  );
  readonly totalBoxesSum = computed(() =>
    this.deliveryGovernorates().reduce((sum, g) => sum + (g.totalBoxes || 0), 0)
  );

  // Filtered governorates view
  readonly filteredDeliveryGovernorates = computed(() => {
    const list = this.deliveryGovernorates();
    const eligibleFilter = this.deliveryEligibleFilter();
    if (eligibleFilter === 'true') {
      return list.filter(g => g.canCreate);
    }
    if (eligibleFilter === 'false') {
      return list.filter(g => !g.canCreate);
    }
    return list;
  });

  readonly deliveryTotalPages = computed(() =>
    this.deliveryShowAll()
      ? 1
      : Math.max(1, Math.ceil(this.filteredDeliveryGovernorates().length / this.deliveryPageSize()))
  );
  readonly paginatedDeliveryGovernorates = computed(() => {
    if (this.deliveryShowAll()) return this.filteredDeliveryGovernorates();
    const page = Math.min(this.deliveryCurrentPage(), this.deliveryTotalPages());
    const start = (page - 1) * this.deliveryPageSize();
    return this.filteredDeliveryGovernorates().slice(start, start + this.deliveryPageSize());
  });
  readonly deliveryPaginationStart = computed(() =>
    this.filteredDeliveryGovernorates().length === 0
      ? 0
      : this.deliveryShowAll() ? 1 : (this.deliveryCurrentPage() - 1) * this.deliveryPageSize() + 1
  );
  readonly deliveryPaginationEnd = computed(() =>
    this.deliveryShowAll()
      ? this.filteredDeliveryGovernorates().length
      : Math.min(this.deliveryCurrentPage() * this.deliveryPageSize(), this.filteredDeliveryGovernorates().length)
  );
  readonly deliveryPaginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.deliveryTotalPages();
    const current = Math.min(this.deliveryCurrentPage(), total);
    const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
    const sorted = [...wanted].filter(page => page >= 1 && page <= total).sort((a, b) => a - b);
    const pages: (number | 'dots')[] = [];
    sorted.forEach((page, index) => {
      if (index > 0 && page - sorted[index - 1] > 1) pages.push('dots');
      pages.push(page);
    });
    return pages;
  });

  resetDeliveryPage(): void {
    this.deliveryCurrentPage.set(1);
  }

  goToDeliveryPage(page: number): void {
    if (page >= 1 && page <= this.deliveryTotalPages()) {
      this.deliveryCurrentPage.set(page);
    }
  }

  openDeliveryOrderDialog(governorate: GovernorateDeliveryReadiness): void {
    if (!governorate.canCreate || this.creatingDeliveryFor() !== null) return;
    this.pendingDeliveryGovernorate.set(governorate);
    this.createDeliveryYear.set(null);
    this.createDeliveryRoundId.set('all');
    this.createDeliveryEducationalStageId.set('all');
    this.deliveryDate.set(todayAsDateInput());
    this.deliveryReadinessError.set('');
    this.deliveryCreateValidationError.set('');
    this.deliveryOrderDialogVisible.set(true);
    this.loadDeliveryOrderReadiness(governorate.governorateId);
  }

  loadDeliveryOrderReadiness(governorateId: number): void {
    this.deliveryReadinessLoading.set(true);
    this.deliveryReadinessError.set('');

    this.planningService.getDeliveryOrderReadiness(governorateId).subscribe({
      next: response => {
        const envelope = response as any;
        const readiness = (envelope?.data?.data ?? envelope?.data) as DeliveryOrderReadiness | null;
        this.deliveryReadinessLoading.set(false);

        if (!readiness) {
          this.deliveryReadinessError.set('لم تصل بيانات الجاهزية لهذه المحافظة. أعد المحاولة.');
          return;
        }

        this.pendingDeliveryGovernorate.set(readiness);
        this.createDeliveryYear.set(readiness.year ?? null);
        this.createDeliveryRoundId.set(readiness.roundId ?? 'all');
        this.createDeliveryEducationalStageId.set(readiness.educationalStageId ?? 'all');
      },
      error: error => {
        this.deliveryReadinessLoading.set(false);
        this.deliveryReadinessError.set(
          this.extractErrorMessages(error)[0] || 'تعذر تحميل بيانات الجاهزية. أعد المحاولة.'
        );
      }
    });
  }

  closeDeliveryOrderDialog(): void {
    if (this.creatingDeliveryFor() !== null) return;
    this.deliveryOrderDialogVisible.set(false);
    this.pendingDeliveryGovernorate.set(null);
  }

  clearDeliveryCreateValidationError(): void {
    this.deliveryCreateValidationError.set('');
  }

  createDeliveryOrder(): void {
    const governorate = this.pendingDeliveryGovernorate();
    const year = this.createDeliveryYear();
    const roundId = Number(this.createDeliveryRoundId());
    const educationalStageId = Number(this.createDeliveryEducationalStageId());

    if (!governorate?.canCreate || this.creatingDeliveryFor() !== null) return;
    if (!year || year <= 0 || !roundId || roundId <= 0 || !educationalStageId || educationalStageId <= 0 || !this.deliveryDate()) {
      this.deliveryCreateValidationError.set('أكمل السنة والدور والمرحلة التعليمية وتاريخ التوريد قبل إنشاء الأمر.');
      this.messageService.add({
        severity: 'warn',
        summary: 'بيانات مطلوبة',
        detail: this.deliveryCreateValidationError(),
        life: 3500
      });
      return;
    }

    this.deliveryCreateValidationError.set('');

    const governorateId = governorate.governorateId;
    this.creatingDeliveryFor.set(governorateId);
    this.planningService.createDeliveryOrder({
      year,
      roundId,
      educationalStageId,
      governorateId,
      deliveryDate: this.deliveryDate()
    }).subscribe({
      next: response => {
        this.creatingDeliveryFor.set(null);
        this.deliveryOrderDialogVisible.set(false);
        this.pendingDeliveryGovernorate.set(null);

        // clear old errors for this governorate
        this.deliveryErrors.update(errors => {
          const { [governorateId]: _removed, ...rest } = errors;
          return rest;
        });

        if (response?.success) {
          this.createdDeliveryOrders.update(orders => ({
            ...orders,
            [governorateId]: true
          }));
        }
        this.messageService.add({
          severity: 'success',
          summary: 'تم إنشاء أمر التوزيع',
          detail: response?.message || 'تم إنشاء أمر التوزيع بنجاح',
          life: 3500
        });
        this.loadDeliveryGovernorates();
      },
      error: error => {
        this.creatingDeliveryFor.set(null);
        const reasons = this.extractErrorMessages(error);
        this.deliveryErrors.update(errors => ({ ...errors, [governorateId]: reasons }));
        this.createdDeliveryOrders.update(orders => {
          const { [governorateId]: _removed, ...rest } = orders;
          return rest;
        });
        this.deliveryOrderDialogVisible.set(false);
        this.pendingDeliveryGovernorate.set(null);
        this.messageService.add({
          severity: 'error',
          summary: 'تعذر إنشاء أمر التوزيع',
          detail: reasons[0],
          life: 4000
        });
      }
    });
  }

  // ==========================================
  // BATCH DETAILS DIALOG
  // ==========================================
  batchDetailsDialogVisible = false;
  batchDetailsLoading = false;
  selectedBatchDetails: BatchDetails | null = null;

  openBatchDetails(batchId: number): void {
    this.batchDetailsDialogVisible = true;
    this.batchDetailsLoading = true;
    this.selectedBatchDetails = null;

    this.planningService.getBatchDetails(batchId).subscribe({
      next: res => {
        const raw = res as any;
        const data = raw?.data?.data ?? raw?.data ?? raw;
        if (data && !data.committees) {
          data.committees = [];
        }
        this.selectedBatchDetails = data;
        this.batchDetailsLoading = false;
      },
      error: err => {
        console.error('Error loading batch details:', err);
        this.batchDetailsLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ',
          detail: err.error?.message || 'فشل تحميل تفاصيل الدفعة',
          life: 3000
        });
      }
    });
  }

  closeBatchDetails(): void {
    this.batchDetailsDialogVisible = false;
    this.selectedBatchDetails = null;
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================
  ngOnInit(): void {
    this.loadLookups();
    this.loadBatches();
  }

  /**
   * Helper to robustly extract an Array from any API response structure.
   */
  private extractLookupArray(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;

    const possibleKeys = ['data', 'items', 'result', 'results', 'records', 'value'];
    for (const key of possibleKeys) {
      const val = response[key];
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object') {
        const nested = this.extractLookupArray(val);
        if (nested.length > 0) return nested;
      }
    }
    return [];
  }

  /**
   * Maps an array of lookup objects to SelectOption items with numeric value and Arabic label.
   */
  private mapToOptions(
    rawList: any[],
    defaultLabel: string,
    idKeys: string[] = ['id', 'roundId', 'educationalStageId', 'governorateId', 'subjectId', 'code', 'value']
  ): SelectOption[] {
    const options: SelectOption[] = [{ label: defaultLabel, value: 'all' }];
    if (!Array.isArray(rawList)) return options;

    rawList.forEach((item: any) => {
      if (!item) return;

      // Extract ID / Value
      let value: number | string | null = null;
      for (const k of idKeys) {
        if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
          const num = Number(item[k]);
          value = !isNaN(num) && num > 0 ? num : item[k];
          break;
        }
      }

      // Extract Label
      const nameKeys = ['nameAr', 'arabicName', 'name', 'title', 'roundName', 'governorateName', 'subjectName', 'stageName', 'label'];
      let label: string | null = null;
      for (const k of nameKeys) {
        if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
          label = String(item[k]).trim();
          break;
        }
      }

      if (value != null && label) {
        options.push({ label, value });
      }
    });

    return options;
  }

  loadLookups(): void {
    this.lookupsLoading.set(true);

    forkJoin({
      governorates: this.lookupService.getLookupGovernorateData().pipe(
        catchError(e => {
          console.error('Gov lookup err:', e);
          return of([]);
        })
      ),
      subjects: this.lookupService.getLookupSubjectData().pipe(
        catchError(e => {
          console.error('Subject lookup err:', e);
          return of([]);
        })
      )
    }).subscribe({
      next: ({ governorates, subjects }) => {
        this.governorates.set(this.mapToOptions(this.extractLookupArray(governorates), 'كل المحافظات'));
        this.subjects.set(this.mapToOptions(this.extractLookupArray(subjects), 'كل المواد'));
        this.lookupsLoading.set(false);
      },
      error: err => {
        console.error('Error loading materials lookups:', err);
        this.lookupsLoading.set(false);
      }
    });
  }

  private loadDeliveryLookups(): void {
    this.deliveryLookupsLoading.set(true);

    forkJoin({
      rounds: this.committeeService.getRounds().pipe(
        catchError(e => {
          console.error('Rounds lookup err:', e);
          return of([]);
        })
      ),
      stages: this.committeeService.getEducationstages().pipe(
        catchError(e => {
          console.error('Stages lookup err:', e);
          return of([]);
        })
      )
    }).subscribe({
      next: ({ rounds, stages }) => {
        const rList = this.extractLookupArray(rounds);
        const stList = this.extractLookupArray(stages);

        const rOpts = this.mapToOptions(rList, 'اختر الدور');
        const stOpts = this.mapToOptions(stList, 'كل المراحل التعليمية');

        this.rounds.set(rOpts);
        this.educationalStages.set(stOpts);

        const firstRound = rOpts.find(r => r.value !== 'all');
        if (firstRound && (this.deliveryRoundId() === 'all' || !this.deliveryRoundId())) {
          this.deliveryRoundId.set(firstRound.value);
        }

        this.deliveryLookupsLoaded = rOpts.length > 1 && stOpts.length > 1;
        this.deliveryLookupsLoading.set(false);

        if (this.activeTab() === 'delivery-orders') {
          this.loadDeliveryGovernorates();
        }
      },
      error: err => {
        console.error('Error loading delivery lookups:', err);
        this.deliveryLookupsLoading.set(false);
      }
    });
  }

  /**
   * GET api/Planning/batches/for-approve?GovernorateId=&SubjectId=
   */
  loadBatches(): void {
    this.batchesLoading.set(true);

    const govVal = this.searchGovernorate();
    const subVal = this.searchSubject();

    const govId = govVal !== 'all' && Number(govVal) > 0 ? Number(govVal) : undefined;
    const subId = subVal !== 'all' && Number(subVal) > 0 ? Number(subVal) : undefined;

    this.planningService.getBatchesForApprove(govId, subId).subscribe({
      next: res => {
        const list = this.extractLookupArray(res);
        this.batches.set(list);
        this.batchesLoading.set(false);
      },
      error: err => {
        console.error('Error loading planning batches:', err);
        this.batchesLoading.set(false);
        this.batches.set([]);
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ',
          detail: err.error?.message || 'فشل تحميل دفعات التخطيط الجاهزة للاعتماد',
          life: 3000
        });
      }
    });
  }

  /**
   * GET api/Planning/delivery-orders/governorates
   * Query params: Year, RoundId, EducationalStageId, OnlyEligible
   */
  loadDeliveryGovernorates(): void {
    const roundVal = this.deliveryRoundId();

    // RoundId is mandatory for the backend! If not set, pick the first valid round or wait
    let validRoundId: number | undefined;
    if (roundVal && roundVal !== 'all' && Number(roundVal) > 0) {
      validRoundId = Number(roundVal);
    } else {
      const firstRound = this.rounds().find(r => r.value !== 'all');
      if (firstRound && Number(firstRound.value) > 0) {
        validRoundId = Number(firstRound.value);
        this.deliveryRoundId.set(validRoundId);
      }
    }

    if (!validRoundId) {
      // No round chosen yet, do not trigger 400 error
      this.deliveryGovernorates.set([]);
      this.resetDeliveryPage();
      return;
    }

    this.deliveryLoading.set(true);

    const eligibleVal = this.deliveryEligibleFilter();

    const query: DeliveryOrdersGovernoratesQuery = {
      roundId: validRoundId,
      onlyEligible: eligibleVal === 'true' ? true : eligibleVal === 'false' ? false : undefined
    };

    this.planningService.getDeliveryOrdersGovernorates(query).subscribe({
      next: res => {
        const list = this.extractLookupArray(res);
        this.deliveryGovernorates.set(list);
        this.resetDeliveryPage();
        this.deliveryLoading.set(false);
      },
      error: err => {
        console.error('Error loading delivery governorates:', err);
        this.deliveryLoading.set(false);
        this.deliveryGovernorates.set([]);
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ',
          detail: this.extractErrorMessages(err)[0] || 'فشل تحميل بيانات أوامر التوزيع بالمحافظات',
          life: 3000
        });
      }
    });
  }

  // Helper for batch tracker steps
  trackerSteps(batch: PlanningBatch): { label: string; state: StepState }[] {
    return [
      { label: batch.statusNameAr || 'بانتظار التخطيط', state: 'current' },
      { label: batch.nextStatusNameAr || 'بانتظار اعتماد الطباعة', state: 'pending' }
    ];
  }

  // Calculate storage completion percentage for governorates
  getStoredProgress(gov: GovernorateDeliveryReadiness): number {
    if (!gov.totalBatches || gov.totalBatches <= 0) return 0;
    return Math.min(100, Math.round(((gov.storedBatches || 0) / gov.totalBatches) * 100));
  }
}
