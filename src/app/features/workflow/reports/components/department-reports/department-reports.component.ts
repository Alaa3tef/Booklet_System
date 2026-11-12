import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewInit,
  ViewEncapsulation,
  PLATFORM_ID,
  NgZone
} from '@angular/core';
import { isPlatformBrowser, CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import {
  WorkflowReportsService,
  DepartmentDto,
  DepartmentReportDto,
  LookupItem,
  ReportFilters,
  ReportTotals,
  BatchReportDto,
  TrackingResult
} from '../../service/workflow-reports.service';

Chart.register(...registerables);

interface SelectOption { label: string; value: any }
interface WorkView { key: string; label: string }

const WORK_VIEWS: WorkView[] = [
  { key: 'all',       label: 'كل النشاط' },
  { key: 'opening',   label: 'رصيد أول الفترة' },
  { key: 'received',  label: 'الوارد' },
  { key: 'completed', label: 'المنجز' },
  { key: 'pending',   label: 'المتبقي' },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatArabicDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}

/**
 * يبني عناصر الـ pager: أرقام الصفحات، والقيمة السالبة (-1) معناها "…"
 * مثال: 1 … 4 5 6 … 20
 */
function buildPager(current: number, total: number): number[] {
  if (total <= 0) return [];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);

  const out: number[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push(-1);
    out.push(n);
  });
  return out;
}
type BatchMetric = 'opening' | 'received' | 'completed' | 'pending';

