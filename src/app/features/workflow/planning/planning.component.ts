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
  DeliveryOrdersGovernoratesQuery
} from './service/planning-batch';

interface SelectOption {
  label: string;
  value: string | number;
}

type StepState = 'done' | 'current' | 'pending' | 'rejected';

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

  setTab(tab: 'materials' | 'delivery-orders'): void {
    this.activeTab.set(tab);
    if (tab === 'delivery-orders' && this.deliveryGovernorates().length === 0 && !this.deliveryLoading()) {
      this.loadDeliveryGovernorates();
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

  // Selection moved from warehouses into materials:
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

  readonly deliveryYear = signal<number | null>(null);
  readonly deliveryRoundId = signal<string | number>('all');
  readonly deliveryEducationalStageId = signal<string | number>('all');
  readonly deliveryEligibleFilter = signal<string>('all');

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
      ),
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
      next: ({ governorates, subjects, rounds, stages }) => {
        const gList = this.extractLookupArray(governorates);
        const sList = this.extractLookupArray(subjects);
        const rList = this.extractLookupArray(rounds);
        const stList = this.extractLookupArray(stages);

        const gOpts = this.mapToOptions(gList, 'كل المحافظات');
        const sOpts = this.mapToOptions(sList, 'كل المواد');
        const rOpts = this.mapToOptions(rList, 'اختر الدور');
        const stOpts = this.mapToOptions(stList, 'كل المراحل التعليمية');

        this.governorates.set(gOpts);
        this.subjects.set(sOpts);
        this.rounds.set(rOpts);
        this.educationalStages.set(stOpts);

        // Auto-select first real round for delivery orders if not selected
        const firstRound = rOpts.find(r => r.value !== 'all');
        if (firstRound && (this.deliveryRoundId() === 'all' || !this.deliveryRoundId())) {
          this.deliveryRoundId.set(firstRound.value);
        }

        // Auto-select first real stage for delivery orders if not selected
        const firstStage = stOpts.find(s => s.value !== 'all');
        if (firstStage && (this.deliveryEducationalStageId() === 'all' || !this.deliveryEducationalStageId())) {
          this.deliveryEducationalStageId.set(firstStage.value);
        }

        this.lookupsLoading.set(false);

        // If delivery orders tab is open, load delivery governorates
        if (this.activeTab() === 'delivery-orders') {
          this.loadDeliveryGovernorates();
        }
      },
      error: err => {
        console.error('Error in forkJoin lookups:', err);
        this.lookupsLoading.set(false);
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
      return;
    }

    this.deliveryLoading.set(true);

    const yearVal = this.deliveryYear();
    const stageVal = this.deliveryEducationalStageId();
    const eligibleVal = this.deliveryEligibleFilter();

    const query: DeliveryOrdersGovernoratesQuery = {
      year: yearVal != null && yearVal > 0 ? yearVal : undefined,
      roundId: validRoundId,
      educationalStageId: stageVal !== 'all' && Number(stageVal) > 0 ? Number(stageVal) : undefined,
      onlyEligible: eligibleVal === 'true' ? true : eligibleVal === 'false' ? false : undefined
    };

    this.planningService.getDeliveryOrdersGovernorates(query).subscribe({
      next: res => {
        const list = this.extractLookupArray(res);
        this.deliveryGovernorates.set(list);
        this.deliveryLoading.set(false);
      },
      error: err => {
        console.error('Error loading delivery governorates:', err);
        this.deliveryLoading.set(false);
        this.deliveryGovernorates.set([]);
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ',
          detail: err.error?.message || 'فشل تحميل بيانات أوامر التوزيع بالمحافظات',
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
