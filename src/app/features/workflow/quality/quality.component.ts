import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { Lookups } from '../../../shared/services/lookups';
import { QualityService, QualityCommittee } from './service/quality';

// ==========================================
// Types
// ==========================================

type StatusTab = 'all' | 'pending' | 'done';
type EnvelopeTab = 'all' | 'pending' | 'scanned';
type EnvelopeType = 'required' | 'bonus';
type FeedbackKind = 'success' | 'error' | 'warning';

interface LookupOption {
  label: string;
  /** الكود اللي بيتبعت للـ API (GovernorateCode / SubjectCode) */
  value: string;
}

interface EnvelopeItem {
  code: string;
  type: EnvelopeType;
  scanned: boolean;
  scannedAt: string | null;
}

interface ScanAttempt {
  code: string;
  reason: string;
  at: string;
}

interface ScanFeedback {
  kind: FeedbackKind;
  title: string;
  message: string;
  code: string;
}

function errorMessage(error: any, fallback: string): string {
  return error?.error?.message || error?.message || fallback;
}

function nowTime(): string {
  return new Date().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/** محيط دائرة الـ progress ring (2 × π × 42) - لازم يطابق stroke-dasharray في الـ SCSS */
const RING_CIRCUMFERENCE = 263.89;

@Component({
  selector: 'app-quality',
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
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss',
  encapsulation: ViewEncapsulation.None
})
export default class QualityComponent implements OnInit, OnDestroy {
  private readonly lookups = inject(Lookups);
  private readonly qualityService = inject(QualityService);

  /**
   * true  = لازم مسح الأظرف الأساسية + الإضافية قبل الإتمام
   * false = الأظرف الأساسية فقط
   */
  private readonly requireBonusEnvelopes = true;

  /**
   * false = يقبل أي ظرف تابع للجنة بأي ترتيب
   * true  = يقبل الظرف التالي بالترتيب فقط، وأي ظرف آخر يُرفض ويُعاد مسحه
   */
  readonly orderEnforced = false;

  // ==========================================
  // Page configuration
  // ==========================================

  readonly essentials = [
    'اختيار المحافظة والمادة',
    'فتح اللجنة وبدء جلسة المسح',
    'توجيه الماسح على QR كل ظرف',
    'إتمام مراجعة اللجنة'
  ];

  readonly pageSizes = [
    { label: '6', value: 6 },
    { label: '12', value: 12 },
    { label: '24', value: 24 }
  ];

  readonly envelopeTabs: { key: EnvelopeTab; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'pending', label: 'المتبقي' },
    { key: 'scanned', label: 'تم مسحه' }
  ];

  ngOnInit(): void {
    this.loadGovernorates();
    this.loadSubjects();
    this.loadCommittees();
  }

  ngOnDestroy(): void {
    this.clearIdleTimer();
  }

  // ==========================================
  // Lookups (المحافظات والمواد - value = الكود)
  // ==========================================

  readonly governorates = signal<LookupOption[]>([]);
  readonly subjects = signal<LookupOption[]>([]);
  readonly governoratesLoading = signal(false);
  readonly subjectsLoading = signal(false);

  loadGovernorates(): void {
    this.governoratesLoading.set(true);

    this.lookups.getLookupGovernorateData().subscribe({
      next: (response: any) => {
        this.governorates.set(
          this.normalizeLookupOptions(
            response,
            ['governorateName', 'nameAr', 'arabicName', 'governorate', 'name', 'title'],
            ['governorateCode', 'code', 'governorateId', 'id', 'value']
          )
        );
        this.governoratesLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Error loading governorates:', error);
        this.governorates.set([]);
        this.governoratesLoading.set(false);
      }
    });
  }

  loadSubjects(): void {
    this.subjectsLoading.set(true);

    this.lookups.getLookupSubjectData().subscribe({
      next: (response: any) => {
        this.subjects.set(
          this.normalizeLookupOptions(
            response,
            ['subjectName', 'nameAr', 'arabicName', 'subject', 'name', 'title'],
            ['subjectCode', 'code', 'subjectId', 'id', 'value']
          )
        );
        this.subjectsLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Error loading subjects:', error);
        this.subjects.set([]);
        this.subjectsLoading.set(false);
      }
    });
  }

  /**
   * label = الاسم، value = الكود (الـ API بياخد GovernorateCode / SubjectCode).
   * لو اسم حقل الكود عندك مختلف ضيفيه في codeKeys.
   */
  private normalizeLookupOptions(
    response: any,
    nameKeys: string[],
    codeKeys: string[]
  ): LookupOption[] {
    const pick = (item: any, keys: string[]): string => {
      for (const key of keys) {
        const candidate = item?.[key];

        if (candidate !== null && candidate !== undefined && String(candidate).trim() !== '') {
          return String(candidate).trim();
        }
      }

      return '';
    };

    const options = this.extractLookupArray(response)
      .map((item: any): LookupOption | null => {
        if (typeof item === 'string' || typeof item === 'number') {
          const name = String(item).trim();
          return name ? { label: name, value: name } : null;
        }

        if (!item || typeof item !== 'object') {
          return null;
        }

        const label = pick(item, nameKeys);

        if (!label) {
          return null;
        }

        return { label, value: pick(item, codeKeys) || label };
      })
      .filter((o): o is LookupOption => o !== null);

    return [...new Map(options.map(o => [o.value, o])).values()];
  }

  private extractLookupArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    for (const key of ['data', 'items', 'result', 'results', 'records']) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value;
      }

      if (value && typeof value === 'object') {
        const nested = this.extractLookupArray(value);

        if (nested.length) {
          return nested;
        }
      }
    }

    return [];
  }

  // ==========================================
  // Committees (GET api/Quality/committees)
  // ==========================================

  readonly committees = signal<QualityCommittee[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');

  readonly governorateFilter = signal<string | null>(null);
  readonly subjectFilter = signal<string | null>(null);
  readonly committeeFilter = signal('');
  readonly statusFilter = signal<StatusTab>('all');

  /** اللجان اللي اتم إتمامها (complete) في هذه الجلسة */
  readonly completedIds = signal<Set<number>>(new Set());

  /** المحافظة والمادة بيروحوا للـ API */
  applyFilters(): void {
    this.currentPage.set(1);
    this.loadCommittees();
  }

  loadCommittees(silent = false): void {
    if (!silent) {
      this.loading.set(true);
    }

    this.loadError.set('');

    this.qualityService
      .getCommittees({
        governorateCode: this.governorateFilter(),
        subjectCode: this.subjectFilter()
      })
      .subscribe({
        next: list => {
          this.committees.set(list);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          console.error('Failed to load committees:', error);
          this.loadError.set(errorMessage(error, 'تعذر تحميل اللجان. حاول مرة أخرى.'));
          this.loading.set(false);
        }
      });
  }

  resetFilters(): void {
    this.governorateFilter.set(null);
    this.subjectFilter.set(null);
    this.committeeFilter.set('');
    this.statusFilter.set('all');
    this.applyFilters();
  }

  readonly hasActiveFilters = computed(
    () =>
      !!(
        this.governorateFilter() ||
        this.subjectFilter() ||
        this.committeeFilter().trim() ||
        this.statusFilter() !== 'all'
      )
  );

  onCommitteeSearch(value: string): void {
    this.committeeFilter.set(value);
    this.currentPage.set(1);
  }

  setStatus(tab: StatusTab): void {
    this.statusFilter.set(tab);
    this.currentPage.set(1);
  }

  isDone(c: QualityCommittee): boolean {
    return this.completedIds().has(c.id);
  }

  /** بحث محلي برقم اللجنة أو اسم المدرسة */
  private readonly searchedRows = computed(() => {
    const q = this.committeeFilter().trim().toLowerCase();

    return q
      ? this.committees().filter(
          c =>
            c.committeeNumber.toLowerCase().includes(q) ||
            c.schoolName.toLowerCase().includes(q)
        )
      : this.committees();
  });

  readonly filteredRows = computed(() => {
    const tab = this.statusFilter();
    const rows = this.searchedRows();

    return tab === 'all'
      ? rows
      : rows.filter(c => (tab === 'done') === this.isDone(c));
  });

  readonly statusTabs = computed(() => {
    const rows = this.searchedRows();
    const done = rows.filter(c => this.isDone(c)).length;

    return [
      { key: 'all' as StatusTab, label: 'الكل', icon: 'pi-th-large', tone: 'neutral', count: rows.length },
      { key: 'pending' as StatusTab, label: 'قيد المراجعة', icon: 'pi-clock', tone: 'info', count: rows.length - done },
      { key: 'done' as StatusTab, label: 'تمت المراجعة', icon: 'pi-check-circle', tone: 'success', count: done }
    ];
  });

  // ==========================================
  // Pagination (client-side)
  // ==========================================

  readonly pageSize = signal(6);
  readonly currentPage = signal(1);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize()))
  );

  readonly paginatedRows = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize();

    return this.filteredRows().slice(start, start + this.pageSize());
  });

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

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
  });

  readonly paginationStart = computed(() =>
    this.filteredRows().length ? (this.currentPage() - 1) * this.pageSize() + 1 : 0
  );

  readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredRows().length)
  );

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }

    this.currentPage.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  // ==========================================
  // Card helpers
  // ==========================================

  trackCommittee = (_: number, c: QualityCommittee) => c.id;
  trackEnvelope = (_: number, e: { code: string }) => e.code;

  totalEnvelopes(c: QualityCommittee): number {
    return this.expectedCodes(c).length;
  }

  /** عدد الأظرف اللي اتمسحت في جلسة اللجنة (حتى لو الدايلوج اتقفل) */
  scannedOf(c: QualityCommittee): number {
    return Object.keys(this.sessions()[c.id] ?? {}).length;
  }

  progressOf(c: QualityCommittee): number {
    const total = this.totalEnvelopes(c);
    return total ? Math.round((this.scannedOf(c) / total) * 100) : 0;
  }

  private expectedCodes(c: QualityCommittee): string[] {
    return this.requireBonusEnvelopes
      ? [...c.requiredEnvelopes, ...c.bonusEnvelopes]
      : [...c.requiredEnvelopes];
  }

  /** آخر جزء من الكود (رقم الظرف) بخط كبير: ENV-27-A-29-01-777-001 → 001 */
  envSeq(code: string): string {
    const i = code.lastIndexOf('-');
    return i >= 0 ? code.slice(i + 1) : code;
  }

  /** باقي الكود بخط صغير */
  envPrefix(code: string): string {
    const i = code.lastIndexOf('-');
    return i >= 0 ? code.slice(0, i) : '';
  }

  // ==========================================
  // Scan session (الماسح بيشتغل تلقائياً بدون كتابة أو ضغط)
  // ==========================================

  /** تقدم كل لجنة: { committeeId: { envelopeCode: scannedAt } } */
  private readonly sessions = signal<Record<number, Record<string, string>>>({});

  scanDialogVisible = false;

  readonly activeCommittee = signal<QualityCommittee | null>(null);
  readonly envelopes = signal<EnvelopeItem[]>([]);
  readonly attempts = signal<ScanAttempt[]>([]);
  readonly feedback = signal<ScanFeedback | null>(null);
  readonly lastScannedCode = signal<string | null>(null);
  readonly envelopeTab = signal<EnvelopeTab>('all');

  /** الحروف اللي الماسح بيكتبها حالياً (للعرض فقط) */
  readonly liveBuffer = signal('');

  readonly totalCount = computed(() => this.envelopes().length);
  readonly scannedCount = computed(() => this.envelopes().filter(e => e.scanned).length);
  readonly remainingCount = computed(() => this.totalCount() - this.scannedCount());

  readonly progress = computed(() =>
    this.totalCount() ? Math.round((this.scannedCount() / this.totalCount()) * 100) : 0
  );

  /** إزاحة الدائرة للـ progress ring */
  readonly ringOffset = computed(
    () => RING_CIRCUMFERENCE * (1 - this.progress() / 100)
  );

  readonly allScanned = computed(
    () => this.totalCount() > 0 && this.scannedCount() === this.totalCount()
  );

  readonly requiredScanned = computed(
    () => this.envelopes().filter(e => e.type === 'required' && e.scanned).length
  );
  readonly requiredTotal = computed(
    () => this.envelopes().filter(e => e.type === 'required').length
  );
  readonly bonusScanned = computed(
    () => this.envelopes().filter(e => e.type === 'bonus' && e.scanned).length
  );
  readonly bonusTotal = computed(
    () => this.envelopes().filter(e => e.type === 'bonus').length
  );

  /** أول ظرف متبقي */
  readonly nextPending = computed(() => this.envelopes().find(e => !e.scanned) ?? null);

  readonly visibleEnvelopes = computed(() => {
    const tab = this.envelopeTab();
    const list = this.envelopes().map((e, i) => ({ ...e, no: i + 1 }));

    return tab === 'all'
      ? list
      : list.filter(e => (tab === 'scanned' ? e.scanned : !e.scanned));
  });

  openScanDialog(committee: QualityCommittee): void {
    if (this.isDone(committee)) {
      return;
    }

    const saved = this.sessions()[committee.id] ?? {};

    const items: EnvelopeItem[] = [
      ...committee.requiredEnvelopes.map(code => ({ code, type: 'required' as const })),
      ...(this.requireBonusEnvelopes
        ? committee.bonusEnvelopes.map(code => ({ code, type: 'bonus' as const }))
        : [])
    ].map(e => ({
      ...e,
      scanned: !!saved[e.code],
      scannedAt: saved[e.code] ?? null
    }));

    this.resetBuffer();
    this.activeCommittee.set(committee);
    this.envelopes.set(items);
    this.attempts.set([]);
    this.feedback.set(null);
    this.lastScannedCode.set(null);
    this.envelopeTab.set('all');
    this.completeError.set('');
    this.scanDialogVisible = true;
  }

  /** بعد فتح الدايلوج: شيل الفوكس من أي زرار عشان Enter/Space من الماسح ميضغطوش عليه */
  prepareSession(): void {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  /**
   * بيتنادى من زرار الإغلاق، ومن الضغط بره الدايلوج (dismissableMask)،
   * ومن Escape، ومن onHide. التقدم محفوظ في sessions فمبيضيعش.
   */
  closeScanDialog(): void {
    if (this.completing()) {
      return;
    }

    this.scanDialogVisible = false;
    this.activeCommittee.set(null);
    this.envelopes.set([]);
    this.attempts.set([]);
    this.feedback.set(null);
    this.resetBuffer();
  }

  setEnvelopeTab(tab: EnvelopeTab): void {
    this.envelopeTab.set(tab);
  }

  // ---------- قراءة الماسح (keyboard wedge) ----------

  /** أقل طول كود نعتبره قراءة كاملة لو الماسح مش بيبعت Enter في الآخر */
  private static readonly MIN_AUTO_LEN = 8;
  /** أقصى فاصل بين حرفين من الماسح (الماسح سريع جداً) */
  private static readonly IDLE_MS = 250;

  private buffer = '';
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * الماسح بيتصرف كأنه كيبورد: بيكتب الكود بسرعة وبعدين Enter.
   * بنسمعه على مستوى الصفحة كلها طالما جلسة المسح مفتوحة،
   * فاليوزر مش محتاج يكتب أو يدوس أي زرار.
   */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.scanDialogVisible || !this.activeCommittee() || this.completing()) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    // Escape يقفل الدايلوج (بيتعامل معاه p-dialog)
    if (event.key === 'Escape') {
      return;
    }

    // نهاية القراءة
    if (event.key === 'Enter') {
      if (this.buffer) {
        event.preventDefault();
        this.flushBuffer();
      }

      return;
    }

    const char = this.keyToChar(event);

    if (!char) {
      return;
    }

    // منع أي تأثير جانبي (مثلاً Space على زرار)
    event.preventDefault();

    this.buffer += char;
    this.liveBuffer.set(this.buffer);
    this.restartIdleTimer();
  }

  /**
   * بنقرأ المفتاح الفعلي (event.code) مش الحرف، عشان لو الكيبورد على اللغة العربية
   * الكود يتقرأ صح (ENV-27-A...) بدل حروف عربية.
   */
  private keyToChar(event: KeyboardEvent): string {
    const code = event.code;

    if (/^Key[A-Z]$/.test(code)) {
      return code.slice(3);
    }

    if (/^Digit[0-9]$/.test(code)) {
      return code.slice(5);
    }

    if (/^Numpad[0-9]$/.test(code)) {
      return code.slice(6);
    }

    if (code === 'Minus') {
      return event.shiftKey ? '_' : '-';
    }

    if (code === 'NumpadSubtract') {
      return '-';
    }

    return event.key.length === 1 ? event.key : '';
  }

  private restartIdleTimer(): void {
    this.clearIdleTimer();

    this.idleTimer = setTimeout(() => {
      // ماسح بدون Enter: لو القراءة طويلة كفاية نعتبرها كاملة، وإلا نتجاهلها
      if (this.buffer.length >= QualityComponent.MIN_AUTO_LEN) {
        this.flushBuffer();
      } else {
        this.resetBuffer();
      }
    }, QualityComponent.IDLE_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private resetBuffer(): void {
    this.clearIdleTimer();
    this.buffer = '';
    this.liveBuffer.set('');
  }

  private flushBuffer(): void {
    const code = this.buffer;
    this.resetBuffer();
    this.processScan(code);
  }

  /**
   * مقارنة الكود المقروء بالأظرف المتوقعة للجنة:
   * - مطابق ولسه ماتمسحش → يعدّيه ويروح للي بعده
   * - اتمسح قبل كده → تنبيه
   * - مش تابع للجنة (أو في غير دوره) → خطأ ويتعاد المسح
   */
  private processScan(rawCode: string): void {
    const committee = this.activeCommittee();
    const raw = rawCode.trim();

    if (!committee || !raw || this.completing()) {
      return;
    }

    const normalized = raw.toUpperCase();
    const list = this.envelopes();
    const index = list.findIndex(e => e.code.toUpperCase() === normalized);

    // 1) غير مطابق
    if (index < 0) {
      this.reject(raw, 'الظرف غير تابع لهذه اللجنة', 'الظرف غير مطابق', 'هذا الظرف لا يتبع هذه اللجنة. أعد مسح الظرف الصحيح.');
      return;
    }

    const envelope = list[index];

    // 2) اتمسح قبل كده
    if (envelope.scanned) {
      this.feedback.set({
        kind: 'warning',
        title: 'تم مسح هذا الظرف من قبل',
        message: `تمت مطابقته الساعة ${envelope.scannedAt}. امسح الظرف التالي.`,
        code: envelope.code
      });
      this.beep('warning');
      return;
    }

    // 3) ترتيب إجباري (اختياري)
    if (this.orderEnforced) {
      const expected = this.nextPending();

      if (expected && expected.code !== envelope.code) {
        this.reject(raw, 'ظرف في غير دوره', 'الظرف في غير دوره', `الظرف المطلوب الآن: ${expected.code}`);
        return;
      }
    }

    // 4) مطابق
    const at = nowTime();

    this.envelopes.update(items =>
      items.map((e, i) => (i === index ? { ...e, scanned: true, scannedAt: at } : e))
    );

    this.sessions.update(s => ({
      ...s,
      [committee.id]: { ...(s[committee.id] ?? {}), [envelope.code]: at }
    }));

    this.lastScannedCode.set(envelope.code);

    this.feedback.set({
      kind: 'success',
      title: 'تمت المطابقة بنجاح',
      message: this.allScanned()
        ? 'اكتمل مسح كل الأظرف. يمكنك إتمام مراجعة اللجنة.'
        : `تبقّى ${this.remainingCount()} ظرف. انتقل للظرف التالي.`,
      code: envelope.code
    });

    this.beep('success');
    this.scrollToEnvelope(index + 1);
  }

  private reject(code: string, reason: string, title: string, message: string): void {
    this.attempts.update(a => [{ code, reason, at: nowTime() }, ...a].slice(0, 20));
    this.feedback.set({ kind: 'error', title, message, code });
    this.beep('error');
  }

  private scrollToEnvelope(no: number): void {
    setTimeout(
      () =>
        document
          .getElementById(`qc-env-${no}`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      0
    );
  }

  // ---------- صوت تأكيد (مهم لأن اليوزر بيبص على الظرف مش الشاشة) ----------

  private audioCtx?: AudioContext;

  private beep(kind: FeedbackKind): void {
    try {
      const ctx = (this.audioCtx ??= new AudioContext());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = kind === 'error' ? 'square' : 'sine';
      osc.frequency.value = kind === 'success' ? 880 : kind === 'warning' ? 560 : 200;
      gain.gain.value = 0.07;

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (kind === 'error' ? 0.4 : 0.14));
    } catch {
      /* الصوت اختياري */
    }
  }

  // ==========================================
  // Complete (PUT api/Quality/committees/{id}/complete)
  // ==========================================

  readonly completing = signal(false);
  readonly completeError = signal('');

  completeCommittee(): void {
    const committee = this.activeCommittee();

    if (!committee || !this.allScanned() || this.completing()) {
      return;
    }

    this.completing.set(true);
    this.completeError.set('');

    this.qualityService.completeCommittee(committee.id).subscribe({
      next: () => {
        this.completing.set(false);
        this.completedIds.update(set => new Set(set).add(committee.id));
        this.closeScanDialog();
        this.loadCommittees(true);
      },
      error: (error: unknown) => {
        console.error('Failed to complete committee:', error);
        this.completing.set(false);
        this.completeError.set(errorMessage(error, 'تعذر إتمام المراجعة. حاول مرة أخرى.'));
      }
    });
  }
}