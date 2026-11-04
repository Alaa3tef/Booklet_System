import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Observable } from "rxjs";
import { Chart, registerables } from "chart.js";
import { WorkflowStepLayoutComponent } from "../../shared/workflow-step-layout/workflow-step-layout.component";
import {
  StageKey,
  ManagerService,
  STAGE_KEYS,
  RoundLookup,
  SubjectLookup,
  ManagerContext,
  ManagerQuery,
  ManagerResponse,
} from "./service/manager-service";

Chart.register(...registerables);

type Tab = "gov" | "subject" | "dept" | "delivery" | "search";
type Level =
  | "gov-list"
  | "gov-batches"
  | "subj-list"
  | "subj-batches"
  | "batch-committees"
  | "boxes"
  | "dept"
  | "delivery"
  | "search";
type Crumb = { label: string; go: () => void };
interface Ref {
  id: number;
  name: string;
}
interface StageVM {
  key: StageKey;
  label: string;
  percent: number | null;
  completed: number | null;
}
interface RowVM {
  id: number;
  title: string;
  sub: string;
  batches: number | null;
  committees: number;
  status: string;
  boxes: any;
  exit: number | null;
  stages: StageVM[];
  overall: number | null;
}
/** عنصر في الدونات */
interface Slice {
  label: string;
  value: number;
  color: string;
}
interface DonutSeg extends Slice {
  dash: string;
  offset: number;
  share: number;
}

const PAGE_SIZE = 12;

export const STAGE_LABELS: Record<StageKey, string> = {
  Printing: "الطباعة",
  Quality: "الجودة",
  Packing: "التغليف",
  Storage: "التخزين",
};
/** ألوان المراحل (لازم تطابق الـ SCSS) */
export const STAGE_COLORS: Record<StageKey, string> = {
  Printing: "#2563eb",
  Quality: "#f59e0b",
  Packing: "#8b5cf6",
  Storage: "#16a34a",
};

/** حالات اللجنة (من جدول الأقسام في الـ PDF) */
export const COMMITTEE_STATUSES: { value: string; label: string }[] = [
  { value: "Generated", label: "تم الإنشاء" },
  { value: "ITCompleted", label: "اكتمل IT" },
  { value: "PendingPrintApproval", label: "بانتظار اعتماد الطباعة" },
  { value: "ReadyForPrinting", label: "جاهزة للطباعة" },
  { value: "PrintingInProgress", label: "الطباعة جارية" },
  { value: "PrintingCompleted", label: "اكتملت الطباعة" },
  { value: "QualityInProgress", label: "الجودة جارية" },
  { value: "QualityCompleted", label: "اكتملت الجودة" },
  { value: "PackingInProgress", label: "التغليف جارٍ" },
  { value: "PackingCompleted", label: "اكتمل التغليف" },
  { value: "Stored", label: "تم التخزين" },
  { value: "DeliveryOrderAssigned", label: "على أمر توريد" },
  { value: "Delivered", label: "تم التسليم" },
];

/** لون لكل حالة بترتيب خط الإنتاج */
const STATUS_COLORS = [
  "#94a3b8",
  "#64748b",
  "#cbd5e1",
  "#60a5fa",
  "#2563eb",
  "#1d4ed8",
  "#fbbf24",
  "#d99a0b",
  "#a78bfa",
  "#8b5cf6",
  "#16a34a",
  "#0ea5e9",
  "#0f9d8f",
];
const DEPT_COLORS = [
  "#0f9d8f",
  "#2563eb",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#16a34a",
  "#0ea5e9",
  "#f97316",
];

