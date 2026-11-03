import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  ViewEncapsulation,
  WritableSignal,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, catchError, finalize, of } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { Lookups } from '../../../shared/services/lookups';
import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import {
  CommitteeBox,
  PackProblem,
  PackRequest,
  PackResult,
  PackingBatch,
  PackingCommittee
} from './model/packing.model';
import { PackingService } from './service/packing';

// =====================================================
// Types
// =====================================================

type Step = 'committees' | 'packing';
type PagerKind = 'batch' | 'committee';
type Tone = 'success' | 'warning' | 'danger';
type LeaveTarget = 'committees' | 'close';

interface Option {
  label: string;
  value: string;
}

interface EnvelopeVm {
  serial: string;
  kind: 'main' | 'reserve';
  scanned: boolean;
  scannedAt: string | null;
}

interface BoxVm {
  boxId: number;
  sequenceNo: number;
  qrCode: string;
  expectedEnvelopeCount: number;
  qrScanned: boolean;
  envelopes: EnvelopeVm[];
}

interface BoxView extends BoxVm {
  main: EnvelopeVm[];
  reserve: EnvelopeVm[];
  mainTotal: number;
  mainScanned: number;
  reserveTotal: number;
  reserveScanned: number;
  complete: boolean;
  progress: number;
}

interface ScanFeedback {
  id: number;
  tone: Tone;
  code: string;
  text: string;
}

interface ScanLog extends ScanFeedback {
  time: string;
}

// =====================================================
// Pager factory (مستخدم للمواد واللجان)
// =====================================================

function buildPages(current: number, total: number): (number | 'dots')[] {
  if (total <= 4) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  if (current <= 2) {
    return [1, 2, 3, 'dots', total];
  }

  if (current >= total - 1) {
    return [1, 'dots', total - 2, total - 1, total];
  }

  return [1, 'dots', current, 'dots', total];
}

function createPager(initialSize = 6) {
  const page = signal(1);
  const size = signal(initialSize);
  const total = signal(0);

  const totalPages = computed(() => Math.max(1, Math.ceil(total() / size())));
  const pages = computed(() => buildPages(page(), totalPages()));
  const start = computed(() => (total() ? (page() - 1) * size() + 1 : 0));
  const end = computed(() => Math.min(page() * size(), total()));

  return { page, size, total, totalPages, pages, start, end };
}

type Pager = ReturnType<typeof createPager>;

// =====================================================
// Component
// =====================================================

@Component({
  selector: 'app-packing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    TooltipModule,
    WorkflowStepLayoutComponent
  ],
  templateUrl: './packing.component.html',
  styleUrl: './packing.component.scss',
  encapsulation: ViewEncapsulation.None
})
export default class PackingComponent implements OnInit {
  private readonly api = inject(PackingService);
  private readonly lookups = inject(Lookups);
  private readonly destroyRef = inject(DestroyRef);

  readonly essentials = [
    'اختيار المادة ثم اللجنة المطلوب تغليفها',
    'مسح QR الصناديق وسيريال الأظرف بجهاز القراءة',
    'تأكيد التغليف بعد اكتمال المسح'
  ];

  readonly pageSizes = [
    { label: '6', value: 6 },
    { label: '12', value: 12 },
    { label: '24', value: 24 }
  ];

  ngOnInit(): void {
    this.loadSubjects();
    this.loadGovernorates();
    this.loadBatches();

    this.destroyRef.onDestroy(() => {
      this.clearIdleTimer();
      this.clearSearchTimer();
    });
  }

  // =====================================================
  // Lookups (المحافظة + المادة)
  // =====================================================

  readonly subjectOptions = signal<Option[]>([]);
  readonly governorateOptions = signal<Option[]>([]);
  readonly subjectsLoading = signal(false);
  readonly governoratesLoading = signal(false);

  loadSubjects(): void {
    this.loadLookup(
      this.lookups.getLookupSubjectData(),
      ['name', 'subjectName', 'subject', 'subjectTitle', 'title', 'arabicName'],
      ['id', 'subjectId', 'subjectID', 'value'],
      this.subjectOptions,
      this.subjectsLoading
    );
  }

  loadGovernorates(): void {
    this.loadLookup(
      this.lookups.getLookupGovernorateData(),
      ['name', 'governorateName', 'governorate', 'title', 'arabicName'],
      ['id', 'governorateId', 'governorateID', 'value'],
      this.governorateOptions,
      this.governoratesLoading
    );
  }

