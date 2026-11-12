import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
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
  BatchCommittee,
  GovernorateDeliveryReadiness,
  DeliveryOrderReadiness,
  DeliveryOrdersGovernoratesQuery
} from './service/planning-batch';

interface SelectOption {
  label: string;
  value: string | number;
}

type StepState = 'done' | 'current' | 'pending' | 'rejected';
type TabKey = 'materials' | 'delivery-orders';

function todayAsDateInput(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/** يبني أرقام الصفحات مع النقاط (1 ... 4 5 6 ... 20) */
function buildPages(total: number, currentPage: number): (number | 'dots')[] {
  const cur = Math.min(Math.max(1, currentPage), total);
  const wanted = new Set<number>([1, total, cur - 1, cur, cur + 1]);
  const sorted = [...wanted].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const pages: (number | 'dots')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) pages.push('dots');
    pages.push(p);
  });
  return pages;
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
export default class PlanningComponent implements OnInit, OnDestroy {
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
  // TABS — دفعات المواد نشطة في الأول
  // ==========================================
  readonly activeTab = signal<TabKey>('materials');
  private deliveryLookupsLoaded = false;
  readonly deliveryLookupsLoading = signal(false);

  /** كل ضغطة على تاب بتنده الـ endpoint بتاعه */
  setTab(tab: TabKey): void {
    this.activeTab.set(tab);

    if (tab === 'materials') {
      this.resetPage();
      this.loadBatches();
      return;
    }

    // delivery-orders: الـ endpoint فورًا، والـ lookups (أدوار/مراحل) بالتوازي
    if (!this.deliveryLookupsLoaded && !this.deliveryLookupsLoading()) {
      this.loadDeliveryLookups();
    }
    this.loadDeliveryGovernorates();
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
  // TAB 1: MATERIALS / BATCHES
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

  // ---------- pagination for batches (client-side) ----------
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

  readonly paginationPages = computed<(number | 'dots')[]>(() =>
    buildPages(this.totalPages(), this.currentPage())
  );

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

  // ---------- filters (server-side) ----------
  readonly deliverySearch = signal('');
  /** الرقم اللي بيتبعت للباك كـ Year (مثلاً 27) */
  readonly deliveryYear = signal<number | null>(null);
  /** النص اللي بيتكتب في الحقل */
  readonly deliveryYearInput = signal<string>('');
  /** المحافظة: بتتبعت للباك كـ GovernorateId (مثلاً 23) */
  readonly deliveryGovernorateId = signal<string | number>('all');
  readonly deliveryStageId = signal<string | number>('all');
  readonly deliverySort = signal<'none' | 'true' | 'false'>('none');

  private deliverySearchTimer: ReturnType<typeof setTimeout> | null = null;
  private deliveryRequestId = 0;

  readonly sortOptions: SelectOption[] = [
    { label: 'الترتيب الافتراضي', value: 'none' },
    { label: 'الاسم: من أ إلى ي', value: 'true' },
    { label: 'الاسم: من ي إلى أ', value: 'false' }
  ];

  readonly activeDeliveryFilters = computed(() => {
    const list: { key: string; title: string; value: string }[] = [];
    const term = this.deliverySearch().trim();
    const year = this.deliveryYear();
    const gov = this.labelOf(this.governorates(), this.deliveryGovernorateId());
    const round = this.labelOf(this.rounds(), this.deliveryRoundId());
    const stage = this.labelOf(this.educationalStages(), this.deliveryStageId());
    const eligible = this.deliveryEligibleFilter();

    if (term) list.push({ key: 'search', title: 'بحث', value: term });
    if (gov) list.push({ key: 'governorate', title: 'المحافظة', value: gov });
    if (year) list.push({ key: 'year', title: 'السنة', value: String(year) });
    if (round) list.push({ key: 'round', title: 'الدور', value: round });
    if (stage) list.push({ key: 'stage', title: 'المرحلة', value: stage });
    if (eligible !== 'all') {
      list.push({
        key: 'eligible',
        title: 'الجاهزية',
        value: eligible === 'true' ? 'المؤهلة فقط' : 'غير المؤهلة'
      });
    }
    if (this.deliverySort() !== 'none') {
      list.push({
        key: 'sort',
        title: 'الترتيب',
        value: this.deliverySort() === 'true' ? 'الاسم: من أ إلى ي' : 'الاسم: من ي إلى أ'
      });
    }
    return list;
  });

  /** بحث نصي بـ debounce */
  onDeliverySearch(value: string): void {
    this.deliverySearch.set(value ?? '');
    if (this.deliverySearchTimer) clearTimeout(this.deliverySearchTimer);
    this.deliverySearchTimer = setTimeout(() => {
      this.resetDeliveryPage();
      this.loadDeliveryGovernorates();
    }, 400);
  }

  /** السنة: أرقام بس، وبتتبعت زي ما هي كـ Year=27 */
  onDeliveryYearChange(value: string | number | null): void {
    const digits = String(value ?? '').replace(/\D/g, '').slice(0, 4);
    this.deliveryYearInput.set(digits);
    this.deliveryYear.set(digits ? Number(digits) : null);

    if (this.deliverySearchTimer) clearTimeout(this.deliverySearchTimer);
    this.deliverySearchTimer = setTimeout(() => {
      this.resetDeliveryPage();
      this.loadDeliveryGovernorates();
    }, 400);
  }

  onDeliveryFilterChange(): void {
    this.resetDeliveryPage();
    this.loadDeliveryGovernorates();
  }

  setDeliveryRound(v: string | number): void {
    this.deliveryRoundId.set(v ?? 'all');
    this.onDeliveryFilterChange();
  }

  setDeliveryGovernorate(v: string | number): void {
    this.deliveryGovernorateId.set(v ?? 'all');
    this.onDeliveryFilterChange();
  }

  setDeliveryStage(v: string | number): void {
    this.deliveryStageId.set(v ?? 'all');
    this.onDeliveryFilterChange();
  }

  setDeliveryEligible(v: string): void {
    this.deliveryEligibleFilter.set(v ?? 'all');
    this.onDeliveryFilterChange();
  }

  setDeliverySort(v: string): void {
    this.deliverySort.set(v === 'true' || v === 'false' ? v : 'none');
    this.onDeliveryFilterChange();
  }

  removeDeliveryFilter(key: string): void {
    if (key === 'search') this.deliverySearch.set('');
    if (key === 'governorate') this.deliveryGovernorateId.set('all');
    if (key === 'year') {
      this.deliveryYear.set(null);
      this.deliveryYearInput.set('');
    }
    if (key === 'round') this.deliveryRoundId.set('all');
    if (key === 'stage') this.deliveryStageId.set('all');
    if (key === 'eligible') this.deliveryEligibleFilter.set('all');
    if (key === 'sort') this.deliverySort.set('none');
    this.onDeliveryFilterChange();
  }

  clearDeliveryFilters(): void {
    this.deliverySearch.set('');
    this.deliveryGovernorateId.set('all');
    this.deliveryYear.set(null);
    this.deliveryYearInput.set('');
    this.deliveryRoundId.set('all');
    this.deliveryStageId.set('all');
    this.deliveryEligibleFilter.set('all');
    this.deliverySort.set('none');
    this.onDeliveryFilterChange();
  }

  // ---------- reasons ----------
  readonly deliveryErrors = signal<Record<number, string[]>>({});
  readonly reasonsDialogVisible = signal(false);
  readonly reasonsDialogGovernorate = signal<GovernorateDeliveryReadiness | null>(null);

  readonly reasonsDialogList = computed(() => {
    const gov = this.reasonsDialogGovernorate();
    if (!gov) return [];
    this.deliveryErrors();
    return this.getReasons(gov);
  });

  getReasons(gov: GovernorateDeliveryReadiness): string[] {
    const blocking = gov.blockingReasons ?? [];
    const failed = this.deliveryErrors()[gov.governorateId] ?? [];
    return [...new Set([...blocking, ...failed].filter(r => !!r?.trim()))];
  }

  hasOrder(gov: GovernorateDeliveryReadiness): boolean {
    return !!this.createdDeliveryOrders()[gov.governorateId];
  }

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

  // ---------- delivery pagination (server-side دايمًا) ----------
  readonly deliveryPageSize = signal(6);
  readonly deliveryCurrentPage = signal(1);

  readonly deliveryPageSizeOptions = [
    { label: '6', value: 6 },
    { label: '12', value: 12 },
    { label: '24', value: 24 },
    { label: '50', value: 50 }
  ];

  readonly deliveryTotalCount = signal(0);
  readonly deliveryTotalPagesFromApi = signal(1);

  readonly deliveryTotalPages = computed(() => Math.max(1, this.deliveryTotalPagesFromApi()));

  readonly deliveryPaginationStart = computed(() =>
    this.deliveryTotalCount() === 0
      ? 0
      : (this.deliveryCurrentPage() - 1) * this.deliveryPageSize() + 1
  );
  readonly deliveryPaginationEnd = computed(() =>
    Math.min(
      this.deliveryPaginationStart() + this.deliveryGovernorates().length - 1,
      this.deliveryTotalCount()
    )
  );
  readonly deliveryPaginationPages = computed<(number | 'dots')[]>(() =>
    buildPages(this.deliveryTotalPages(), this.deliveryCurrentPage())
  );

  // ---------- KPI (الإجمالي من الباك، والباقي من الصفحة الحالية) ----------
  readonly totalGovernoratesCount = computed(() => this.deliveryTotalCount());
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

  resetDeliveryPage(): void {
    this.deliveryCurrentPage.set(1);
  }

  goToDeliveryPage(page: number): void {
    if (page < 1 || page > this.deliveryTotalPages() || page === this.deliveryCurrentPage()) return;
    this.deliveryCurrentPage.set(page);
    this.loadDeliveryGovernorates();
  }

  onDeliveryPageSizeChange(size: number): void {
    this.deliveryPageSize.set(size);
    this.resetDeliveryPage();
    this.loadDeliveryGovernorates();
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

  private downloadDeliveryOrderPdf(deliveryOrderId: number, governorateName?: string | null): void {
    this.planningService.getDeliveryOrderLocationsPdf(deliveryOrderId).subscribe({
      next: blob => {
        try {
          const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `delivery-order-${deliveryOrderId}${governorateName ? '-' + governorateName : ''}-locations.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
          /* تجاهل */
        }
      },
      error: () => {
        /* تجاهل */
      }
    });
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

        this.deliveryErrors.update(errors => {
          const { [governorateId]: _removed, ...rest } = errors;
          return rest;
        });

        if (response?.success) {
          this.createdDeliveryOrders.update(orders => ({ ...orders, [governorateId]: true }));

          const deliveryOrderId = (response as any)?.data?.deliveryOrderId ?? response?.data?.deliveryOrderId;
          if (deliveryOrderId) {
            this.downloadDeliveryOrderPdf(deliveryOrderId, governorate.governorateName);
          }
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
  // BATCH DETAILS DIALOG (server-side pagination)
  // ==========================================
  batchDetailsDialogVisible = false;
  batchDetailsLoading = false;
  selectedBatchDetails: BatchDetails | null = null;

  private detailsBatchId: number | null = null;
  private detailsRequestId = 0;
  private detailsSearchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly detailsCommittees = signal<BatchCommittee[]>([]);
  readonly detailsTableLoading = signal(false);
  readonly detailsTotal = signal(0);
  readonly detailsPage = signal(1);
  readonly detailsPageSize = signal(5);
  readonly detailsSearch = signal('');

  readonly detailsPageSizeOptions = [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '50', value: 50 }
  ];

  readonly detailsTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.detailsTotal() / this.detailsPageSize()))
  );
  readonly detailsPaginationStart = computed(() =>
    this.detailsTotal() === 0 ? 0 : (this.detailsPage() - 1) * this.detailsPageSize() + 1
  );
  readonly detailsPaginationEnd = computed(() =>
    Math.min(this.detailsPage() * this.detailsPageSize(), this.detailsTotal())
  );
  readonly detailsPaginationPages = computed<(number | 'dots')[]>(() =>
    buildPages(this.detailsTotalPages(), this.detailsPage())
  );

  openBatchDetails(batchId: number): void {
    this.detailsBatchId = batchId;
    this.detailsPage.set(1);
    this.detailsPageSize.set(5);
    this.detailsSearch.set('');
    this.detailsCommittees.set([]);
    this.detailsTotal.set(0);

    this.batchDetailsDialogVisible = true;
    this.selectedBatchDetails = null;
    this.loadBatchDetails(true);
  }

  loadBatchDetails(initial = false): void {
    if (this.detailsBatchId == null) return;

    const requestId = ++this.detailsRequestId;
    if (initial) this.batchDetailsLoading = true;
    else this.detailsTableLoading.set(true);

    this.planningService.getBatchDetails(this.detailsBatchId, {
      pageNumber: this.detailsPage(),
      pageSize: this.detailsPageSize(),
      isPaged: true,
      searchTerm: this.detailsSearch()
    }).subscribe({
      next: res => {
        if (requestId !== this.detailsRequestId) return;

        const raw = res as any;
        const data = raw?.data?.data ?? raw?.data ?? raw;
        const { list, total } = this.normalizeCommittees(data);

        this.selectedBatchDetails = { ...data, committees: list } as BatchDetails;
        this.detailsCommittees.set(list);
        this.detailsTotal.set(total);

        this.batchDetailsLoading = false;
        this.detailsTableLoading.set(false);
      },
      error: err => {
        if (requestId !== this.detailsRequestId) return;
        console.error('Error loading batch details:', err);
        this.batchDetailsLoading = false;
        this.detailsTableLoading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ',
          detail: err?.error?.message || 'فشل تحميل تفاصيل الدفعة',
          life: 3000
        });
      }
    });
  }

  private normalizeCommittees(data: any): { list: BatchCommittee[]; total: number } {
    const fallbackTotal = Number(data?.totalCommittees) || 0;
    const source = data?.committees;

    if (Array.isArray(source)) {
      const total = Number(data?.totalCount ?? data?.totalRecords ?? data?.total ?? fallbackTotal) || source.length;
      return { list: source, total };
    }

    if (source && typeof source === 'object') {
      const list = this.extractLookupArray(source);
      const total = Number(
        source.totalCount ?? source.totalRecords ?? source.totalItems ?? source.total ?? source.count ?? fallbackTotal
      ) || list.length;
      return { list, total };
    }

    return { list: [], total: 0 };
  }

  onDetailsSearch(value: string): void {
    this.detailsSearch.set(value ?? '');
    if (this.detailsSearchTimer) clearTimeout(this.detailsSearchTimer);
    this.detailsSearchTimer = setTimeout(() => {
      this.detailsPage.set(1);
      this.loadBatchDetails();
    }, 400);
  }

  clearDetailsSearch(): void {
    this.onDetailsSearch('');
  }

  onDetailsPageSizeChange(size: number): void {
    this.detailsPageSize.set(size);
    this.detailsPage.set(1);
    this.loadBatchDetails();
  }

  goToDetailsPage(p: number): void {
    if (p < 1 || p > this.detailsTotalPages() || p === this.detailsPage()) return;
    this.detailsPage.set(p);
    this.loadBatchDetails();
  }

  closeBatchDetails(): void {
    if (this.detailsSearchTimer) clearTimeout(this.detailsSearchTimer);
    this.detailsRequestId++;
    this.batchDetailsDialogVisible = false;
    this.selectedBatchDetails = null;
    this.detailsBatchId = null;
    this.detailsCommittees.set([]);
  }

  // ==========================================
  // LIFECYCLE — تاب المواد بس
  // ==========================================
  ngOnInit(): void {
    this.loadLookups();   // محافظات + مواد
    this.loadBatches();   // endpoint دفعات المواد
  }

  ngOnDestroy(): void {
    if (this.deliverySearchTimer) clearTimeout(this.deliverySearchTimer);
    if (this.detailsSearchTimer) clearTimeout(this.detailsSearchTimer);
  }

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

  private mapToOptions(
    rawList: any[],
    defaultLabel: string,
    idKeys: string[] = ['id', 'roundId', 'educationalStageId', 'governorateId', 'subjectId', 'code', 'value']
  ): SelectOption[] {
    const options: SelectOption[] = [{ label: defaultLabel, value: 'all' }];
    if (!Array.isArray(rawList)) return options;

    rawList.forEach((item: any) => {
      if (!item) return;

      let value: number | string | null = null;
      for (const k of idKeys) {
        if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
          const num = Number(item[k]);
          value = !isNaN(num) && num > 0 ? num : item[k];
          break;
        }
      }

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

  /** الأدوار + المراحل (بالتوازي مع نداء الـ endpoint، ومش بيستنوا بعض) */
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
        const rOpts = this.mapToOptions(this.extractLookupArray(rounds), 'كل الأدوار');
        const stOpts = this.mapToOptions(this.extractLookupArray(stages), 'كل المراحل التعليمية');

        this.rounds.set(rOpts);
        this.educationalStages.set(stOpts);

        this.deliveryLookupsLoaded = rOpts.length > 1 && stOpts.length > 1;
        this.deliveryLookupsLoading.set(false);
      },
      error: err => {
        console.error('Error loading delivery lookups:', err);
        this.deliveryLookupsLoading.set(false);
      }
    });
  }

  /** GET api/Planning/batches/for-approve */
  loadBatches(): void {
    this.batchesLoading.set(true);

    const govVal = this.searchGovernorate();
    const subVal = this.searchSubject();

    const govId = govVal !== 'all' && Number(govVal) > 0 ? Number(govVal) : undefined;
    const subId = subVal !== 'all' && Number(subVal) > 0 ? Number(subVal) : undefined;

    this.planningService.getBatchesForApprove(govId, subId).subscribe({
      next: res => {
        this.batches.set(this.extractLookupArray(res));
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
   * كل الفلاتر اختيارية (RoundId مش إجباري). دايمًا PageNumber + PageSize + IsPaged=true
   */
  loadDeliveryGovernorates(): void {
    const roundVal = this.deliveryRoundId();
    const stageVal = this.deliveryStageId();
    const govVal = this.deliveryGovernorateId();
    const eligibleVal = this.deliveryEligibleFilter();
    const term = this.deliverySearch().trim();
    const sort = this.deliverySort();

    const query: DeliveryOrdersGovernoratesQuery = {
      roundId: roundVal !== 'all' && Number(roundVal) > 0 ? Number(roundVal) : undefined,
      year: this.deliveryYear() ?? undefined,
      governorateId: govVal !== 'all' && Number(govVal) > 0 ? Number(govVal) : undefined,
      educationalStageId: stageVal !== 'all' && Number(stageVal) > 0 ? Number(stageVal) : undefined,
      onlyEligible: eligibleVal === 'true' ? true : eligibleVal === 'false' ? false : undefined,
      searchTerm: term || undefined,
      sortBy: sort !== 'none' ? 'GovernorateName' : undefined,
      ascending: sort !== 'none' ? sort === 'true' : undefined,
      pageNumber: this.deliveryCurrentPage(),
      pageSize: this.deliveryPageSize(),
      isPaged: true
    };

    const requestId = ++this.deliveryRequestId;
    this.deliveryLoading.set(true);

    this.planningService.getDeliveryOrdersGovernorates(query).subscribe({
      next: res => {
        if (requestId !== this.deliveryRequestId) return;

        const page = (res as any)?.data;
        const list: GovernorateDeliveryReadiness[] = Array.isArray(page?.data)
          ? page.data
          : this.extractLookupArray(res);

        this.deliveryGovernorates.set(list);
        this.deliveryTotalCount.set(Number(page?.totalCount) || list.length);
        this.deliveryTotalPagesFromApi.set(Number(page?.totalPages) || 1);
        if (Number(page?.currentPage) > 0) {
          this.deliveryCurrentPage.set(Number(page.currentPage));
        }
        this.deliveryLoading.set(false);

        if (list.length === 0 && this.deliveryTotalCount() > 0 && this.deliveryCurrentPage() > 1) {
          this.deliveryCurrentPage.set(this.deliveryTotalPages());
          this.loadDeliveryGovernorates();
        }
      },
      error: err => {
        if (requestId !== this.deliveryRequestId) return;
        console.error('Error loading delivery governorates:', err);
        this.deliveryLoading.set(false);
        this.deliveryGovernorates.set([]);
        this.deliveryTotalCount.set(0);
        this.deliveryTotalPagesFromApi.set(1);
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ',
          detail: this.extractErrorMessages(err)[0] || 'فشل تحميل بيانات أوامر التوزيع بالمحافظات',
          life: 3000
        });
      }
    });
  }

  trackerSteps(batch: PlanningBatch): { label: string; state: StepState }[] {
    return [
      { label: batch.statusNameAr || 'بانتظار التخطيط', state: 'current' },
      { label: batch.nextStatusNameAr || 'بانتظار اعتماد الطباعة', state: 'pending' }
    ];
  }

  getStoredProgress(gov: GovernorateDeliveryReadiness): number {
    if (!gov.totalBatches || gov.totalBatches <= 0) return 0;
    return Math.min(100, Math.round(((gov.storedBatches || 0) / gov.totalBatches) * 100));
  }
}
