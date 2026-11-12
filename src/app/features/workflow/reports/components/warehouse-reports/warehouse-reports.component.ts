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
import {
  ArchivingBoxService
} from '../../../archiving/service/archiving-box.service';
import {
  WarehouseLocationReportsService,
  WarehouseLocationQuery,
  WarehouseLocationExportParams
} from '../../service/warehouse-location-reports.service';

Chart.register(...registerables);

interface SelectOption { label: string; value: any }
interface WorkView { key: string; label: string }

export interface BoxLocationRow {
  boxId: number;
  trackingCode: string;
  batchId: number;
  committeeNumber: string;
  governorate: string;
  subject: string;
  year: number;
  round: string;
  warehouse: string;
  locationCode: string;
  areaName: string;
  locationDetails: string;
  statusLabel: string;
  locationKind: string;
  statusCode: string;
}

export interface BoxLocationSummary {
  matchingBoxes: number;
  inStorage: number;
  dispatched: number;
  noLocation: number;
}

const WORK_VIEWS: WorkView[] = [
  { key: 'all',       label: 'كل النشاط' },
  { key: 'opening',   label: 'رصيد أول الفترة' },
  { key: 'received',  label: 'الوارد' },
  { key: 'completed', label: 'المنجز' },
  { key: 'pending',   label: 'المتبقي' },
];

/** الأقسام المتاحة في تقرير المخزن (نفس الـ codes اللي راجعة من الـ API) */
const WAREHOUSE_DEPT_CODES = ['WarehouseStorage', 'WarehouseDelivery'];

/** احتياطي لو الـ API مرجعش الأقسام */
const DEFAULT_WAREHOUSE_DEPTS: SelectOption[] = [
  { label: 'المخزن — التخزين', value: 'WarehouseStorage' },
  { label: 'المخزن — التسليم', value: 'WarehouseDelivery' }
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

/** Escape values before injecting them into raw HTML (print window) */
function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a value for CSV (wrap in quotes, double inner quotes) */
function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
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
  selector: 'app-warehouse-reports',
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
  templateUrl: './warehouse-reports.component.html',
  styleUrl: './warehouse-reports.component.scss',
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe]
})
export class WarehouseReportsComponent implements OnInit, OnDestroy, AfterViewInit {

  private readonly svc              = inject(WorkflowReportsService);
  private readonly archivingSvc     = inject(ArchivingBoxService);
  private readonly warehouseLocSvc  = inject(WarehouseLocationReportsService);
  private readonly ngZone           = inject(NgZone);
  private readonly platformId       = inject(PLATFORM_ID);

  // ══════════════════════════════════════════════════════════
  // SECTION 1: تقرير مواقع الصناديق
  // ══════════════════════════════════════════════════════════
  boxBatchId   = signal<number | null>(null);
  boxGov       = signal<number | null>(null);
  boxSubject   = signal<number | null>(null);
  boxStatus    = signal<string | null>(null);

  readonly boxStatusOpts: SelectOption[] = [
    { label: 'كل الحالات',        value: null },
    { label: 'مسجل بالمخزن الآن', value: 'InStorage' },
    { label: 'خرجت للتسليم',      value: 'Dispatched' },
    { label: 'بلا موقع مسجل',      value: 'NoLocation' }
  ];

  boxLoading   = signal(false);
  boxExporting = signal(false);
  boxError     = signal('');
  boxSearched  = signal(false);

  allBoxes     = signal<BoxLocationRow[]>([]);
  boxSummary   = signal<BoxLocationSummary>({
    matchingBoxes: 0,
    inStorage: 0,
    dispatched: 0,
    noLocation: 0
  });

  // Pagination لجدول مواقع الصناديق (5 في الصفحة)
  readonly boxPageSize = 5;
  boxPage       = signal(1);
  boxTotalPages = signal(0);
  boxTotalCount = signal(0);
  private boxFallbackRows: BoxLocationRow[] | null = null;