  private loadLookup(
    request$: Observable<unknown>,
    nameKeys: string[],
    idKeys: string[],
    target: WritableSignal<Option[]>,
    loading: WritableSignal<boolean>
  ): void {
    loading.set(true);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading packing lookup:', error);
          target.set([]);
          return of(null);
        }),
        finalize(() => loading.set(false))
      )
      .subscribe(response => {
        if (response === null) {
          return;
        }

        const options = this.extractItems(response)
          .map(item => {
            if (typeof item === 'string' || typeof item === 'number') {
              const label = String(item).trim();
              return label ? { label, value: label } : null;
            }

            if (!item || typeof item !== 'object') {
              return null;
            }

            const pick = (keys: string[]) =>
              keys
                .map(key => item[key])
                .find(v => v !== null && v !== undefined && String(v).trim() !== '');

            const rawName = pick(nameKeys);

            if (rawName === undefined) {
              return null;
            }

            const label = String(rawName).trim();
            const rawId = pick(idKeys);

            return label ? { label, value: rawId !== undefined ? String(rawId) : label } : null;
          })
          .filter((option): option is Option => option !== null);

        target.set(
          Array.from(new Map(options.map(option => [option.value, option])).values())
        );
      });
  }

  private extractItems(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    const possibleArrays = [
      response?.data,
      response?.data?.data,
      response?.data?.items,
      response?.data?.results,
      response?.result,
      response?.result?.data,
      response?.result?.items,
      response?.items,
      response?.results,
      response?.records
    ];

    return possibleArrays.find(Array.isArray) ?? [];
  }

  // =====================================================
  // Filters (المحافظة + المادة فقط)
  // =====================================================

  readonly subjectFilter = signal<string | null>(null);
  readonly governorateFilter = signal<string | null>(null);

  private readonly appliedFilters = signal({
    subject: null as string | null,
    governorate: null as string | null
  });

  readonly hasActiveFilters = computed(() => {
    const { subject, governorate } = this.appliedFilters();
    return !!(subject || governorate);
  });

  applyFilters(): void {
    this.appliedFilters.set({
      subject: this.subjectFilter(),
      governorate: this.governorateFilter()
    });

    this.batchPager.page.set(1);
    this.loadBatches();
  }

  resetFilters(): void {
    this.subjectFilter.set(null);
    this.governorateFilter.set(null);
    this.applyFilters();
  }

  private toId(value: string | null): number | null {
    if (value === null || value === '') {
      return null;
    }

    const id = Number(value);
    return Number.isFinite(id) ? id : null;
  }

  // =====================================================
  // Batches (المواد)
  // =====================================================

  readonly batches = signal<PackingBatch[]>([]);
  readonly batchesLoading = signal(false);
  readonly batchesError = signal<string | null>(null);
  readonly batchPager = createPager(6);

  /** المادة المفتوحة في الدايلوج (null = الدايلوج مقفول) */
  readonly selectedBatch = signal<PackingBatch | null>(null);
  readonly step = signal<Step>('committees');

  private batchesSub?: Subscription;

  loadBatches(): void {
    this.batchesSub?.unsubscribe();
    this.batchesLoading.set(true);
    this.batchesError.set(null);

    const { subject, governorate } = this.appliedFilters();

    this.batchesSub = this.api
      .getBatches(
        { subjectId: this.toId(subject), governorateId: this.toId(governorate) },
        { pageNumber: this.batchPager.page(), pageSize: this.batchPager.size() }
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.batchesLoading.set(false))
      )
      .subscribe({
        next: result => {
          this.batches.set(result.items);
          this.batchPager.total.set(result.total);
        },
        error: error => {
          this.batches.set([]);
          this.batchPager.total.set(0);
          this.batchesError.set(this.errorMessage(error, 'تعذر تحميل المواد'));
        }
      });
  }

  /** الضغط على مادة → يفتح دايلوج اللجان */
  openBatch(batch: PackingBatch): void {
    this.resetSession();
    this.committees.set([]);
    this.committeePager.page.set(1);
    this.committeePager.total.set(0);
    this.committeeSearch.set('');
    this.clearSearchTimer();
    this.selectedBatch.set(batch);
    this.step.set('committees');
    this.loadCommittees();
  }

  private closeBatchDialog(): void {
    this.resetSession();
    this.committeeSearch.set('');
    this.clearSearchTimer();
    this.selectedBatch.set(null);
    this.step.set('committees');
    this.loadBatches(); // عشان أعداد اللجان المتبقية تتحدث
  }

  batchTone(batch: PackingBatch): Tone {
    return batch.pendingCommitteeCount > 0 ? 'warning' : 'success';
  }

  // =====================================================
  // Committees (اللجان) - داخل الدايلوج
  // =====================================================

  readonly committees = signal<PackingCommittee[]>([]);
  readonly committeesLoading = signal(false);
  readonly committeesError = signal<string | null>(null);
  readonly committeePager = createPager(6);

  /** البحث برقم اللجنة (SearchTerm) */
  readonly committeeSearch = signal('');

  private committeesSub?: Subscription;
  private searchTimer?: ReturnType<typeof setTimeout>;

  onCommitteeSearchInput(value: string): void {
    this.committeeSearch.set(value ?? '');
    this.clearSearchTimer();

    // بحث تلقائي بعد ما اليوزر يوقف كتابة لحظة
    this.searchTimer = setTimeout(() => this.searchCommitteesNow(), 400);
  }

  searchCommitteesNow(): void {
    this.clearSearchTimer();
    this.committeePager.page.set(1);
    this.loadCommittees();
  }

  clearCommitteeSearch(): void {
    this.committeeSearch.set('');
    this.searchCommitteesNow();
  }

  private clearSearchTimer(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = undefined;
    }
  }

  loadCommittees(): void {
    const batch = this.selectedBatch();

    if (!batch) {
      return;
    }

    this.committeesSub?.unsubscribe();
    this.committeesLoading.set(true);
    this.committeesError.set(null);

    this.committeesSub = this.api
      .getCommittees(
        batch.batchId,
        {
          pageNumber: this.committeePager.page(),
          pageSize: this.committeePager.size()
        },
        this.committeeSearch()
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.committeesLoading.set(false))
      )
      .subscribe({
        next: result => {
          this.committees.set(result.items);
          this.committeePager.total.set(result.total);
        },
        error: error => {
          this.committees.set([]);
          this.committeePager.total.set(0);
          this.committeesError.set(this.errorMessage(error, 'تعذر تحميل اللجان'));
        }
      });
  }

  // =====================================================
  // Pagination (مشترك)
  // =====================================================

  pagerOf(kind: PagerKind): Pager {
    return kind === 'batch' ? this.batchPager : this.committeePager;
  }

  goToPage(kind: PagerKind, page: number): void {
    const pager = this.pagerOf(kind);

    if (page < 1 || page > pager.totalPages() || page === pager.page()) {
      return;
    }

    pager.page.set(page);
    this.reload(kind);
  }

  onPageSizeChange(kind: PagerKind, size: number): void {
    const pager = this.pagerOf(kind);

    pager.size.set(Number(size));
    pager.page.set(1);
    this.reload(kind);
  }

  private reload(kind: PagerKind): void {
    if (kind === 'batch') {
      this.loadBatches();
    } else {
      this.loadCommittees();
    }
  }

  // =====================================================
  // Packing session (صناديق + أظرف + مسح)
  // =====================================================

  readonly selectedCommittee = signal<PackingCommittee | null>(null);

  readonly boxes = signal<BoxVm[]>([]);
  readonly boxesLoading = signal(false);
  readonly boxesError = signal<string | null>(null);
  readonly activeBoxId = signal<number | null>(null);

  readonly feedback = signal<ScanFeedback | null>(null);
  readonly scanLog = signal<ScanLog[]>([]);
  readonly scanBuffer = signal('');
  readonly soundOn = signal(true);

  readonly packing = signal(false);
  readonly packResult = signal<PackResult | null>(null);
  readonly packError = signal<string | null>(null);
  readonly problems = signal<PackProblem[]>([]);

  readonly leaveDialogVisible = signal(false);

  private leaveTarget: LeaveTarget = 'committees';
  private boxesSub?: Subscription;
  private serialIndex = new Map<string, number>();
  private logCounter = 0;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private audioCtx?: AudioContext;

  readonly packDone = computed(() => this.packResult() !== null);

  readonly problemSerials = computed(
    () => new Set(this.problems().map(problem => problem.serial))
  );

  readonly problemBoxIds = computed(
    () => new Set(this.problems().map(problem => problem.boxId))
  );

  readonly boxViews = computed<BoxView[]>(() =>
    this.boxes().map(box => {
      const main = box.envelopes.filter(e => e.kind === 'main');
      const reserve = box.envelopes.filter(e => e.kind === 'reserve');
      const mainScanned = main.filter(e => e.scanned).length;
      const reserveScanned = reserve.filter(e => e.scanned).length;
      const complete = box.qrScanned && mainScanned === main.length;
      const steps = main.length + 1;

      return {
        ...box,
        main,
        reserve,
        mainTotal: main.length,
        mainScanned,
        reserveTotal: reserve.length,
        reserveScanned,
        complete,
        progress: Math.round(((mainScanned + (box.qrScanned ? 1 : 0)) / steps) * 100)
      };
    })
  );

  readonly totals = computed(() => {
    const views = this.boxViews();
    const boxTotal = views.length;
    const boxesConfirmed = views.filter(v => v.qrScanned).length;
    const mainTotal = views.reduce((sum, v) => sum + v.mainTotal, 0);
    const mainScanned = views.reduce((sum, v) => sum + v.mainScanned, 0);
    const reserveTotal = views.reduce((sum, v) => sum + v.reserveTotal, 0);
    const reserveScanned = views.reduce((sum, v) => sum + v.reserveScanned, 0);
    const all = boxTotal + mainTotal;
    const done = boxesConfirmed + mainScanned;

    return {
      boxTotal,
      boxesConfirmed,
      mainTotal,
      mainScanned,
      reserveTotal,
      reserveScanned,
      boxesLeft: boxTotal - boxesConfirmed,
      mainLeft: mainTotal - mainScanned,
      progress: all ? Math.round((done / all) * 100) : 0
    };
  });

  readonly canPack = computed(() => {
    const t = this.totals();

    return (
      t.boxTotal > 0 &&
      t.boxesLeft === 0 &&
      t.mainLeft === 0 &&
      !this.packing() &&
      !this.packDone()
    );
  });

  /** في مسح اتعمل ومتحفظش؟ */
  readonly hasUnsaved = computed(() => {
    const t = this.totals();

    return (
      this.step() === 'packing' &&
      !this.packDone() &&
      t.boxesConfirmed + t.mainScanned + t.reserveScanned > 0
    );
  });

  /** القارئ شغال؟ */
  readonly scanActive = computed(
    () =>
      this.selectedBatch() !== null &&
      this.step() === 'packing' &&
      !this.boxesLoading() &&
      !this.boxesError() &&
      this.boxes().length > 0 &&
      !this.packing() &&
      !this.packDone() &&
      !this.leaveDialogVisible()
  );

  /** رسالة توجيهية للمستخدم */
  readonly guide = computed(() => {
    if (this.packDone()) {
      return 'تم حفظ التغليف بنجاح';
    }

    const t = this.totals();

    if (this.canPack()) {
      return 'اكتمل المسح — اضغط «تأكيد التغليف»';
    }

    const parts: string[] = [];

    if (t.boxesLeft) {
      parts.push(`${t.boxesLeft} صندوق`);
    }
    if (t.mainLeft) {
      parts.push(`${t.mainLeft} ظرف أساسي`);
    }

    return `متبقي مسح: ${parts.join(' و ')}`;
  });

  // ---------- فتح لجنة وتحميل صناديقها ----------

  openCommittee(committee: PackingCommittee): void {
    this.resetSession();
    this.selectedCommittee.set(committee);
    this.step.set('packing');
    this.loadBoxes();
  }

  loadBoxes(): void {
    const committee = this.selectedCommittee();

    if (!committee) {
      return;
    }

    this.boxesSub?.unsubscribe();
    this.boxesLoading.set(true);
    this.boxesError.set(null);

    this.boxesSub = this.api
      .getCommitteeBoxes(committee.committeeId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.boxesLoading.set(false))
      )
      .subscribe({
        next: data => {
          if (!data.boxes.length) {
            this.boxesError.set('لا توجد صناديق لهذه اللجنة');
            return;
          }

          this.startSession(data.boxes);
        },
        error: error =>
          this.boxesError.set(this.errorMessage(error, 'تعذر تحميل الصناديق والأظرف'))
      });
  }

  private startSession(committeeBoxes: CommitteeBox[]): void {
    const boxes: BoxVm[] = [...committeeBoxes]
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map(box => this.toBoxVm(box));

    this.serialIndex = new Map(
      boxes.flatMap(box => box.envelopes.map(env => [env.serial, box.boxId] as const))
    );

    this.boxes.set(boxes);
    this.activeBoxId.set(boxes[0]?.boxId ?? null);
    this.feedback.set(null);
    this.scanLog.set([]);
    this.problems.set([]);
    this.packResult.set(null);
    this.packError.set(null);
  }

  private toBoxVm(box: CommitteeBox): BoxVm {
    const toEnvelope = (serial: string, kind: 'main' | 'reserve'): EnvelopeVm => ({
      serial,
      kind,
      scanned: false,
      scannedAt: null
    });

    return {
      boxId: box.boxId,
      sequenceNo: box.sequenceNo,
      qrCode: box.qrCode,
      expectedEnvelopeCount: box.expectedEnvelopeCount,
      qrScanned: false,
      envelopes: [
        ...box.requiredEnvelopes.map(serial => toEnvelope(serial, 'main')),
        ...box.bonusEnvelopes.map(serial => toEnvelope(serial, 'reserve'))
      ]
    };
  }

  // ---------- Scanner: الجلسة مفتوحة دائمًا بدون input ----------
  // جهاز القراءة بيكتب الكود ثم Enter، فبنلتقطه من الكيبورد مباشرة.

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.scanActive()) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;

    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      if (this.scanBuffer()) {
        event.preventDefault();
        this.flushBuffer();
      }
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    // المسافة بدون كود قيد القراءة تفضل شغالة للأزرار
    if (event.key === ' ' && !this.scanBuffer()) {
      return;
    }

    event.preventDefault();
    this.scanBuffer.update(buffer => buffer + event.key);
    this.armIdleReset();
  }

  private flushBuffer(): void {
    const code = this.scanBuffer().trim();

    this.scanBuffer.set('');
    this.clearIdleTimer();

    if (code) {
      this.processScan(code);
    }
  }

  /** لو القراءة وقفت في النص، بنمسح الباقي عشان ما يتلخبطش */
  private armIdleReset(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => this.scanBuffer.set(''), 1000);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  private processScan(code: string): void {
    const boxes = this.boxes();

    // 1) QR الصندوق
    const boxByQr = boxes.find(box => box.qrCode === code);

    if (boxByQr) {
      if (boxByQr.qrScanned) {
        this.notify('warning', code, `QR صندوق ${boxByQr.sequenceNo} تم مسحه من قبل`);
        return;
      }

      this.patchBox(boxByQr.boxId, box => ({ ...box, qrScanned: true }));
      this.highlightBox(boxByQr.boxId);
      this.notify('success', code, `تم تأكيد صندوق رقم ${boxByQr.sequenceNo}`);
      return;
    }

    // 2) سيريال ظرف
    const boxId = this.serialIndex.get(code);

    if (boxId === undefined) {
      this.notify('danger', code, 'هذا الكود غير تابع لهذه اللجنة');
      return;
    }

    const box = boxes.find(item => item.boxId === boxId);
    const envelope = box?.envelopes.find(item => item.serial === code);

    if (!box || !envelope) {
      this.notify('danger', code, 'تعذر العثور على الظرف');
      return;
    }

    if (envelope.scanned) {
      this.notify('warning', code, `الظرف ${code} تم مسحه من قبل`);
      return;
    }

    const time = this.now();

    this.patchBox(boxId, item => ({
      ...item,
      envelopes: item.envelopes.map(env =>
        env.serial === code ? { ...env, scanned: true, scannedAt: time } : env
      )
    }));

    this.highlightBox(boxId);
    this.notify(
      'success',
      code,
      `تم مسح ظرف ${envelope.kind === 'main' ? 'أساسي' : 'احتياطي'} - صندوق ${box.sequenceNo}`
    );
  }

  resetBox(boxId: number): void {
    if (this.packing() || this.packDone()) {
      return;
    }

    this.patchBox(boxId, box => ({
      ...box,
      qrScanned: false,
      envelopes: box.envelopes.map(env => ({ ...env, scanned: false, scannedAt: null }))
    }));

    this.problems.update(list => list.filter(problem => problem.boxId !== boxId));
    this.notify('warning', '', 'تمت إعادة تعيين مسح الصندوق');
  }

  private patchBox(boxId: number, fn: (box: BoxVm) => BoxVm): void {
    this.boxes.update(list => list.map(box => (box.boxId === boxId ? fn(box) : box)));
  }

  highlightBox(boxId: number): void {
    this.activeBoxId.set(boxId);

    setTimeout(
      () =>
        document
          .getElementById(`pk-box-${boxId}`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      0
    );
  }

  private notify(tone: Tone, code: string, text: string): void {
    const entry: ScanFeedback = { id: ++this.logCounter, tone, code, text };

    this.feedback.set(entry);
    this.scanLog.update(list => [{ ...entry, time: this.now() }, ...list].slice(0, 8));
    this.beep(tone);
  }

  private beep(tone: Tone): void {
    if (!this.soundOn()) {
      return;
    }

    try {
      const ctx = (this.audioCtx ??= new AudioContext());
      void ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = tone === 'success' ? 880 : tone === 'warning' ? 520 : 220;
      gain.gain.value = 0.08;

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (tone === 'danger' ? 0.28 : 0.1));
    } catch {
      // الصوت اختياري
    }
  }

  private now(): string {
    return new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  toneIcon(tone: Tone): string {
    return tone === 'success'
      ? 'pi-check-circle'
      : tone === 'warning'
        ? 'pi-exclamation-triangle'
        : 'pi-times-circle';
  }

  envTone(env: EnvelopeVm): 'success' | 'danger' | 'pending' {
    if (this.problemSerials().has(env.serial)) {
      return 'danger';
    }

    return env.scanned ? 'success' : 'pending';
  }

  // ---------- Confirm packing ----------

  confirmPacking(): void {
    const committee = this.selectedCommittee();

    if (!committee || !this.canPack()) {
      return;
    }

    const body: PackRequest = {
      boxes: this.boxes().map(box => ({
        boxId: box.boxId,
        qrCode: box.qrCode,
        envelopeSerials: box.envelopes.filter(env => env.scanned).map(env => env.serial)
      }))
    };

    this.packing.set(true);
    this.packError.set(null);
    this.problems.set([]);

    this.api
      .packCommittee(committee.committeeId, body)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.packing.set(false))
      )
      .subscribe({
        next: outcome => {
          const problems = outcome.data?.problems ?? [];

          this.problems.set(problems);

          if (outcome.success && !problems.length && outcome.data) {
            this.packResult.set(outcome.data);
            this.notify('success', '', 'تم تأكيد التغليف بنجاح');
            return;
          }

          this.packError.set(outcome.message || 'يوجد مشاكل في التغليف، راجع التفاصيل أدناه');
        },
        error: error => this.packError.set(this.errorMessage(error, 'تعذر تأكيد التغليف'))
      });
  }

  // ---------- Navigation / leave ----------

  /** رجوع من الصناديق إلى اللجان */
  requestBack(): void {
    if (this.packing()) {
      return;
    }

    if (this.hasUnsaved()) {
      this.leaveTarget = 'committees';
      this.leaveDialogVisible.set(true);
      return;
    }

    this.backToCommittees();
  }

  /** قفل الدايلوج بالكامل */
  requestCloseDialog(): void {
    if (this.packing()) {
      return;
    }

    if (this.hasUnsaved()) {
      this.leaveTarget = 'close';
      this.leaveDialogVisible.set(true);
      return;
    }

    this.closeBatchDialog();
  }

  onBatchDialogVisibleChange(visible: boolean): void {
    if (!visible) {
      this.requestCloseDialog();
    }
  }

  onLeaveVisibleChange(visible: boolean): void {
    if (!visible) {
      this.leaveDialogVisible.set(false);
    }
  }

  confirmLeave(): void {
    this.leaveDialogVisible.set(false);

    if (this.leaveTarget === 'close') {
      this.closeBatchDialog();
    } else {
      this.backToCommittees();
    }
  }

  cancelLeave(): void {
    this.leaveDialogVisible.set(false);
  }

  private backToCommittees(): void {
    this.resetSession();
    this.step.set('committees');
    this.loadCommittees(); // اللجنة اللي اتغلفت تختفي من القائمة
  }

  private resetSession(): void {
    this.boxesSub?.unsubscribe();
    this.clearIdleTimer();

    this.selectedCommittee.set(null);
    this.boxes.set([]);
    this.boxesLoading.set(false);
    this.boxesError.set(null);
    this.activeBoxId.set(null);
    this.feedback.set(null);
    this.scanLog.set([]);
    this.scanBuffer.set('');
    this.problems.set([]);
    this.packResult.set(null);
    this.packError.set(null);
    this.serialIndex = new Map();
  }

  // =====================================================
  // Utils
  // =====================================================

  private errorMessage(error: any, fallback: string): string {
    return (
      error?.error?.errors?.[0] ||
      error?.error?.message ||
      (error instanceof Error ? error.message : '') ||
      fallback
    );
  }
}