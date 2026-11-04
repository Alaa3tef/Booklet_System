import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { WorkflowStepLayoutComponent } from '../../shared/workflow-step-layout/workflow-step-layout.component';
import { StageKey, ManagerService, STAGE_KEYS, RoundLookup, SubjectLookup, ManagerContext, ManagerQuery, ManagerResponse } from './service/manager-service';
import { RouterLink } from '@angular/router';



type Tab = 'gov' | 'subject' | 'dept' | 'delivery' | 'search';
type Level = 'gov-list' | 'gov-batches' | 'subj-list' | 'subj-batches' | 'batch-committees' | 'boxes' | 'dept' | 'delivery' | 'search';
type Crumb = { label: string; go: () => void };
interface Ref { id: number; name: string; }
interface StageVM { key: StageKey; label: string; percent: number | null; completed: number | null; }
interface RowVM {
  id: number; title: string; sub: string; batches: number | null; committees: number; status: string;
  boxes: any; exit: number | null; stages: StageVM[];
}

const PAGE_SIZE = 12;
const STORE_KEY = 'manager.filters';

export const STAGE_LABELS: Record<StageKey, string> = { Printing: 'الطباعة', Quality: 'الجودة', Packing: 'التغليف', Storage: 'التخزين' };

/** حالات اللجنة (من جدول الأقسام في الـ PDF) */
export const COMMITTEE_STATUSES: { value: string; label: string }[] = [
  { value: 'Generated', label: 'تم الإنشاء' }, { value: 'ITCompleted', label: 'اكتمل IT' },
  { value: 'PendingPrintApproval', label: 'بانتظار اعتماد الطباعة' }, { value: 'ReadyForPrinting', label: 'جاهزة للطباعة' },
  { value: 'PrintingInProgress', label: 'الطباعة جارية' }, { value: 'PrintingCompleted', label: 'اكتملت الطباعة' },
  { value: 'QualityInProgress', label: 'الجودة جارية' }, { value: 'QualityCompleted', label: 'اكتملت الجودة' },
  { value: 'PackingInProgress', label: 'التغليف جارٍ' }, { value: 'PackingCompleted', label: 'اكتمل التغليف' },
  { value: 'Stored', label: 'تم التخزين' }, { value: 'DeliveryOrderAssigned', label: 'على أمر توريد' },
  { value: 'Delivered', label: 'تم التسليم' },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, WorkflowStepLayoutComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export default class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ManagerService);

  readonly essentials = ['متابعة نسب الإنجاز', 'عدد الدفعات في كل قسم', 'ملخص التسليم', 'تفاصيل اللجان والصناديق'];
  readonly stageKeys = STAGE_KEYS;
  readonly stageLabels = STAGE_LABELS;
  readonly statuses = COMMITTEE_STATUSES;

  // ------------------------------------------------------------ الفلاتر الأساسية (مرحلة ← سنة ← دور)
  readonly stages = signal<Ref[]>([]);
  readonly allRounds = signal<RoundLookup[]>([]);
  readonly allSubjects = signal<SubjectLookup[]>([]);
  readonly lookupsLoading = signal(false);
  readonly lookupsError = signal<string | null>(null);

  /** السنة بصيغة رقمين (27) والعرض 2027 */
  readonly yearOptions = (() => {
    const yy = new Date().getFullYear() % 100;
    return [yy - 1, yy, yy + 1, yy + 2].map(v => ({ value: v, label: `20${v}` }));
  })();

  readonly draft = signal({ stage: '', year: '', round: '' });
  readonly ctx = signal<ManagerContext | null>(null);
  readonly roundOptions = computed(() => this.allRounds().filter(r => String(r.educationalStageId) === this.draft().stage));
  readonly ctxValid = computed(() => !!this.draft().stage && !!this.draft().year && !!this.draft().round);

  // ------------------------------------------------------------ الفلاتر الاختيارية (محافظة / مادة)
  readonly govOptions = signal<Ref[]>([]);
  readonly filterGov = signal('');
  readonly filterSubject = signal('');
  readonly subjectOptions = computed(() => {
    const st = this.ctx()?.educationalStageId;
    return this.allSubjects().filter(s => !st || s.educationalStageId === st);
  });
  readonly chips = computed(() => {
    const out: { key: 'gov' | 'subject'; label: string; value: string }[] = [];
    const g = this.govOptions().find(x => String(x.id) === this.filterGov());
    const s = this.subjectOptions().find(x => String(x.id) === this.filterSubject());
    if (g) out.push({ key: 'gov', label: 'المحافظة', value: g.name });
    if (s) out.push({ key: 'subject', label: 'المادة', value: s.name });
    return out;
  });

  // ------------------------------------------------------------ state
  readonly tab = signal<Tab>('gov');
  readonly gov = signal<Ref | null>(null);
  readonly subj = signal<Ref | null>(null);
  readonly batch = signal<Ref | null>(null);
  readonly committee = signal<Ref | null>(null);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly forbidden = signal(false);
  readonly asOf = signal<string | null>(null);

  readonly pg = signal({ page: 1, size: PAGE_SIZE, total: 0, pages: 1 });
  readonly search = signal('');
  readonly statusFilter = signal('');

  readonly rows = signal<any[]>([]);
  readonly totals = signal<any | null>(null);
  readonly header = signal<any | null>(null);
  readonly committeeRows = signal<any[]>([]);
  readonly boxes = signal<any[]>([]);
  readonly dept = signal<{ totalBatches: number; totalCommittees: number; items: any[] } | null>(null);
  readonly delivery = signal<any | null>(null);
  readonly orders = signal<any[]>([]);

  private seq = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;

  // ------------------------------------------------------------ level / crumbs
  readonly level = computed<Level>(() => {
    const t = this.tab();
    if (t === 'dept') return 'dept';
    if (t === 'delivery') return 'delivery';
    if (this.committee()) return 'boxes';
    if (t === 'search') return 'search';
    if (this.batch()) return 'batch-committees';
    if (t === 'gov') return this.gov() ? 'gov-batches' : 'gov-list';
    return this.subj() ? 'subj-batches' : 'subj-list';
  });

  readonly crumbs = computed<Crumb[]>(() => {
    const t = this.tab();
    const out: Crumb[] = [];
    if (t === 'gov') {
      out.push({ label: 'المحافظات', go: () => this.back('gov-list') });
      if (this.gov()) out.push({ label: this.gov()!.name, go: () => this.back('gov-batches') });
    } else if (t === 'subject') {
      out.push({ label: 'المواد', go: () => this.back('subj-list') });
      if (this.subj()) out.push({ label: this.subj()!.name, go: () => this.back('subj-batches') });
    } else if (t === 'search') {
      out.push({ label: 'بحث عن لجنة', go: () => this.back('search') });
    } else return [];
    if (this.batch()) out.push({ label: this.batch()!.name, go: () => this.back('batch-committees') });
    if (this.committee()) out.push({ label: `لجنة ${this.committee()!.name}`, go: () => undefined });
    return out;
  });
  readonly canGoBack = computed(() => !!(this.committee() || this.batch() || this.gov() || this.subj()) && this.tab() !== 'dept' && this.tab() !== 'delivery');

  readonly isProgress = computed(() => ['gov-list', 'subj-list', 'gov-batches', 'subj-batches'].includes(this.level()));
  readonly showGlobalFilters = computed(() => !!this.ctx() && !['boxes', 'batch-committees'].includes(this.level()));
  readonly showSubjectFilter = computed(() => this.level() !== 'delivery');
  readonly hasSearchBox = computed(() => ['gov-list', 'gov-batches', 'subj-list', 'subj-batches', 'batch-committees', 'search'].includes(this.level()));

  // ------------------------------------------------------------ view models
  readonly rowVMs = computed<RowVM[]>(() => {
    const lvl = this.level();
    return this.rows().map(r => {
      const title = lvl === 'gov-list' ? (r.governorateName || r.name)
        : lvl === 'subj-list' ? (r.subjectName || r.name)
        : lvl === 'gov-batches' ? (r.subjectName || r.name) : (r.governorateName || r.name);
      const id = lvl === 'gov-list' ? (r.governorateId || r.id) : lvl === 'subj-list' ? (r.subjectId || r.id) : r.id;
      const isBatch = lvl === 'gov-batches' || lvl === 'subj-batches';
      return {
        id, title: title ?? '—', sub: isBatch ? (r.name ?? '') : '',
        batches: isBatch ? null : (r.batchCount ?? 0), committees: r.totalCommittees ?? 0,
        status: isBatch ? (r.batchStatusName ?? '') : '', boxes: r.boxes ?? null,
        exit: r.boxes?.exitPercent ?? null, stages: this.stagesFrom(r.stages),
      };
    });
  });
  readonly totalsStages = computed(() => this.stagesFrom(this.totals()?.stages));
  readonly totalsStatuses = computed<any[]>(() => this.totals()?.statusDistribution ?? []);
  readonly deptMax = computed(() => Math.max(1, ...(this.dept()?.items ?? []).map(d => d.batchCount ?? 0)));

  readonly pageNumbers = computed(() => {
    const cur = this.pg().page, last = this.pg().pages;
    const from = Math.max(1, Math.min(cur - 2, last - 4)), to = Math.min(last, from + 4);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
  readonly pageFrom = computed(() => (this.pg().total ? (this.pg().page - 1) * this.pg().size + 1 : 0));
  readonly pageTo = computed(() => Math.min(this.pg().page * this.pg().size, this.pg().total));

  // ------------------------------------------------------------ lifecycle
  ngOnInit(): void {
    this.loadLookups();
  }
  ngOnDestroy(): void { clearTimeout(this.searchTimer); }

  /** المراحل + الأدوار + المواد (بدون pagination) */
  loadLookups(): void {
    this.lookupsLoading.set(true);
    this.lookupsError.set(null);
    let pending = 3;
    const done = () => { if (--pending === 0) { this.lookupsLoading.set(false); this.restore(); } };
    const fail = (e: any) => { this.lookupsError.set(this.errText(e)); done(); };

    this.api.lookupStages().subscribe({
      next: r => { this.stages.set(this.listOf(r.data).filter(s => s.isActive !== false).map(s => ({ id: s.id, name: s.name }))); done(); },
      error: fail,
    });
    this.api.lookupRounds().subscribe({
      next: r => { this.allRounds.set(this.listOf(r.data).filter(x => x.isActive !== false)); done(); },
      error: fail,
    });
    this.api.lookupSubjects().subscribe({
      next: r => { this.allSubjects.set(this.listOf(r.data).filter(x => x.isActive !== false)); done(); },
      error: fail,
    });
  }

  private restore(): void {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? 'null');
      if (!saved?.draft) return;
      this.draft.set(saved.draft);
      if (this.ctxValid()) { this.applyContext(saved.gov ?? '', saved.subject ?? ''); }
    } catch { /* ignore */ }
  }
  private persist(): void {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ draft: this.draft(), gov: this.filterGov(), subject: this.filterSubject() }));
    } catch { /* ignore */ }
  }

  // ------------------------------------------------------------ الفلاتر الأساسية
  setStage(v: string): void { this.draft.update(d => ({ ...d, stage: v, round: '' })); }
  setYear(v: string): void { this.draft.update(d => ({ ...d, year: v })); }
  setRound(v: string): void { this.draft.update(d => ({ ...d, round: v })); }

  applyContext(gov = '', subject = ''): void {
    if (!this.ctxValid()) return;
    const d = this.draft();
    const c: ManagerContext = { year: +d.year, roundId: +d.round, educationalStageId: +d.stage };
    this.ctx.set(c);
    this.resetDrill(); this.resetPage();
    this.search.set(''); this.statusFilter.set('');
    this.filterGov.set(gov); this.filterSubject.set(subject);
    this.persist();
    this.loadGovOptions(c);
    this.load();
  }

  /** المحافظات اللي ليها بيانات في السياق ده (للفلتر الاختياري) */
  private loadGovOptions(c: ManagerContext): void {
    this.govOptions.set([]);
    this.api.governorates(c, { pageNumber: 1, pageSize: 100 }).subscribe({
      next: r => this.govOptions.set(this.listOf(r.data?.rows)
        .map(x => ({ id: x.governorateId || x.id, name: x.governorateName || x.name }))),
      error: () => undefined,
    });
  }

  // ------------------------------------------------------------ الفلاتر الاختيارية
  setFilterGov(v: string): void { this.filterGov.set(v); this.persist(); this.refilter(); }
  setFilterSubject(v: string): void { this.filterSubject.set(v); this.persist(); this.refilter(); }
  clearChip(k: 'gov' | 'subject'): void { k === 'gov' ? this.setFilterGov('') : this.setFilterSubject(''); }
  clearFilters(): void { this.filterGov.set(''); this.filterSubject.set(''); this.persist(); this.refilter(); }
  private refilter(): void { this.resetPage(); this.load(); }

  // ------------------------------------------------------------ navigation
  setTab(t: Tab): void {
    if (t === this.tab()) return;
    this.tab.set(t);
    this.resetDrill(); this.resetPage();
    this.search.set(''); this.statusFilter.set('');
    this.load();
  }

  openRow(r: RowVM): void {
    const lvl = this.level();
    if (lvl === 'gov-list') this.gov.set({ id: r.id, name: r.title });
    else if (lvl === 'subj-list') this.subj.set({ id: r.id, name: r.title });
    else this.batch.set({ id: r.id, name: r.sub || r.title });
    this.afterNav();
  }
  openCommittee(c: any): void {
    this.committee.set({ id: c.committeeId ?? c.id, name: String(c.committeeNumber ?? c.id) });
    this.afterNav();
  }
  private afterNav(): void { this.resetPage(); this.search.set(''); this.boxes.set([]); this.header.set(null); this.load(); }

  private back(to: Level): void {
    switch (to) {
      case 'gov-list': this.gov.set(null); this.batch.set(null); this.committee.set(null); break;
      case 'subj-list': this.subj.set(null); this.batch.set(null); this.committee.set(null); break;
      case 'gov-batches': case 'subj-batches': this.batch.set(null); this.committee.set(null); break;
      case 'batch-committees': case 'search': this.committee.set(null); break;
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
    this.gov.set(null); this.subj.set(null); this.batch.set(null); this.committee.set(null);
    this.rows.set([]); this.totals.set(null); this.header.set(null); this.boxes.set([]); this.committeeRows.set([]);
    this.dept.set(null); this.delivery.set(null); this.orders.set([]);
  }
  private resetPage(): void { this.pg.set({ page: 1, size: PAGE_SIZE, total: 0, pages: 1 }); }

  // ------------------------------------------------------------ بحث / ترقيم
  onSearch(v: string): void {
    this.search.set(v);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.resetPage(); this.load(); }, 450);
  }
  onSearchEnter(): void { clearTimeout(this.searchTimer); this.resetPage(); this.load(); }
  setStatus(v: string): void { this.statusFilter.set(v); this.resetPage(); this.load(); }
  goPage(p: number): void {
    if (p < 1 || p > this.pg().pages || p === this.pg().page || this.loading()) return;
    this.pg.update(s => ({ ...s, page: p }));
    this.load();
  }
  refresh(): void { this.load(); }

  // ------------------------------------------------------------ loading
  load(): void {
    const c = this.ctx();
    if (!c) return;
    const lvl = this.level();
    const { page, size } = this.pg();
    const fg = this.posInt(this.filterGov()), fs = this.posInt(this.filterSubject());
    const base: ManagerQuery = { pageNumber: page, pageSize: size, searchTerm: this.search(), governorateId: fg, subjectId: fs };

    this.loading.set(true); this.error.set(null); this.forbidden.set(false);
    const t = ++this.seq;

    switch (lvl) {
      case 'gov-list': this.run(this.api.governorates(c, base), t, d => this.setRows(d)); break;
      case 'subj-list': this.run(this.api.subjects(c, base), t, d => this.setRows(d)); break;
      case 'gov-batches': this.run(this.api.batches(c, { ...base, governorateId: this.gov()!.id }), t, d => this.setRows(d)); break;
      case 'subj-batches': this.run(this.api.batches(c, { ...base, subjectId: this.subj()!.id }), t, d => this.setRows(d)); break;
      case 'batch-committees':
        this.run(this.api.batchCommittees(this.batch()!.id, { pageNumber: page, pageSize: size, searchTerm: this.search() }), t, d => {
          this.header.set(d.batch ?? null);
          this.setPaged(d.committees, this.committeeRows);
        });
        break;
      case 'boxes':
        this.run(this.api.committeeBoxes(this.committee()!.id, { pageNumber: page, pageSize: size }), t, d => {
          this.header.set(d.committee ?? null);
          this.setPaged(d.boxes, this.boxes);
        });
        break;
      case 'search':
        this.run(this.api.committees(c, { ...base, status: this.statusFilter() }), t, d => this.setPaged(d, this.committeeRows));
        break;
      case 'dept':
        this.run(this.api.departments(c, { governorateId: fg, subjectId: fs }), t, d =>
          this.dept.set({ totalBatches: d.totalBatches ?? 0, totalCommittees: d.totalCommittees ?? 0, items: d.departments ?? [] }));
        break;
      case 'delivery':
        this.run(this.api.delivery(c, { pageNumber: page, pageSize: size, governorateId: fg }), t, d => {
          this.delivery.set(d);
          this.setPaged(d.orders, this.orders);
        });
        break;
    }
  }

  private run(obs: Observable<ManagerResponse>, t: number, ok: (d: any) => void): void {
    obs.subscribe({
      next: r => {
        if (t !== this.seq) return;
        if (!r.success) { this.error.set(r.message || 'تعذر تحميل البيانات'); this.loading.set(false); return; }
        const d = r.data ?? {};
        ok(d);
        this.asOf.set(d.asOf ?? null);
        this.loading.set(false);
      },
      error: e => {
        if (t !== this.seq) return;
        this.loading.set(false);
        if (e?.status === 403) { this.forbidden.set(true); return; }
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
    this.pg.update(s => ({ ...s, total, pages: Math.max(1, p?.totalPages ?? Math.ceil(total / s.size)) }));
  }
  private listOf(p: any): any[] {
    if (Array.isArray(p)) return p;
    if (Array.isArray(p?.data)) return p.data;
    if (Array.isArray(p?.items)) return p.items;
    return [];
  }

  // ------------------------------------------------------------ view helpers
  stagesFrom(list: any): StageVM[] {
    const arr: any[] = Array.isArray(list) ? list : [];
    return STAGE_KEYS.map(k => {
      const s = arr.find(x => x.stage === k);
      return { key: k, label: STAGE_LABELS[k], percent: s?.percent ?? null, completed: s?.completed ?? null };
    });
  }
  /** percent = null (مفيش لجان) تتعرض "—" */
  pct(p: number | null | undefined): string { return p === null || p === undefined ? '—' : `${Math.round(p * 10) / 10}%`; }
  width(p: number | null | undefined): number { return Math.max(0, Math.min(100, p ?? 0)); }
  ratio(part: number | undefined, whole: number | undefined): number { return whole ? Math.min(100, ((part ?? 0) / whole) * 100) : 0; }

  statusLabel(v: string | undefined): string { return COMMITTEE_STATUSES.find(s => s.value === v)?.label ?? v ?? '—'; }
  committeeStatus(c: any): string { return c?.statusName ?? this.statusLabel(c?.status); }
  tone(status: string | undefined): 'green' | 'blue' | 'amber' | 'gray' {
    const s = status ?? '';
    if (/Delivered|DeliveryOrder/.test(s)) return 'blue';
    if (/Stored/.test(s)) return 'green';
    if (/InProgress|Ready|Pending|Completed/.test(s)) return 'amber';
    return 'gray';
  }
  place(l: any): string {
    return l ? [l.warehouseName, l.area, l.rack, l.shelf, l.bin].filter(Boolean).join(' · ') : '';
  }
  boxPlace(b: any): string {
    return this.place(b.currentLocation) || (b.deliveredAt ? 'خرج من المخزن' : 'لم يُخزَّن بعد');
  }
  orderTone(o: any): 'green' | 'blue' | 'amber' | 'gray' {
    const s = o.status ?? '';
    return /Delivered/i.test(s) ? 'green' : /Cancel/i.test(s) ? 'gray' : /Progress|Partial/i.test(s) ? 'amber' : 'blue';
  }
  orderPct(done: number, total: number): number { return total ? Math.round((done / total) * 100) : 0; }

  private posInt(v: string | number | null | undefined): number | null {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  private errText(e: any): string {
    return e?.error?.message || e?.error?.errors?.[0] || e?.message || 'حصل خطأ في الاتصال';
  }
}