  boxPagesArray = computed<number[]>(() => {
    const total = this.boxTotalPages();
    const current = this.boxPage();
    const windowSize = 5;
    let start = Math.max(1, current - Math.floor(windowSize / 2));
    const end = Math.min(total, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
  });

  boxRangeText = computed(() => {
    const total = this.boxTotalCount();
    if (!total) return '';
    const from = (this.boxPage() - 1) * this.boxPageSize + 1;
    const to = Math.min(this.boxPage() * this.boxPageSize, total);
    return `عرض ${from}–${to} من ${total}`;
  });

  boxPagerItems = computed<number[]>(() => buildPager(this.boxPage(), this.boxTotalPages()));

  // Summary pill text
  boxFilterSummary = computed(() => {
    const batchPart = this.boxBatchId() ? `الدفعة: ${this.boxBatchId()}` : 'الدفعة: الكل';
    const govObj = this.governorates().find(g => g.id === this.boxGov());
    const govPart = govObj ? govObj.name : 'كل المحافظات';
    const subObj = this.subjects().find(s => s.id === this.boxSubject());
    const subPart = subObj ? subObj.name : 'كل المواد';
    const statusObj = this.boxStatusOpts.find(s => s.value === this.boxStatus());
    const statusPart = `الحالة: ${statusObj ? statusObj.label : 'مخزن'}`;

    return `${batchPart} | ${govPart} | ${subPart} | ${statusPart}`;
  });

  // ══════════════════════════════════════════════════════════
  // SECTION 2: تقرير العمل خلال فترة (المخزن - التخزين / التسليم)
  // ══════════════════════════════════════════════════════════
  @ViewChild('summaryChart') summaryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('batchChart')   batchChartRef!: ElementRef<HTMLCanvasElement>;
  private summaryChart: Chart | null = null;
  private batchChart: Chart | null = null;

  readonly departments  = signal<DepartmentDto[]>([]);
  readonly governorates = signal<LookupItem[]>([]);
  readonly subjects     = signal<LookupItem[]>([]);

  /** قسمين فقط: المخزن — التخزين / المخزن — التسليم */
  readonly departmentOpts = computed<SelectOption[]>(() => {
    const fromApi = this.departments()
      .filter(d => WAREHOUSE_DEPT_CODES.includes(d.code))
      .sort((a, b) => WAREHOUSE_DEPT_CODES.indexOf(a.code) - WAREHOUSE_DEPT_CODES.indexOf(b.code))
      .map(d => ({ label: d.name, value: d.code }));

    return fromApi.length ? fromApi : DEFAULT_WAREHOUSE_DEPTS;
  });

  readonly governorateOpts = computed<SelectOption[]>(() => [
    { label: 'كل المحافظات', value: null },
    ...this.governorates().map(g => ({ label: g.name, value: g.id }))
  ]);
  readonly subjectOpts = computed<SelectOption[]>(() => [
    { label: 'كل المواد', value: null },
    ...this.subjects().map(s => ({ label: s.name, value: s.id }))
  ]);

  // Filters
  // القسم مفيش له قيمة افتراضية: لازم المستخدم يختاره قبل عرض التقرير
  selectedDept    = signal<string | null>(null);
  selectedGov     = signal<number | null>(null);
  selectedSubject = signal<number | null>(null);
  fromDate        = signal<string>(todayISO());
  toDate          = signal<string>(todayISO());
  fromTime        = signal<string>('');
  toTime          = signal<string>('');
  batchIdInput    = signal<string>('');
  currentView     = signal<string>('all');

  report          = signal<DepartmentReportDto | null>(null);
  loading         = signal(false);
  error           = signal('');
  hasSearched     = signal(false);

  page            = signal(1);
  pageSize        = signal(5);
  expandedBatches = signal<Set<number>>(new Set());
  exporting       = signal(false);

  readonly WORK_VIEWS = WORK_VIEWS;

  // Pagination لدفعات تقرير العمل (القيم جاية من الباك: currentPage / totalPages / totalCount / pageSize)
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

  // ══════════════════════════════════════════════════════════
  // SECTION 3: تتبع الصندوق أو الظرف
  // ══════════════════════════════════════════════════════════
  trackCode       = signal('');
  trackResult     = signal<TrackingResult | null>(null);
  trackLoading    = signal(false);
  trackError      = signal('');
  trackCopied     = signal(false);
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
  private sub?: Subscription;
  private boxSub?: Subscription;

  ngOnInit(): void {
    this.loadLookups();
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.boxSub?.unsubscribe();
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
        // مفيش اختيار تلقائي للقسم — المستخدم هو اللي يختار
      },
      error: () => this.error.set('تعذّر تحميل البيانات الأساسية')
    });
  }

  // ──────────────────────────────────────────────────────────
  // Box Locations Search (GET /api/WarehouseLocationReports)
  //
  // Actual response shape:
  // {
  //   success, data: {
  //     totalBoxes, storedBoxes, deliveredBoxes, missingLocationBoxes,
  //     boxes: { currentPage, totalPages, totalCount, pageSize, data: [ ...boxes ] }
  //   }
  // }
  // ──────────────────────────────────────────────────────────

  /** Maps one box object from the new API into a table row */
  private mapApiBox(b: any): BoxLocationRow {
    const status = (b.status ?? '').toString();
    const isDelivered = status === 'Delivered' || !!b.deliveredAt;
    const hasLocation = !!b.locationCode;

    const detailsParts = [
      b.rack  ? `راك ${b.rack}` : null,
      b.shelf ? `رف ${b.shelf}` : null,
      b.bin   ? `خانة ${b.bin}` : null
    ].filter(Boolean);

    return {
      boxId: b.id,
      trackingCode: b.boxCode ?? `BOX-${b.id}`,
      batchId: b.batchId,
      committeeNumber: b.committeeNumber ?? '—',
      governorate: b.governorate ?? '—',
      subject: b.subject ?? '—',
      year: b.year,
      round: (b.round ?? '—').toString().trim(),
      warehouse: b.warehouse ?? '—',
      locationCode: b.locationCode ?? '—',
      areaName: b.area ? `منطقة ${b.area}` : '—',
      locationDetails: detailsParts.length ? detailsParts.join(' - ') : '—',
      statusLabel: b.statusName ?? (hasLocation ? 'مسكنة' : 'غير مسجل'),
      locationKind: b.locationKind ?? (isDelivered ? 'آخر موقع تخزين' : 'الموقع الحالي'),
      statusCode: status
    };
  }

  loadBoxLocations(page = 1): void {
    this.boxLoading.set(true);
    this.boxError.set('');
    this.boxSearched.set(true);
    this.boxPage.set(page);

    const query: WarehouseLocationQuery = {
      BatchId: this.boxBatchId() ?? undefined,
      GovernorateId: this.boxGov() ?? undefined,
      SubjectId: this.boxSubject() ?? undefined,
      Status: this.boxStatus() ?? undefined,
      PageNumber: page,
      PageSize: this.boxPageSize
    };

    this.boxSub?.unsubscribe();
    this.boxSub = this.warehouseLocSvc.getReports(query).subscribe({
      next: (res: any) => {
        const d = res?.data ?? {};
        const rawList: any[] = d.boxes?.data ?? [];
        const rows: BoxLocationRow[] = rawList.map(b => this.mapApiBox(b));

        this.boxFallbackRows = null;
        this.allBoxes.set(rows);
        this.boxPage.set(d.boxes?.currentPage ?? page);
        this.boxTotalPages.set(d.boxes?.totalPages ?? 1);
        this.boxTotalCount.set(d.boxes?.totalCount ?? rows.length);
        this.boxSummary.set({
          matchingBoxes: d.totalBoxes ?? rows.length,
          inStorage: d.storedBoxes ?? 0,
          dispatched: d.deliveredBoxes ?? 0,
          noLocation: d.missingLocationBoxes ?? 0
        });

        this.boxLoading.set(false);
      },
      error: (err: any) => {
        console.error('WarehouseLocationReports failed, using fallback', err);
        // Fallback إلى خدمة الأرشفة في حال تعذر الاتصال بالـ endpoint الجديد
        this.fallbackLoadBoxLocations();
      }
    });
  }

  goToBoxPage(p: number): void {
    if (p < 1 || p > this.boxTotalPages() || p === this.boxPage()) return;

    // في وضع الـ fallback نقسّم محلياً
    if (this.boxFallbackRows) {
      this.boxPage.set(p);
      const start = (p - 1) * this.boxPageSize;
      this.allBoxes.set(this.boxFallbackRows.slice(start, start + this.boxPageSize));
      return;
    }

    this.loadBoxLocations(p);
  }

  private fallbackLoadBoxLocations(): void {
    const govId = this.boxGov() ?? undefined;
    const subId = this.boxSubject() ?? undefined;

    this.archivingSvc.getBoxesByGovernorateAndSubject(govId, subId).subscribe({
      next: (res: any) => {
        const rawBatches = res.data?.data ?? [];
        const rows: BoxLocationRow[] = [];

        let inStorageCount = 0;
        let dispatchedCount = 0;
        let noLocationCount = 0;

        rawBatches.forEach((batch: any) => {
          if (this.boxBatchId() && batch.batchId !== this.boxBatchId()) {
            return;
          }

          batch.racks?.forEach((rack: any) => {
            rack.boxes?.forEach((b: any) => {
              const hasLocation = !!(b.shelfLocationCode || b.shelfLocationId);
              const isDelivered = b.isReadyForDelivery || /deliver|مسلم|مسلّم|تسليم/i.test(b.statusName || b.statusCode);

              if (isDelivered) {
                dispatchedCount++;
              } else if (hasLocation) {
                inStorageCount++;
              } else {
                noLocationCount++;
              }

              // Status filter
              const filter = this.boxStatus();
              if ((filter === 'stored' || filter === 'InStorage') && (isDelivered || !hasLocation)) return;
              if ((filter === 'delivered' || filter === 'Dispatched') && !isDelivered) return;
              if ((filter === 'unassigned' || filter === 'NoLocation') && hasLocation) return;

              rows.push({
                boxId: b.boxId,
                trackingCode: b.qrCode || `BOX-${b.boxId}`,
                batchId: batch.batchId,
                committeeNumber: b.committeeNumber,
                governorate: batch.governorateName,
                subject: batch.subjectName,
                year: batch.year,
                round: batch.roundName,
                warehouse: rack.warehouseName || b.warehouseName || 'مخزن B',
                locationCode: b.shelfLocationCode || '—',
                areaName: b.area ? `منطقة ${b.area}` : rack.area ? `منطقة ${rack.area}` : '—',
                locationDetails: b.rack ? `راك ${b.rack} - رف ${b.shelf || '—'} - خانة ${b.bin || '—'}` : '—',
                statusLabel: b.statusName || (hasLocation ? 'مسجلة' : 'غير مسجل'),
                locationKind: isDelivered ? 'آخر موقع تخزين' : 'الموقع الحالي',
                statusCode: b.statusCode
              });
            });
          });
        });

        this.boxFallbackRows = rows;
        this.boxPage.set(1);
        this.boxTotalCount.set(rows.length);
        this.boxTotalPages.set(Math.max(1, Math.ceil(rows.length / this.boxPageSize)));
        this.allBoxes.set(rows.slice(0, this.boxPageSize));
        this.boxSummary.set({
          matchingBoxes: rows.length,
          inStorage: inStorageCount,
          dispatched: dispatchedCount,
          noLocation: noLocationCount
        });

        this.boxLoading.set(false);
      },
      error: (err: any) => {
        this.boxError.set(err?.error?.message || 'حدث خطأ أثناء جلب مواقع الصناديق');
        this.boxLoading.set(false);
      }
    });
  }

  /**
   * تصدير تقرير مواقع الصناديق (GET /api/WarehouseLocationReports/export)
   */
  exportBoxLocations(format: 'pdf' | 'excel'): void {
    this.boxExporting.set(true);

    const exportParams: WarehouseLocationExportParams = {
      BatchId: this.boxBatchId() ?? undefined,
      GovernorateId: this.boxGov() ?? undefined,
      SubjectId: this.boxSubject() ?? undefined,
      Status: this.boxStatus() ?? undefined,
      PageNumber: 1,
      PageSize: 500,
      format: format === 'excel' ? 'xlsx' : 'pdf'
    };

    this.warehouseLocSvc.exportReport(exportParams).subscribe({
      next: res => {
        const blob = res.body!;
        const disposition = res.headers.get('Content-Disposition') ?? '';
        const filenameMatch = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/);
        const serverFilename = filenameMatch ? decodeURIComponent(filenameMatch[2].trim()) : null;
        const extension = format === 'excel' ? 'xlsx' : 'pdf';
        const fallback = `تقرير-مواقع-الصناديق-${todayISO()}.${extension}`;

        this.downloadBlob(blob, serverFilename ?? fallback);
        this.boxExporting.set(false);
      },
      error: (err: any) => {
        console.error('Export failed, using client-side fallback', err);
        // في حال حدوث خطأ من الخادم، نقوم بالتصدير الاحتياطي محلياً
        this.clientSideExportFallback(format);
      }
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private clientSideExportFallback(format: 'pdf' | 'excel'): void {
    try {
      const rows = this.boxFallbackRows ?? this.allBoxes();
      if (!rows.length) {
        return;
      }

      if (format === 'excel') {
        const headers = ['الصندوق', 'رقم الدفعة', 'رقم اللجنة', 'المحافظة', 'المادة', 'العام', 'الدور', 'المخزن', 'كود الموقع', 'المنطقة', 'تفاصيل الرف', 'الحالة'];
        const csvContent = '\uFEFF' + [
          headers.map(csvCell).join(','),
          ...rows.map(r => [
            csvCell(r.trackingCode),
            r.batchId,
            csvCell(r.committeeNumber),
            csvCell(r.governorate),
            csvCell(r.subject),
            r.year,
            csvCell(r.round),
            csvCell(r.warehouse),
            csvCell(r.locationCode),
            csvCell(r.areaName),
            csvCell(r.locationDetails),
            csvCell(r.statusLabel)
          ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        this.downloadBlob(blob, `تقرير-مواقع-الصناديق-${todayISO()}.csv`);
      } else {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html dir="rtl" lang="ar">
            <head>
              <title>تقرير مواقع الصناديق - ${todayISO()}</title>
              <style>
                body { font-family: Cairo, Tahoma, sans-serif; padding: 20px; direction: rtl; }
                h2 { color: #0e5a8a; }
                table { width: 50%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
                th { background: #0e5a8a; color: white; }
                .summary { background: #f0fdf4; padding: 5px; margin-bottom: 15px; border-radius: 6px; }
              </style>
            </head>
            <body>
              <h2>منظومة إنتاج البوكليت - تقرير مواقع الصناديق</h2>
              <div class="summary">${escapeHtml(this.boxFilterSummary())} | إجمالي الصناديق: ${rows.length}</div>
              <table>
                <thead>
                  <tr>
                    <th>الصندوق</th>
                    <th>الدفعة / اللجنة</th>
                    <th>المحافظة / المادة</th>
                    <th>المخزن</th>
                    <th>الموقع</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(r => `
                    <tr>
                      <td>${escapeHtml(r.trackingCode)}</td>
                      <td>دفعة ${escapeHtml(r.batchId)} - لجنة ${escapeHtml(r.committeeNumber)}</td>
                      <td>${escapeHtml(r.governorate)} / ${escapeHtml(r.subject)}</td>
                      <td>${escapeHtml(r.warehouse)}</td>
                      <td>${escapeHtml(r.locationCode)} (${escapeHtml(r.areaName)})</td>
                      <td>${escapeHtml(r.statusLabel)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <script>window.print();<\/script>
            </body>
            </html>
          `);
          printWindow.document.close();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.boxExporting.set(false);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Department Period Work Report
  // ──────────────────────────────────────────────────────────

  /** عند تغيير القسم: نفضّي النتيجة القديمة علشان متتعرضش بداتا قسم تاني */
  onDeptChange(code: string | null): void {
    this.selectedDept.set(code);
    this.sub?.unsubscribe();
    this.summaryChart?.destroy();
    this.batchChart?.destroy();
    this.summaryChart = null;
    this.batchChart = null;

    this.report.set(null);
    this.hasSearched.set(false);
    this.loading.set(false);
    this.error.set('');
    this.page.set(1);
    this.currentView.set('all');
    this.expandedBatches.set(new Set());
  }

  /** زر "عرض التقرير": دايماً يبدأ من الصفحة الأولى */
  searchReport(): void {
    this.page.set(1);
    this.loadReport();
  }

  loadReport(): void {
    const dept = this.selectedDept();
    if (!dept) {
      this.error.set('اختر القسم أولاً قبل عرض التقرير');
      return;
    }

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
      },
      {
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
      }
    ];

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
    const dept = this.selectedDept();
    if (!dept) {
      this.error.set('اختر القسم أولاً قبل التنزيل');
      return;
    }

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

        this.downloadBlob(blob, serverFilename ?? fallback);
        this.exporting.set(false);
      },
      error: err => {
        console.error('Export error', err);
        this.exporting.set(false);
      }
    });
  }

  // ──────────────────────────────────────────────────────────
  // Box Tracking
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

  get pagesArray(): number[] {
    const r = this.report();
    const total = r?.batches?.totalPages ?? 0;
    return Array.from({ length: total }, (_, i) => i + 1);
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
    const code = this.selectedDept();
    const dept = this.departments().find(d => d.code === code);
    return (dept as any)?.includesBoxes ?? true;
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

  trackKindLabel(kind: string): string {
    return kind === 'Box' ? 'صندوق' : kind === 'Envelope' ? 'ظرف' : kind;
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