@Component({
  selector: 'app-department-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    InputTextModule,
    ButtonModule,
    TooltipModule,
    TagModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './department-reports.component.html',
  styleUrl: './department-reports.component.scss',
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class DepartmentReportsComponent implements OnInit, OnDestroy, AfterViewInit {

  private readonly svc        = inject(WorkflowReportsService);
  private readonly ngZone     = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  // ─── Charts ─────────────────────────────────────────────────────────────────
  @ViewChild('summaryChart') summaryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('batchChart')   batchChartRef!: ElementRef<HTMLCanvasElement>;
  private summaryChart: Chart | null = null;
  private batchChart: Chart | null = null;

  // ─── Lookups ─────────────────────────────────────────────────────────────────
  readonly departments  = signal<DepartmentDto[]>([]);
  readonly governorates = signal<LookupItem[]>([]);
  readonly subjects     = signal<LookupItem[]>([]);

  readonly departmentOpts = computed<SelectOption[]>(() =>
    this.departments().map(d => ({ label: d.name, value: d.code }))
  );
  readonly governorateOpts = computed<SelectOption[]>(() => [
    { label: 'كل المحافظات', value: null },
    ...this.governorates().map(g => ({ label: g.name, value: g.id }))
  ]);
  readonly subjectOpts = computed<SelectOption[]>(() => [
    { label: 'كل المواد', value: null },
    ...this.subjects().map(s => ({ label: s.name, value: s.id }))
  ]);

  // ─── Filters ────────────────────────────────────────────────────────────────
  selectedDept      = signal<string | null>(null);
  selectedGov       = signal<number | null>(null);
  selectedSubject   = signal<number | null>(null);
  fromDate          = signal<string>(todayISO());
  toDate            = signal<string>(todayISO());
  fromTime          = signal<string>('');
  toTime            = signal<string>('');
  batchIdInput      = signal<string>('');
  currentView       = signal<string>('all');

  // ─── Validation (القسم + تاريخ البداية والنهاية مطلوبين) ──────────────────────
  /** بيتفعّل أول ما المستخدم يضغط "عرض التقرير" أو التنزيل */
  showValidation = signal(false);
  private validationActive = false;

  deptInvalid = computed(() => this.showValidation() && !this.selectedDept());

  fromInvalid = computed(() => {
    if (!this.showValidation()) return false;
    if (!this.fromDate()) return true;
    // لو التاريخين موجودين بس الفترة غلط، نعلّم الاتنين
    return !!this.toDate() && this.validateDates() !== null;
  });

  toInvalid = computed(() => {
    if (!this.showValidation()) return false;
    if (!this.toDate()) return true;
    return !!this.fromDate() && this.validateDates() !== null;
  });

  // ─── Report ─────────────────────────────────────────────────────────────────
  report      = signal<DepartmentReportDto | null>(null);
  loading     = signal(false);
  error       = signal('');
  hasSearched = signal(false);

  // ─── Pagination (دفعات التقرير — القيم جاية من الباك) ───────────────────────
  page     = signal(1);
  pageSize = signal(5);
  readonly pageSizeOpts = [5, 20, 50];
  private scrollToBatches = false;

  batchCurrentPage = computed<number>(() => (this.report()?.batches as any)?.currentPage ?? this.page());
  batchTotalPages  = computed<number>(() => (this.report()?.batches as any)?.totalPages ?? 0);
  batchPagerItems  = computed<number[]>(() => buildPager(this.batchCurrentPage(), this.batchTotalPages()));
  batchRangeText   = computed<string>(() => {
    const b: any = this.report()?.batches;
    if (!b || !b.totalCount) return '';
    const size = b.pageSize ?? this.pageSize();
    const current = b.currentPage ?? this.page();
    const from = (current - 1) * size + 1;
    const to = Math.min(current * size, b.totalCount);
    return `عرض ${from}–${to} من ${b.totalCount} دفعة`;
  });

  // ─── Tracking ───────────────────────────────────────────────────────────────
  trackCode         = signal('');
  trackResult       = signal<TrackingResult | null>(null);
  trackLoading      = signal(false);
  trackError        = signal('');
  trackCopied       = signal(false);
   batchChartMetric = signal<BatchMetric | null>('completed');

private readonly METRIC_LABELS: Record<BatchMetric, string> = {
  opening: 'رصيد أول الفترة',
  received: 'الوارد',
  completed: 'المنجز',
  pending: 'المتبقي'
};

batchMetricLabel(m: BatchMetric): string { return this.METRIC_LABELS[m]; }

/** يختار المقياس اللي فيه بيانات فعلاً (أو المقياس بتاع التاب المختار) */
private pickBatchMetric(batches: BatchReportDto[]): BatchMetric | null {
  const sum = (m: BatchMetric) =>
    batches.reduce((acc, b) => acc + ((b.totals as any)?.[m]?.committees ?? 0), 0);

  const view = this.currentView();
  if (view !== 'all') {
    return sum(view as BatchMetric) > 0 ? (view as BatchMetric) : null;
  }
  return (['completed', 'pending', 'opening', 'received'] as BatchMetric[])
    .find(m => sum(m) > 0) ?? null;
}
  // ─── Expanded batches ───────────────────────────────────────────────────────
  expandedBatches = signal<Set<number>>(new Set());

  // ─── VIEWS ──────────────────────────────────────────────────────────────────
  readonly WORK_VIEWS = WORK_VIEWS;

  // ─── Export loading ─────────────────────────────────────────────────────────
  exporting = signal(false);

  private sub?: Subscription;

  ngOnInit(): void {
    this.loadLookups();
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.summaryChart?.destroy();
    this.batchChart?.destroy();
  }

  private loadLookups(): void {
    forkJoin({
      depts:   this.svc.getDepartments(),
      lookups: this.svc.getLookups()
    }).subscribe({
      next: ({ depts, lookups }) => {
        this.departments.set(depts.data ?? []);
        this.governorates.set(lookups.data?.governorates ?? []);
        this.subjects.set(lookups.data?.subjects ?? []);
      },
      error: () => this.error.set('تعذّر تحميل البيانات الأساسية')
    });
  }

  // ──────────────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────────────

  /** رسالة خطأ التواريخ (أو null لو كله تمام) */
  validateDates(): string | null {
    const from = this.fromDate();
    const to = this.toDate();

    if (!from && !to) return 'حدد تاريخ البداية وتاريخ النهاية. الوقت اختياري.';
    if (!from) return 'حدد تاريخ البداية. الوقت اختياري.';
    if (!to)   return 'حدد تاريخ النهاية. الوقت اختياري.';

    const f = new Date(from).getTime();
    const t = new Date(to).getTime();
    if (f > t) return 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية أو يساويه.';
    if ((t - f) / 86_400_000 > 366) return 'الحد الأقصى للفترة سنة واحدة.';

    return null;
  }

  /** رسالة موحدة: القسم + التواريخ */
  private validationMessage(): string | null {
    const parts: string[] = [];
    if (!this.selectedDept()) parts.push('اختر القسم أولاً.');
    const dateMsg = this.validateDates();
    if (dateMsg) parts.push(dateMsg);
    return parts.length ? parts.join(' ') : null;
  }

  /** بيشيل رسالة الخطأ أول ما المستخدم يصلّح الحقل */
  private revalidate(): void {
    if (!this.validationActive) return;
    const msg = this.validationMessage();
    this.error.set(msg ?? '');
    if (!msg) this.validationActive = false;
  }

  /** @returns true لو كله تمام ومينفعش نكمل لو false */
  private ensureValid(): boolean {
    this.showValidation.set(true);
    const msg = this.validationMessage();
    if (msg) {
      this.validationActive = true;
      this.error.set(msg);
      return false;
    }
    this.validationActive = false;
    return true;
  }

  onDeptChange(code: string | null): void {
    this.selectedDept.set(code);
    this.revalidate();
  }

  onFromDateChange(v: string): void {
    this.fromDate.set(v);
    this.revalidate();
  }

  onToDateChange(v: string): void {
    this.toDate.set(v);
    this.revalidate();
  }

  // ──────────────────────────────────────────────────────────
  // Report
  // ──────────────────────────────────────────────────────────

  /** زر "عرض التقرير": دايماً يبدأ من الصفحة الأولى */
  searchReport(): void {
    this.page.set(1);
    this.loadReport();
  }

  loadReport(): void {
    if (!this.ensureValid()) return;
    const dept = this.selectedDept()!;

    this.loading.set(true);
    this.error.set('');
    this.hasSearched.set(true);

    const filters: ReportFilters = {
      FromDate: this.fromDate() || undefined,
      ToDate:   this.toDate()   || undefined,
      FromTime: this.fromTime() || undefined,
      ToTime:   this.toTime()   || undefined,
      GovernorateId: this.selectedGov() ?? undefined,
      SubjectId:     this.selectedSubject() ?? undefined,
      BatchId:       this.batchIdInput() ? +this.batchIdInput() : undefined,
      View:     this.currentView() !== 'all' ? this.currentView() : undefined,
      PageNumber: this.page(),
      PageSize:   this.pageSize()
    };

    this.sub?.unsubscribe();
    this.sub = this.svc.getReport(dept, filters).subscribe({
      next: res => {
        this.report.set(res.data ?? null);
        this.loading.set(false);
        setTimeout(() => this.buildCharts(), 50);

        if (this.scrollToBatches && isPlatformBrowser(this.platformId)) {
          this.scrollToBatches = false;
          setTimeout(() => document.getElementById('batches-section')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
        }
      },
      error: err => {
        this.error.set(err?.error?.message || 'حدث خطأ أثناء جلب التقرير');
        this.loading.set(false);
      }
    });
  }

  onViewChange(view: string): void {
    this.currentView.set(view);
    this.page.set(1);
    if (this.hasSearched()) this.loadReport();
  }

  onPageChange(p: number): void {
    const total = this.batchTotalPages();
    if (p < 1 || p > total || p === this.batchCurrentPage()) return;
    this.page.set(p);
    this.scrollToBatches = true;
    this.loadReport();
  }

  onPageSizeChange(size: number | string): void {
    this.pageSize.set(+size);
    this.page.set(1);
    this.expandedBatches.set(new Set());
    this.loadReport();
  }

 private buildCharts(): void {
  if (!isPlatformBrowser(this.platformId)) return;
  const r = this.report();
  if (!r) return;

  const top = (r.batches?.data ?? []).slice(0, 10);
  const metric = this.pickBatchMetric(top);
  this.batchChartMetric.set(metric);

  this.ngZone.runOutsideAngular(() => {
    this.buildSummaryChart(r.totals);
    this.buildBatchChart(top, metric);
  });
}

  private buildSummaryChart(totals: ReportTotals): void {
    const canvas = this.summaryChartRef?.nativeElement;
    if (!canvas) return;

    this.summaryChart?.destroy();

    const dept = this.departments().find(d => d.code === this.selectedDept());
    const includesBoxes = dept?.includesBoxes ?? false;

    const labels = ['رصيد أول الفترة', 'الوارد', 'المنجز', 'المتبقي'];

    const committeeData = [
      totals.opening.committees,
      totals.received.committees,
      totals.completed.committees,
      totals.pending.committees
    ];

    const datasetsConfig: any[] = [
      {
        label: 'اللجان',
        data: committeeData,
        backgroundColor: ['#6366f1', '#06b6d4', '#5b981', '#f59e0b'],
        borderRadius: 8,
        borderWidth: 0,
      }
    ];

    if (includesBoxes) {
      datasetsConfig.push({
        label: 'الصناديق',
        data: [
          totals.opening.boxes,
          totals.received.boxes,
          totals.completed.boxes,
          totals.pending.boxes
        ],
        backgroundColor: ['#818cf8', '#67e8f9', '#6ee7b7', '#fcd34d'],
        borderRadius: 8,
        borderWidth: 0,
      });
    }

    const config: ChartConfiguration = {
      type: 'bar',
      data: { labels, datasets: datasetsConfig },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', rtl: true, labels: { font: { family: 'Cairo', size: 13 }, color: '#374151' } },
          tooltip: { rtl: true, bodyFont: { family: 'Cairo' }, titleFont: { family: 'Cairo' } }
        },
        scales: {
          x: { ticks: { font: { family: 'Cairo' }, color: '#6b7280' }, grid: { display: false } },
          y: { ticks: { font: { family: 'Cairo' }, color: '#6b7280' }, beginAtZero: true }
        }
      }
    };

    this.summaryChart = new Chart(canvas, config);
  }

private buildBatchChart(batches: BatchReportDto[], metric: BatchMetric | null): void {
  const canvas = this.batchChartRef?.nativeElement;
  if (!canvas) return;

  this.batchChart?.destroy();
  this.batchChart = null;
  if (!metric || batches.length === 0) return;

  const config: ChartConfiguration = {
    type: 'doughnut',
    data: {
      labels: batches.map(b => `${b.governorate} - ${b.subject}`),
      datasets: [{
        data: batches.map(b => (b.totals as any)[metric].committees),
        backgroundColor: [
          '#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444',
          '#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'left',
          rtl: true,
          labels: { font: { family: 'Cairo', size: 11 }, color: '#374151', boxWidth: 12 }
        },
        tooltip: { rtl: true, bodyFont: { family: 'Cairo' }, titleFont: { family: 'Cairo' } }
      }
    }
  };

  this.batchChart = new Chart(canvas, config);
}
  exportAs(format: 'excel' | 'pdf'): void {
    if (!this.ensureValid()) return;
    const dept = this.selectedDept()!;

    this.exporting.set(true);
    const filters: ReportFilters & { format?: string } = {
      FromDate: this.fromDate() || undefined,
      ToDate:   this.toDate()   || undefined,
      FromTime: this.fromTime() || undefined,
      ToTime:   this.toTime()   || undefined,
      GovernorateId: this.selectedGov() ?? undefined,
      SubjectId:     this.selectedSubject() ?? undefined,
      BatchId:       this.batchIdInput() ? +this.batchIdInput() : undefined,
      format
    };

    this.svc.exportReportWithFilename(dept, {
      ...filters,
      format: format === 'excel' ? 'xlsx' : 'pdf'
    }).subscribe({
      next: response => {
        const blob = response.body!;
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const filenameMatch = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/);
        const serverFilename = filenameMatch ? filenameMatch[2].trim() : null;
        const fallback = `report-${dept}-${this.fromDate()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = serverFilename ?? fallback;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: err => {
        console.error('Export error', err);
        this.exporting.set(false);
      }
    });
  }

  // ──────────────────────────────────────────────────────────
  // Tracking
  // ──────────────────────────────────────────────────────────
  trackBox(): void {
    const code = this.trackCode().trim();
    if (!code) return;

    this.trackLoading.set(true);
    this.trackResult.set(null);
    this.trackError.set('');

    this.svc.trackByCode(code).subscribe({
      next: res => {
        this.trackResult.set(res.data ?? null);
        this.trackLoading.set(false);
      },
      error: err => {
        this.trackError.set(err?.error?.message || 'لم يتم العثور على هذا الرمز');
        this.trackLoading.set(false);
      }
    });
  }

  toggleBatch(id: number): void {
    this.expandedBatches.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isBatchExpanded(id: number): boolean {
    return this.expandedBatches().has(id);
  }

  getTotalsForView(totals: any, view: string) {
    if (view === 'all') return null;
    return totals?.[view] ?? null;
  }

  workStatusClass(work: any): string {
    if (work?.completed) return 'status-completed';
    if (work?.received)  return 'status-received';
    if (work?.pending)   return 'status-pending';
    return 'status-opening';
  }

  workStatusLabel(work: any): string {
    if (work?.completed) return 'مكتمل';
    if (work?.received)  return 'وارد';
    if (work?.pending)   return 'متبقي';
    return 'رصيد البداية';
  }

  formatDate = formatArabicDate;

  deptIncludesBoxes(): boolean {
    const dept = this.departments().find(d => d.code === this.selectedDept());
    return dept?.includesBoxes ?? false;
  }

  get reportDateRange(): string {
    const r = this.report();
    if (!r) return '';
    return `${formatArabicDate(r.fromUtc)} — ${formatArabicDate(r.toUtc)}`;
  }

  stageClass(work: any): string {
    if (work?.completed) return 'stage-completed';
    if (work?.received)  return 'stage-received';
    return 'stage-pending';
  }

  stageIcon(work: any): string {
    if (work?.completed) return 'pi-check-circle';
    if (work?.received)  return 'pi-arrow-down';
    return 'pi-clock';
  }

  /** حالة المرحلة في مسار التتبع: done / active / wait */
  stepState(work: any): 'done' | 'active' | 'wait' {
    if (work?.completed) return 'done';
    if (work?.received)  return 'active';
    return 'wait';
  }

  stepLabel(work: any): string {
    if (work?.completed) return 'منجز';
    if (work?.received)  return 'وارد';
    return 'لم يصل بعد';
  }

  trackKindLabel(kind: string): string {
    return kind === 'Box' ? 'صندوق' : kind === 'Envelope' ? 'ظرف' : kind;
  }

  copyTrackCode(code: string): void {
    navigator.clipboard?.writeText(code).then(() => {
      this.trackCopied.set(true);
      setTimeout(() => this.trackCopied.set(false), 1500);
    }).catch(() => { /* ignore */ });
  }

  clearTrackResult(): void {
    this.trackResult.set(null);
    this.trackCode.set('');
    this.trackError.set('');
  }
}