/** محيط الدايرة (نصف القطر 42) */
export const RING_C = 2 * Math.PI * 42;

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, WorkflowStepLayoutComponent],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.scss",
})
export default class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ManagerService);

  @ViewChild("govChartCanvas") govChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild("statusChartCanvas") statusChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild("stagesChartCanvas") stagesChartCanvas?: ElementRef<HTMLCanvasElement>;

  private govChart?: Chart;
  private statusChart?: Chart;
  private stagesChart?: Chart;

  readonly essentials = [
    "متابعة نسب الإنجاز",
    "عدد الدفعات في كل قسم",
    "ملخص التسليم",
    "تفاصيل اللجان والصناديق",
  ];
  readonly stageKeys = STAGE_KEYS;
  readonly stageLabels = STAGE_LABELS;
  readonly statuses = COMMITTEE_STATUSES;
  readonly ringC = RING_C;

  // ------------------------------------------------------------ الفلاتر الأساسية (مرحلة ← سنة ← دور) — بدون اختيار افتراضي
  readonly stages = signal<Ref[]>([]);
  readonly allRounds = signal<RoundLookup[]>([]);
  readonly allSubjects = signal<SubjectLookup[]>([]);
  readonly lookupsLoading = signal(false);
  readonly lookupsError = signal<string | null>(null);

  /** السنوات جاية من API */
  readonly yearOptions = signal<{ value: number; label: string }[]>([]);

  readonly draft = signal({ stage: "", year: "", round: "" });
  readonly ctx = signal<ManagerContext | null>(null);
  readonly roundOptions = computed(() =>
    this.allRounds().filter(
      (r) => String(r.educationalStageId) === this.draft().stage,
    ),
  );
  readonly ctxValid = computed(
    () => !!this.draft().stage && !!this.draft().year && !!this.draft().round,
  );

  // ------------------------------------------------------------ الفلاتر الاختيارية
  readonly govOptions = signal<Ref[]>([]);
  readonly filterGov = signal("");
  readonly filterSubject = signal("");
  readonly subjectOptions = computed(() => {
    const st = this.ctx()?.educationalStageId;
    return this.allSubjects().filter((s) => !st || s.educationalStageId === st);
  });
  readonly chips = computed(() => {
    const out: { key: "gov" | "subject"; label: string; value: string }[] = [];
    const g = this.govOptions().find((x) => String(x.id) === this.filterGov());
    const s = this.subjectOptions().find(
      (x) => String(x.id) === this.filterSubject(),
    );
    if (g) out.push({ key: "gov", label: "المحافظة", value: g.name });
    if (s) out.push({ key: "subject", label: "المادة", value: s.name });
    return out;
  });

  // ------------------------------------------------------------ state
  readonly tab = signal<Tab>("gov");
  readonly gov = signal<Ref | null>(null);
  readonly subj = signal<Ref | null>(null);
  readonly batch = signal<Ref | null>(null);
  readonly committee = signal<Ref | null>(null);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly forbidden = signal(false);
  readonly asOf = signal<string | null>(null);

  readonly pg = signal({ page: 1, size: PAGE_SIZE, total: 0, pages: 1 });
  readonly search = signal("");
  readonly statusFilter = signal("");

  readonly rows = signal<any[]>([]);
  readonly totals = signal<any | null>(null);
  readonly header = signal<any | null>(null);
  readonly committeeRows = signal<any[]>([]);
  readonly boxes = signal<any[]>([]);
  readonly dept = signal<{
    totalBatches: number;
    totalCommittees: number;
    items: any[];
  } | null>(null);
  readonly delivery = signal<any | null>(null);
  readonly orders = signal<any[]>([]);

  private seq = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private chartTimer?: ReturnType<typeof setTimeout>;

  // ------------------------------------------------------------ level / crumbs
  readonly level = computed<Level>(() => {
    const t = this.tab();
    if (t === "dept") return "dept";
    if (t === "delivery") return "delivery";
    if (this.committee()) return "boxes";
    if (t === "search") return "search";
    if (this.batch()) return "batch-committees";
    if (t === "gov") return this.gov() ? "gov-batches" : "gov-list";
    return this.subj() ? "subj-batches" : "subj-list";
  });

  readonly showCharts = computed(() => !!this.ctx() && this.level() === "gov-list");

  readonly crumbs = computed<Crumb[]>(() => {
    const t = this.tab();
    const out: Crumb[] = [];
    if (t === "gov") {
      out.push({ label: "المحافظات", go: () => this.back("gov-list") });
      if (this.gov())
        out.push({
          label: this.gov()!.name,
          go: () => this.back("gov-batches"),
        });
    } else if (t === "subject") {
      out.push({ label: "المواد", go: () => this.back("subj-list") });
      if (this.subj())
        out.push({
          label: this.subj()!.name,
          go: () => this.back("subj-batches"),
        });
    } else if (t === "search") {
      out.push({ label: "بحث عن لجنة", go: () => this.back("search") });
    } else return [];
    if (this.batch())
      out.push({
        label: this.batch()!.name,
        go: () => this.back("batch-committees"),
      });
    if (this.committee())
      out.push({
        label: `لجنة ${this.committee()!.name}`,
        go: () => undefined,
      });
    return out;
  });
  readonly canGoBack = computed(
    () =>
      !!(this.committee() || this.batch() || this.gov() || this.subj()) &&
      this.tab() !== "dept" &&
      this.tab() !== "delivery",
  );

  readonly isProgress = computed(() =>
    ["gov-list", "subj-list", "gov-batches", "subj-batches"].includes(
      this.level(),
    ),
  );
  readonly showGlobalFilters = computed(
    () => !!this.ctx() && !["boxes", "batch-committees"].includes(this.level()),
  );
  readonly showSubjectFilter = computed(() => this.level() !== "delivery");
  readonly hasSearchBox = computed(() =>
    [
      "gov-list",
      "gov-batches",
      "subj-list",
      "subj-batches",
      "batch-committees",
      "search",
    ].includes(this.level()),
  );

  // ------------------------------------------------------------ view models
  readonly rowVMs = computed<RowVM[]>(() => {
    const lvl = this.level();
    return this.rows().map((r) => {
      const title =
        lvl === "gov-list"
          ? r.governorateName || r.name
          : lvl === "subj-list"
            ? r.subjectName || r.name
            : lvl === "gov-batches"
              ? r.subjectName || r.name
              : r.governorateName || r.name;
      const id =
        lvl === "gov-list"
          ? r.governorateId || r.id
          : lvl === "subj-list"
            ? r.subjectId || r.id
            : r.id;
      const isBatch = lvl === "gov-batches" || lvl === "subj-batches";
      const stages = this.stagesFrom(r.stages);
      return {
        id,
        title: title ?? "—",
        sub: isBatch ? (r.name ?? "") : "",
        batches: isBatch ? null : (r.batchCount ?? 0),
        committees: r.totalCommittees ?? 0,
        status: isBatch ? (r.batchStatusName ?? "") : "",
        boxes: r.boxes ?? null,
        exit: r.boxes?.exitPercent ?? null,
        stages,
        overall: this.avg(stages),
      };
    });
  });
  readonly totalsStages = computed(() =>
    this.stagesFrom(this.totals()?.stages),
  );
  readonly totalsOverall = computed(() => this.avg(this.totalsStages()));
  readonly totalsStatuses = computed<any[]>(
    () => this.totals()?.statusDistribution ?? [],
  );
  readonly deptMax = computed(() =>
    Math.max(1, ...(this.dept()?.items ?? []).map((d) => d.batchCount ?? 0)),
  );

  // ------------------------------------------------------------ charts (SVG)
  readonly statusDonut = computed(() =>
    this.buildDonut(
      this.totalsStatuses().map((s) => ({
        label: s.statusName || s.status,
        value: s.count ?? 0,
        color: this.statusColor(s.status),
      })),
    ),
  );
  readonly deptDonut = computed(() =>
    this.buildDonut(
      (this.dept()?.items ?? []).map((d, i) => ({
        label: d.departmentName,
        value: d.batchCount ?? 0,
        color: this.deptColor(i),
      })),
    ),
  );

  /** كروت التسليم الثلاثة + شريط توزيع الصناديق */
  readonly deliveryTiles = computed(() => {
    const d = this.delivery();
    const defs = [
      { k: "delivered", label: "تم التسليم", icon: "pi-check-circle", tone: "green", color: "#16a34a" },
      { k: "onOrder", label: "على أمر توريد", icon: "pi-truck", tone: "blue", color: "#2563eb" },
      { k: "waitingForOrder", label: "بانتظار أمر توريد", icon: "pi-clock", tone: "amber", color: "#f59e0b" },
    ];
    const totalBoxes = defs.reduce((a, x) => a + (d?.[x.k]?.boxes ?? 0), 0);
    return defs.map((x) => ({
      ...x,
      batches: d?.[x.k]?.batches ?? 0,
      committees: d?.[x.k]?.committees ?? 0,
      boxes: d?.[x.k]?.boxes ?? 0,
      share: totalBoxes ? ((d?.[x.k]?.boxes ?? 0) / totalBoxes) * 100 : 0,
    }));
  });

  readonly pageNumbers = computed(() => {
    const cur = this.pg().page,
      last = this.pg().pages;
    const from = Math.max(1, Math.min(cur - 2, last - 4)),
      to = Math.min(last, from + 4);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
  readonly pageFrom = computed(() =>
    this.pg().total ? (this.pg().page - 1) * this.pg().size + 1 : 0,
  );
  readonly pageTo = computed(() =>
    Math.min(this.pg().page * this.pg().size, this.pg().total),
  );

  // ------------------------------------------------------------ lifecycle
  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    clearTimeout(this.chartTimer);
    this.destroyCharts();
  }

  /** المراحل + الأدوار + المواد + السنوات (من غير أي اختيار تلقائي) */
  loadLookups(): void {
    this.lookupsLoading.set(true);
    this.lookupsError.set(null);
    let pending = 4;
    const done = () => {
      if (--pending === 0) this.lookupsLoading.set(false);
    };
    const fail = (e: any) => {
      this.lookupsError.set(this.errText(e));
      done();
    };

    this.api.lookupStages().subscribe({
      next: (r) => {
        this.stages.set(
          this.listOf(r.data)
            .filter((s) => s.isActive !== false)
            .map((s) => ({ id: s.id, name: s.name })),
        );
        done();
      },
      error: fail,
    });
    this.api.lookupRounds().subscribe({
      next: (r) => {
        this.allRounds.set(
          this.listOf(r.data).filter((x) => x.isActive !== false),
        );
        done();
      },
      error: fail,
    });
    this.api.lookupSubjects().subscribe({
      next: (r) => {
        this.allSubjects.set(
          this.listOf(r.data).filter((x) => x.isActive !== false),
        );
        done();
      },
      error: fail,
    });
    this.api.lookupYears().subscribe({
      next: (r) => {
        const years: number[] = Array.isArray(r.data) ? r.data : [];
        this.yearOptions.set(years.map((y) => ({ value: y, label: `20${y}` })));
        done();
      },
      error: () => {
        // لو فشل API السنوات نرجع للتوليد اليدوي
        const yy = new Date().getFullYear() % 100;
        this.yearOptions.set(
          [yy - 1, yy, yy + 1].map((v) => ({ value: v, label: `20${v}` })),
        );
        done();
      },
    });
  }

  // ------------------------------------------------------------ الفلاتر الأساسية
  setStage(v: string): void {
    this.draft.update((d) => ({ ...d, stage: v, round: "" }));
  }
  setYear(v: string): void {
    this.draft.update((d) => ({ ...d, year: v }));
  }
  setRound(v: string): void {
    this.draft.update((d) => ({ ...d, round: v }));
  }

  applyContext(): void {
    if (!this.ctxValid()) return;
    const d = this.draft();
    const c: ManagerContext = {
      year: +d.year,
      roundId: +d.round,
      educationalStageId: +d.stage,
    };
    this.ctx.set(c);
    this.resetDrill();
    this.resetPage();
    this.search.set("");
    this.statusFilter.set("");
    this.filterGov.set("");
    this.filterSubject.set("");
    this.loadGovOptions(c);
    this.load();
  }

  /** المحافظات اللي ليها بيانات في السياق ده (للفلتر الاختياري) */
  private loadGovOptions(c: ManagerContext): void {
    this.govOptions.set([]);
    this.api.governorates(c, { pageNumber: 1, pageSize: 100 }).subscribe({
      next: (r) =>
        this.govOptions.set(
          this.listOf(r.data?.rows).map((x) => ({
            id: x.governorateId || x.id,
            name: x.governorateName || x.name,
          })),
        ),
      error: () => undefined,
    });
  }

  // ------------------------------------------------------------ الفلاتر الاختيارية
  setFilterGov(v: string): void {
    this.filterGov.set(v);
    this.refilter();
  }
  setFilterSubject(v: string): void {
    this.filterSubject.set(v);
    this.refilter();
  }
  clearChip(k: "gov" | "subject"): void {
    k === "gov" ? this.setFilterGov("") : this.setFilterSubject("");
  }
  clearFilters(): void {
    this.filterGov.set("");
    this.filterSubject.set("");
    this.refilter();
  }
  private refilter(): void {
    this.resetPage();
    this.load();
  }

  // ------------------------------------------------------------ navigation
  setTab(t: Tab): void {
    if (t === this.tab()) return;
    this.tab.set(t);
    this.resetDrill();
    this.resetPage();
    this.search.set("");
    this.statusFilter.set("");
    this.load();
  }

  openRow(r: RowVM): void {
    const lvl = this.level();
    if (lvl === "gov-list") this.gov.set({ id: r.id, name: r.title });
    else if (lvl === "subj-list") this.subj.set({ id: r.id, name: r.title });
    else this.batch.set({ id: r.id, name: r.sub || r.title });
    this.afterNav();
  }
  openCommittee(c: any): void {
    this.committee.set({
      id: c.committeeId ?? c.id,
      name: String(c.committeeNumber ?? c.id),
    });
    this.afterNav();
  }
  private afterNav(): void {
    this.resetPage();
    this.search.set("");
    this.boxes.set([]);
    this.header.set(null);
    this.destroyCharts();
    this.load();
  }

  private back(to: Level): void {
    switch (to) {
      case "gov-list":
        this.gov.set(null);
        this.batch.set(null);
        this.committee.set(null);
        break;
      case "subj-list":
        this.subj.set(null);
        this.batch.set(null);
        this.committee.set(null);
        break;
      case "gov-batches":
      case "subj-batches":
        this.batch.set(null);
        this.committee.set(null);
        break;
      case "batch-committees":
      case "search":
        this.committee.set(null);
        break;
    }
    this.afterNav();
  }
  goBack(): void {
    if (this.committee()) this.committee.set(null);
    else if (this.batch()) this.batch.set(null);
    else if (this.gov()) this.gov.set(null);
    else if (this.subj()) this.subj.set(null);
    else return;
    this.afterNav();
  }

  private resetDrill(): void {
    this.gov.set(null);
    this.subj.set(null);
    this.batch.set(null);
    this.committee.set(null);
    this.rows.set([]);
    this.totals.set(null);
    this.header.set(null);
    this.boxes.set([]);
    this.committeeRows.set([]);
    this.dept.set(null);
    this.delivery.set(null);
    this.orders.set([]);
    this.destroyCharts();
  }
  private resetPage(): void {
    this.pg.set({ page: 1, size: PAGE_SIZE, total: 0, pages: 1 });
  }

  // ------------------------------------------------------------ بحث / ترقيم
  onSearch(v: string): void {
    this.search.set(v);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.resetPage();
      this.load();
    }, 450);
  }
  onSearchEnter(): void {
    clearTimeout(this.searchTimer);
    this.resetPage();
    this.load();
  }
  setStatus(v: string): void {
    this.statusFilter.set(v);
    this.resetPage();
    this.load();
  }
  goPage(p: number): void {
    if (p < 1 || p > this.pg().pages || p === this.pg().page || this.loading())
      return;
    this.pg.update((s) => ({ ...s, page: p }));
    this.load();
  }
  refresh(): void {
    this.load();
  }

  // ------------------------------------------------------------ loading
  load(): void {
    const c = this.ctx();
    if (!c) return;
    const lvl = this.level();
    const { page, size } = this.pg();
    const fg = this.posInt(this.filterGov()),
      fs = this.posInt(this.filterSubject());
    const base: ManagerQuery = {
      pageNumber: page,
      pageSize: size,
      searchTerm: this.search(),
      governorateId: fg,
      subjectId: fs,
    };

    this.loading.set(true);
    this.error.set(null);
    this.forbidden.set(false);
    const t = ++this.seq;

    switch (lvl) {
      case "gov-list":
        this.run(this.api.governorates(c, base), t, (d) => {
          this.setRows(d);
          // ننتظر Angular يرسم الـ canvas ثم نبني الرسوم
          clearTimeout(this.chartTimer);
          this.chartTimer = setTimeout(() => this.renderGovCharts(), 100);
        });
        break;
      case "subj-list":
        this.run(this.api.subjects(c, base), t, (d) => this.setRows(d));
        break;
      case "gov-batches":
        this.run(
          this.api.batches(c, { ...base, governorateId: this.gov()!.id }),
          t,
          (d) => this.setRows(d),
        );
        break;
      case "subj-batches":
        this.run(
          this.api.batches(c, { ...base, subjectId: this.subj()!.id }),
          t,
          (d) => this.setRows(d),
        );
        break;
      case "batch-committees":
        this.run(
          this.api.batchCommittees(this.batch()!.id, {
            pageNumber: page,
            pageSize: size,
            searchTerm: this.search(),
          }),
          t,
          (d) => {
            this.header.set(d.batch ?? null);
            this.setPaged(d.committees, this.committeeRows);
          },
        );
        break;
      case "boxes":
        this.run(
          this.api.committeeBoxes(this.committee()!.id, {
            pageNumber: page,
            pageSize: size,
          }),
          t,
          (d) => {
            this.header.set(d.committee ?? null);
            this.setPaged(d.boxes, this.boxes);
          },
        );
        break;
      case "search":
        this.run(
          this.api.committees(c, { ...base, status: this.statusFilter() }),
          t,
          (d) => this.setPaged(d, this.committeeRows),
        );
        break;
      case "dept":
        this.run(
          this.api.departments(c, { governorateId: fg, subjectId: fs }),
          t,
          (d) =>
            this.dept.set({
              totalBatches: d.totalBatches ?? 0,
              totalCommittees: d.totalCommittees ?? 0,
              items: d.departments ?? [],
            }),
        );
        break;
      case "delivery":
        this.run(
          this.api.delivery(c, {
            pageNumber: page,
            pageSize: size,
            governorateId: fg,
          }),
          t,
          (d) => {
            this.delivery.set(d);
            this.setPaged(d.orders, this.orders);
          },
        );
        break;
    }
  }

  private run(
    obs: Observable<ManagerResponse>,
    t: number,
    ok: (d: any) => void,
  ): void {
    obs.subscribe({
      next: (r) => {
        if (t !== this.seq) return;
        if (!r.success) {
          this.error.set(r.message || "تعذر تحميل البيانات");
          this.loading.set(false);
          return;
        }
        const d = r.data ?? {};
        ok(d);
        this.asOf.set(d.asOf ?? null);
        this.loading.set(false);
      },
      error: (e) => {
        if (t !== this.seq) return;
        this.loading.set(false);
        if (e?.status === 403) {
          this.forbidden.set(true);
          return;
        }
        this.error.set(this.errText(e));
      },
    });
  }

  private setRows(d: any): void {
    this.totals.set(d.totals ?? null);
    this.setPaged(d.rows, this.rows);
  }
  /** يقبل مصفوفة أو object paged فيه data[] */
  private setPaged(p: any, target: { set(v: any[]): void }): void {
    const items = this.listOf(p);
    target.set(items);
    const total = p?.totalCount ?? items.length;
    this.pg.update((s) => ({
      ...s,
      total,
      pages: Math.max(1, p?.totalPages ?? Math.ceil(total / s.size)),
    }));
  }
  private listOf(p: any): any[] {
    if (Array.isArray(p)) return p;
    if (Array.isArray(p?.data)) return p.data;
    if (Array.isArray(p?.items)) return p.items;
    return [];
  }

  // ------------------------------------------------------------ Charts (Chart.js)
  private destroyCharts(): void {
    this.govChart?.destroy();
    this.govChart = undefined;
    this.statusChart?.destroy();
    this.statusChart = undefined;
    this.stagesChart?.destroy();
    this.stagesChart = undefined;
  }

  renderGovCharts(): void {
    this.renderGovProgressChart();
    this.renderStatusDoughnutChart();
    this.renderStagesBarChart();
  }

  private renderGovProgressChart(): void {
    const canvas = this.govChartCanvas?.nativeElement;
    if (!canvas) return;
    this.govChart?.destroy();

    const rows = this.rowVMs();
    const labels = rows.map((r) => r.title);
    const data = rows.map((r) => Math.round((r.overall ?? 0) * 10) / 10);
    const colors = data.map((v) => this.healthColor(v));

    this.govChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "نسبة الإنجاز الإجمالية %",
            data,
            backgroundColor: colors.map((c) => c + "cc"),
            borderColor: colors,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x}%` } },
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: { callback: (v) => `${v}%`, font: { family: "inherit", size: 12 } },
            grid: { color: "#e6ebf2" },
          },
          y: { ticks: { font: { family: "inherit", size: 12 } }, grid: { display: false } },
        },
      },
    });
  }

  private renderStatusDoughnutChart(): void {
    const canvas = this.statusChartCanvas?.nativeElement;
    if (!canvas) return;
    this.statusChart?.destroy();

    const statuses = this.totalsStatuses();
    if (!statuses.length) return;

    const labels = statuses.map(
      (s) =>
        COMMITTEE_STATUSES.find((x) => x.value === s.status)?.label ??
        s.statusName ??
        s.status,
    );
    const data = statuses.map((s) => s.count ?? 0);
    const colors = statuses.map((s) => this.statusColor(s.status));

    this.statusChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors.map((c) => c + "cc"),
            borderColor: colors,
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              font: { family: "inherit", size: 11 },
              padding: 10,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = total ? Math.round((ctx.parsed / total) * 100) : 0;
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  private renderStagesBarChart(): void {
    const canvas = this.stagesChartCanvas?.nativeElement;
    if (!canvas) return;
    this.stagesChart?.destroy();

    const stages = this.totalsStages();
    if (!stages.length) return;

    const labels = stages.map((s) => s.label);
    const data = stages.map((s) => Math.round((s.percent ?? 0) * 10) / 10);
    const colors = STAGE_KEYS.map((k) => STAGE_COLORS[k]);

    this.stagesChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "نسبة الإنجاز %",
            data,
            backgroundColor: colors.map((c) => c + "aa"),
            borderColor: colors,
            borderWidth: 2,
            borderRadius: 10,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y}%` } },
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: (v) => `${v}%`, font: { family: "inherit", size: 12 } },
            grid: { color: "#e6ebf2" },
          },
          x: {
            ticks: { font: { family: "inherit", size: 13, weight: "bold" } },
            grid: { display: false },
          },
        },
      },
    });
  }

  // ------------------------------------------------------------ view helpers
  stagesFrom(list: any): StageVM[] {
    const arr: any[] = Array.isArray(list) ? list : [];
    return STAGE_KEYS.map((k) => {
      const s = arr.find((x) => x.stage === k);
      return {
        key: k,
        label: STAGE_LABELS[k],
        percent: s?.percent ?? null,
        completed: s?.completed ?? null,
      };
    });
  }
  /** متوسط نسب المراحل اللي ليها بيانات (null لو مفيش) */
  private avg(stages: StageVM[]): number | null {
    const v = stages.map((s) => s.percent).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  /** percent = null (مفيش لجان) تتعرض "—" */
  pct(p: number | null | undefined): string {
    return p === null || p === undefined ? "—" : `${Math.round(p * 10) / 10}%`;
  }
  width(p: number | null | undefined): number {
    return Math.max(0, Math.min(100, p ?? 0));
  }
  ratio(part: number | undefined, whole: number | undefined): number {
    return whole ? Math.min(100, ((part ?? 0) / whole) * 100) : 0;
  }

  /** stroke-dasharray لدايرة نسبة */
  ringDash(p: number | null | undefined): string {
    const len = (this.width(p) / 100) * RING_C;
    return `${len} ${RING_C}`;
  }
  stageColor(k: StageKey): string {
    return STAGE_COLORS[k];
  }
  statusColor(v: string | undefined): string {
    const i = COMMITTEE_STATUSES.findIndex((s) => s.value === v);
    return STATUS_COLORS[i] ?? "#94a3b8";
  }
  deptColor(i: number): string {
    return DEPT_COLORS[i % DEPT_COLORS.length];
  }
  /** أحمر ← أصفر ← أخضر حسب النسبة */
  healthColor(p: number | null | undefined): string {
    if (p === null || p === undefined) return "#94a3b8";
    return p >= 75 ? "#16a34a" : p >= 40 ? "#d99a0b" : "#dc2626";
  }

  private buildDonut(items: Slice[]): { total: number; segs: DonutSeg[] } {
    const data = items.filter((i) => i.value > 0);
    const total = data.reduce((a, b) => a + b.value, 0);
    let acc = 0;
    const segs = data.map((i) => {
      const len = total ? (i.value / total) * RING_C : 0;
      const seg: DonutSeg = {
        ...i,
        dash: `${Math.max(0, len - 1.5)} ${RING_C}`,
        offset: -acc,
        share: total ? (i.value / total) * 100 : 0,
      };
      acc += len;
      return seg;
    });
    return { total, segs };
  }

  statusLabel(v: string | undefined): string {
    return COMMITTEE_STATUSES.find((s) => s.value === v)?.label ?? v ?? "—";
  }
  committeeStatus(c: any): string {
    return c?.statusName ?? this.statusLabel(c?.status);
  }
  tone(status: string | undefined): "green" | "blue" | "amber" | "gray" {
    const s = status ?? "";
    if (/Delivered|DeliveryOrder/.test(s)) return "blue";
    if (/Stored/.test(s)) return "green";
    if (/InProgress|Ready|Pending|Completed/.test(s)) return "amber";
    return "gray";
  }
  place(l: any): string {
    return l
      ? [l.warehouseName, l.area, l.rack, l.shelf, l.bin].filter(Boolean).join(" · ")
      : "";
  }
  boxPlace(b: any): string {
    return this.place(b.currentLocation) || (b.deliveredAt ? "خرج من المخزن" : "لم يُخزَّن بعد");
  }
  orderTone(o: any): "green" | "blue" | "amber" | "gray" {
    const s = o.status ?? "";
    return /Delivered/i.test(s)
      ? "green"
      : /Cancel/i.test(s)
        ? "gray"
        : /Progress|Partial/i.test(s)
          ? "amber"
          : "blue";
  }
  orderPct(done: number, total: number): number {
    return total ? Math.round((done / total) * 100) : 0;
  }

  private posInt(v: string | number | null | undefined): number | null {
    const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  private errText(e: any): string {
    return e?.error?.message || e?.error?.errors?.[0] || e?.message || "حصل خطأ في الاتصال";
  }
}
