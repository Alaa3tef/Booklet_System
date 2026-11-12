import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { finalize, Subscription } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
// ⚠️ عدّلي المسار/اسم الملف حسب مكان الـ Lookups service عندك
import { Lookups } from '../../../shared/services/lookups';
import {
  StorageLocationResolveDto, BoxResolveDto, ArchivingBoxService,
  DeliveryOrderDto, DeliveryBatchDto, DeliveryCommitteeDto, DeliverCommitteeResult,
  PackedItemDto, PackedCommitteeDto, CommitteeBoxItemDto,
} from './service/archiving-box.service';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

type Tab = 'archive' | 'warehouse';
type Feedback = { kind: 'ok' | 'warn' | 'err' | 'lock'; text: string };
type Lookup = { kind: 'location'; data: StorageLocationResolveDto } | { kind: 'box'; data: BoxResolveDto };
type Crumb = { label: string; go: () => void };
type Completion = { title: string; text: string };

interface ArCommittee { id: number; number: string; boxCount: number; }
interface Placement { trackingCode: string; qrCode: string; place: string; }
interface SessionBox { id: number; seq: number; code: string; state: 'done' | 'pending' | 'todo' | 'scanned'; note: string; rack: string;}
interface Slot { text: string; state: 'ok' | 'wait' | 'idle'; }
type BoxFilter = 'all' | 'todo' | 'done';
interface SideItem { id: number; number: string; label: string; status: 'now' | 'done' | 'todo'; }
interface LookupOption { id: number; name: string; }

const PAGE_SIZE = 12;
const DELIVERED_TEXT = 'تم التسليم';
const isDeliveredText = (s?: string) => /deliver|تم التسليم|مسلم|مسلّم/i.test(s ?? '');

@Component({
  selector: 'app-archiving',
  standalone: true,
  imports: [CommonModule, DialogModule, WorkflowStepLayoutComponent , FormsModule, SelectModule, ButtonModule, TooltipModule],
  templateUrl: './archiving.component.html',
  styleUrl: './archiving.component.scss',
})
export default class ArchivingComponent implements OnInit {
  private api = inject(ArchivingBoxService);
  private lookups = inject(Lookups);
  private messages = inject(MessageService);
  private authService = inject(AuthService);

  readonly essentials = ['مسح الصندوق والرف', 'تأكيد تخزين اللجنة', 'تسليم اللجان من المخزن'];
  readonly tab = signal<Tab>('archive');
  readonly accessRoleResolved = signal(false);
  readonly warehouseOnly = signal(false);
  readonly roleLoadError = signal<string | null>(null);

  arGovernorateOptions = computed(() =>
  this.arGovernorates().map(g => ({ label: g.name, value: g.id })));

arSubjectOptions = computed(() =>
  this.arSubjects().map(s => ({ label: s.name, value: s.id })));
  // =====================================================================
  //  Pagination
  //   - دفعات الأرشيف ولجان الدفعة (الأرشيف) ولجان المخزن: من الباك
  //   - باقي المستويات: الـ endpoints بترجّع الكل فبنقسّم على الشاشة
  // =====================================================================
  readonly pg = signal({ page: 1, size: PAGE_SIZE, total: 0 });
  readonly pageTotal = computed(() => {
    if (this.tab() === 'archive') return this.pg().total;
    switch (this.whLevel()) {
      case 'gov': return this.whGovernorates().length;
      case 'order': return this.whOrders().length;
      case 'batch': return this.whBatches().length;
      default: return this.pg().total;
    }
  });
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.pageTotal() / this.pg().size)));
  readonly pageNumbers = computed(() => {
    const cur = this.pg().page, last = this.pageCount();
    const from = Math.max(1, Math.min(cur - 2, last - 4)), to = Math.min(last, from + 4);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  });
  readonly pageFrom = computed(() => (this.pageTotal() ? (this.pg().page - 1) * this.pg().size + 1 : 0));
  readonly pageTo = computed(() => Math.min(this.pg().page * this.pg().size, this.pageTotal()));

  private resetPage(): void { this.pg.set({ page: 1, size: PAGE_SIZE, total: 0 }); }
  private slice<T>(list: T[]): T[] { const { page, size } = this.pg(); return list.slice((page - 1) * size, page * size); }

  goPage(p: number): void {
    if (p < 1 || p > this.pageCount() || p === this.pg().page) return;
    this.pg.update(s => ({ ...s, page: p }));
    if (this.tab() === 'archive') {
      const b = this.arBatch();
      b ? this.loadBatchCommittees(b) : this.loadArchive();
    }
    if (this.tab() === 'warehouse' && this.whLevel() === 'committee') this.loadCommittees(this.whBatchId()!);
  }

  // =====================================================================
  //  ARCHIVE  (دفعة ← لجنة ← سكان صندوق/رف ← تأكيد اللجنة)
  // =====================================================================
  readonly arLoading = signal(false);
  readonly arError = signal<string | null>(null);
  readonly arItems = signal<PackedItemDto[]>([]);            // الدفعات (packed-items)
  readonly arBatch = signal<PackedItemDto | null>(null);
  readonly arCommittees = signal<ArCommittee[]>([]);         // packed-committees (صفحة من الباك)
  readonly arCommitteeId = signal<number | null>(null);
  readonly packedBoxes = signal<CommitteeBoxItemDto[]>([]);  // packed-boxes
  readonly arBoxesLoading = signal(false);

  readonly pendingBox = signal<string | null>(null);
  readonly placed = signal<Placement[]>([]);

  // ---------------------------------------------------------------------
  //  فلاتر الدفعات (محافظة / مادة) — بتتبعت للباك مع packed-items
  // ---------------------------------------------------------------------
  readonly arGovernorates = signal<LookupOption[]>([]);
  readonly arSubjects = signal<LookupOption[]>([]);
  readonly arGovId = signal<number | null>(null);
  readonly arSubjectId = signal<number | null>(null);
  readonly arHasFilter = computed(() => this.arGovId() !== null || this.arSubjectId() !== null);

  // بنلغي الطلب القديم لو المستخدم غيّر الفلتر بسرعة
  private archiveSub?: Subscription;

  /** تحميل قوائم المحافظات والمواد للـ dropdowns */
  private loadFilterLookups(): void {
    this.lookups.getLookupGovernorateData().subscribe({
      next: r => this.arGovernorates.set(this.toOptions(r)),
      error: e => this.say('err', this.errText(e)),
    });
    this.lookups.getLookupSubjectData().subscribe({
      next: r => this.arSubjects.set(this.toOptions(r)),
      error: e => this.say('err', this.errText(e)),
    });
  }

  onArGovChange(value: string): void {
    this.arGovId.set(value ? Number(value) : null);
    this.applyArFilter();
  }
  onArSubjectChange(value: string): void {
    this.arSubjectId.set(value ? Number(value) : null);
    this.applyArFilter();
  }
  clearArFilters(): void {
    if (!this.arHasFilter()) return;
    this.arGovId.set(null);
    this.arSubjectId.set(null);
    this.applyArFilter();
  }
  private applyArFilter(): void {
    this.resetPage();
    this.loadArchive();
  }

  /** GET /Boxes/packed-items — pagination + فلاتر من الباك */
  loadArchive(): void {
    const { page, size } = this.pg();
    this.archiveSub?.unsubscribe();
    this.arLoading.set(true);
    this.arError.set(null);
    this.archiveSub = this.api.getPackedItems({
      isPaged: true,
      pageNumber: page,
      pageSize: size,
      governorateId: this.arGovId() ?? undefined,
      subjectId: this.arSubjectId() ?? undefined,
    }).subscribe({
      next: r => {
        const items = this.toArray<PackedItemDto>(r.data);
        this.arItems.set(items);
        this.pg.update(s => ({ ...s, total: r.data?.totalCount ?? items.length }));
        this.arLoading.set(false);
      },
      error: e => { this.arError.set(this.errText(e)); this.arLoading.set(false); },
    });
  }

  /** GET /Boxes/batches/{batchId}/packed-committees — pagination من الباك */
  private loadBatchCommittees(item: PackedItemDto, silent = false): void {
    const { page, size } = this.pg();
    if (!silent) this.arLoading.set(true);
    this.arError.set(null);
    this.api.getBatchPackedCommittees(item.batchId, { isPaged: true, pageNumber: page, pageSize: size }).subscribe({
      next: r => {
        const items = this.toArray<PackedCommitteeDto>(r.data)
          .map(c => ({ id: c.committeeId, number: c.committeeNumber, boxCount: c.boxCount }));
        this.arCommittees.set(items);
        this.pg.update(s => ({ ...s, total: r.data?.totalCount ?? items.length }));
        this.arLoading.set(false);
      },
      error: e => { this.arError.set(this.errText(e)); this.arLoading.set(false); },
    });
  }

  /** GET /Boxes/committees/{id}/packed-boxes */
  private loadPackedBoxes(committeeId: number): void {
    this.arBoxesLoading.set(true);
    this.api.getCommitteePackedBoxes(committeeId).subscribe({
      next: r => {
        // تجاهل الرد لو المستخدم قفل اللجنة أو فتح غيرها قبل ما يوصل
        if (this.arCommitteeId() !== committeeId) return;
        this.packedBoxes.set(this.toArray<CommitteeBoxItemDto>(r.data));
        this.arBoxesLoading.set(false);
      },
      error: e => { this.arBoxesLoading.set(false); this.say('err', this.errText(e)); },
    });
  }

  readonly arSelected = computed(() => this.arCommittees().find(c => c.id === this.arCommitteeId()) ?? null);
  readonly arLevel = computed<'batch' | 'committee'>(() => (this.arBatch() === null ? 'batch' : 'committee'));

  readonly arCrumbs = computed<Crumb[]>(() => {
    const out: Crumb[] = [{ label: 'الدفعات', go: () => this.arGoBatches() }];
    const b = this.arBatch();
    if (b) out.push({ label: b.governorateName || b.label, go: () => this.pickArCommittee(null) });
    const c = this.arSelected();
    if (c) out.push({ label: `لجنة ${c.number}`, go: () => undefined });
    return out;
  });

  arDone(c: ArCommittee): boolean { return this.doneCommittees().has(c.id); }

  pickArBatch(item: PackedItemDto): void {
    this.arBatch.set(item); this.arCommittees.set([]); this.arCommitteeId.set(null);
    this.resetPage(); this.resetScan();
    this.loadBatchCommittees(item);
  }
  pickArCommittee(id: number | null): void {
    this.arCommitteeId.set(id); this.resetScan();
    if (id !== null) this.loadPackedBoxes(id);
  }
  arGoBatches(): void {
    this.arBatch.set(null); this.arCommittees.set([]); this.arCommitteeId.set(null);
    this.resetPage(); this.resetScan();
    this.loadArchive();   // الفلاتر المختارة بتفضل زي ما هي
  }

  readonly arBoxes = computed(() => {
    const placedMap = new Map(this.placed().map(p => [p.trackingCode, p]));
    return this.packedBoxes().map(b => {
      const p = placedMap.get(b.trackingCode);
      const state: 'done' | 'pending' | 'todo' =
        p || (b.storageLocationId ?? 0) > 0 ? 'done' : this.pendingBox() === b.trackingCode ? 'pending' : 'todo';
      return { ...b, state, where: p?.place ?? b.storageLocationQrCode ?? '' };
    });
  });
  readonly arAllPlaced = computed(() => this.arBoxes().length > 0 && this.arBoxes().every(b => b.state === 'done'));
  readonly arStep = computed<1 | 2>(() => (this.pendingBox() ? 2 : 1));

  /** خانتين ظاهرين في الجلسة: الصندوق ← الرف */
  readonly arSlots = computed<{ box: Slot; shelf: Slot }>(() => {
    const pending = this.pendingBox();
    const last = this.placed()[this.placed().length - 1];
    if (pending) return { box: { text: pending, state: 'ok' }, shelf: { text: 'امسح كود الرف', state: 'wait' } };
    if (last) return { box: { text: last.trackingCode, state: 'ok' }, shelf: { text: last.place, state: 'ok' } };
    return { box: { text: 'امسح الصندوق', state: 'wait' }, shelf: { text: '—', state: 'idle' } };
  });

  // =====================================================================
  //  WAREHOUSE  (محافظة ← مادة/أمر توريد ← دفعة ← لجنة ← سكان وتسليم فوري)
  // =====================================================================
  readonly whLoading = signal(false);
  readonly whError = signal<string | null>(null);
  readonly orders = signal<DeliveryOrderDto[]>([]);
  readonly whBatches = signal<DeliveryBatchDto[]>([]);
  readonly whCommittees = signal<DeliveryCommitteeDto[]>([]);

  readonly whGov = signal<string | null>(null);
  readonly whOrderId = signal<number | null>(null);
  readonly whBatchId = signal<number | null>(null);
  readonly whCommitteeId = signal<number | null>(null);
  readonly deliverResult = signal<DeliverCommitteeResult | null>(null);

  // أكواد الصناديق التي تم عمل Scan لها ولم يتم إرسالها/تأكيدها بعد.
  readonly whScannedCodes = signal<string[]>([]);
  readonly whSubmittedCount = signal(0);
  readonly whDeliveryError = signal(false);

  // اشتراكات الـ batches واللجان — بنلغي القديم قبل ما ننده جديد
  private batchesSub?: Subscription;
  private committeesSub?: Subscription;

  /** عنوان أمر التوريد: الـ API ساعات بيرجّع subjectName فاضي */
  orderTitle(o: DeliveryOrderDto | null): string {
    if (!o) return '';
    return o.subjectName?.trim() || `أمر توريد ${o.deliveryOrderId}`;
  }

  private cancelWh(): void {
    this.batchesSub?.unsubscribe();
    this.committeesSub?.unsubscribe();
  }

  readonly whScannedCount = computed(() => this.whScannedCodes().length);
  readonly whExpectedScanCount = computed(() => {
    const committee = this.whSelected();
    if (!committee) return 0;
    return committee.boxes.filter(box => !this.boxDelivered(box)).length;
  });

  loadOrders(): void {
    this.whLoading.set(true);
    this.whError.set(null);
    this.api.getDeliveryOrders().subscribe({
      next: r => { this.orders.set(this.toArray<DeliveryOrderDto>(r.data)); this.whLoading.set(false); },
      error: e => { this.whError.set(this.errText(e)); this.whLoading.set(false); },
    });
  }

  readonly whGovernorates = computed(() => {
    const m = new Map<string, { name: string; orders: number; batches: number; delivered: number }>();
    for (const o of this.orders()) {
      const g = m.get(o.governorateName) ?? { name: o.governorateName, orders: 0, batches: 0, delivered: 0 };
      g.orders++; g.batches += o.batchCount; g.delivered += o.deliveredBatchCount;
      m.set(o.governorateName, g);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  });
  readonly whOrders = computed(() => this.orders().filter(o => o.governorateName === this.whGov()));
  readonly whGovernoratesPage = computed(() => this.slice(this.whGovernorates()));
  readonly whOrdersPage = computed(() => this.slice(this.whOrders()));
  readonly whBatchesPage = computed(() => this.slice(this.whBatches()));

  readonly whSelectedOrder = computed(() => this.orders().find(o => o.deliveryOrderId === this.whOrderId()) ?? null);
  readonly whSelectedBatch = computed(() => this.whBatches().find(b => b.batchId === this.whBatchId()) ?? null);
  readonly whSelected = computed(() => this.whCommittees().find(c => c.committeeId === this.whCommitteeId()) ?? null);
  readonly whLevel = computed<'gov' | 'order' | 'batch' | 'committee'>(() =>
    !this.whGov() ? 'gov' : this.whOrderId() === null ? 'order' : this.whBatchId() === null ? 'batch' : 'committee');

  readonly whCrumbs = computed<Crumb[]>(() => {
    const out: Crumb[] = [{ label: 'المحافظات', go: () => this.whGoGov() }];
    if (this.whGov()) out.push({ label: this.whGov()!, go: () => this.whGoOrders() });
    const o = this.whSelectedOrder();
    if (o && this.whOrders().length > 1) out.push({ label: this.orderTitle(o), go: () => this.whGoBatches() });
    const b = this.whSelectedBatch();
    if (b && this.whBatches().length > 1) out.push({ label: b.label, go: () => this.pickWhCommittee(null) });
    const c = this.whSelected();
    if (c) out.push({ label: `لجنة ${c.committeeNumber}`, go: () => undefined });
    return out;
  });

  pickGov(name: string): void {
    this.cancelWh();
    this.whGov.set(name); this.whOrderId.set(null); this.whBatchId.set(null);
    this.whBatches.set([]); this.whCommittees.set([]); this.whCommitteeId.set(null);
    this.resetPage(); this.resetScan();
    const orders = this.whOrders();
    if (orders.length === 1) this.pickOrder(orders[0].deliveryOrderId);   // أمر واحد → ننده batches علطول
  }

  pickOrder(id: number): void {
    this.cancelWh();
    this.whOrderId.set(id); this.whBatchId.set(null); this.whBatches.set([]);
    this.whCommittees.set([]); this.whCommitteeId.set(null);
    this.resetPage(); this.resetScan();
    this.whLoading.set(true);
    this.batchesSub = this.api.getDeliveryOrderBatches(id).subscribe({
      next: r => {
        if (this.whOrderId() !== id) return;   // رد قديم
        const list = this.toArray<DeliveryBatchDto>(r.data);
        this.whBatches.set(list);
        this.whLoading.set(false);
        if (list.length === 1) this.pickBatch(list[0].batchId);   // اللجان بعد الدفعات بالترتيب
      },
      error: e => { this.whLoading.set(false); this.say('err', this.errText(e)); },
    });
  }

  pickBatch(id: number): void {
    this.committeesSub?.unsubscribe();
    this.whBatchId.set(id); this.whCommittees.set([]); this.whCommitteeId.set(null);
    this.resetPage(); this.resetScan();
    this.loadCommittees(id);
  }

  /** لجان الدفعة: pagination من الباك */
  private loadCommittees(batchId: number, silent = false): void {
    const { page, size } = this.pg();
    this.committeesSub?.unsubscribe();   // يلغي أي طلب لجان شغال
    if (!silent) this.whLoading.set(true);
    this.committeesSub = this.api.getBatchCommittees(batchId, { isPaged: true, pageNumber: page, pageSize: size }).subscribe({
      next: r => {
        if (this.whBatchId() !== batchId) return;
        const d = r.data;
        const items = Array.isArray(d) ? d as DeliveryCommitteeDto[] : (d?.data ?? []);
        const total = Array.isArray(d) ? d.length : (d?.totalCount ?? items.length);
        this.whCommittees.set(items);
        this.pg.update(s => ({ ...s, total }));
        this.whLoading.set(false);
      },
      error: e => { this.whLoading.set(false); this.say('err', this.errText(e)); },
    });
  }

  pickWhCommittee(id: number | null): void { this.whCommitteeId.set(id); this.resetScan(); }

  whGoGov(): void {
    this.cancelWh();
    this.whGov.set(null); this.whOrderId.set(null); this.whBatchId.set(null);
    this.whBatches.set([]); this.whCommittees.set([]); this.whCommitteeId.set(null);
    this.resetPage(); this.resetScan();
  }

  whGoOrders(): void {
    this.whCommitteeId.set(null); this.resetScan();
    if (this.whOrders().length === 1) {   // مفيش مستوى أوامر
      if (this.whBatches().length > 1) {
        this.committeesSub?.unsubscribe();
        this.whBatchId.set(null); this.whCommittees.set([]); this.resetPage();
      }
      return;
    }
    this.cancelWh();
    this.whOrderId.set(null); this.whBatchId.set(null);
    this.whBatches.set([]); this.whCommittees.set([]); this.resetPage();
  }

  whGoBatches(): void {
    if (this.whBatches().length === 1) { this.whGoOrders(); return; }
    this.committeesSub?.unsubscribe();
    this.whBatchId.set(null); this.whCommitteeId.set(null); this.whCommittees.set([]);
    this.resetPage(); this.resetScan();
  }

  boxDelivered(b: { status: string }): boolean { return isDeliveredText(b.status); }
  whDone(c: DeliveryCommitteeDto): boolean {
    return this.doneCommittees().has(c.committeeId) || (c.boxes.length > 0 && c.boxes.every(b => this.boxDelivered(b)));
  }
  pct(done: number, total: number): number { return total ? Math.round((done / total) * 100) : 0; }

  // =====================================================================
  //  عام
  // =====================================================================
  readonly doneCommittees = signal<Set<number>>(new Set());
  readonly busy = signal(false);
  readonly lastRead = signal('');
  readonly feedback = signal<Feedback | null>(null);
  readonly lookup = signal<Lookup | null>(null);

  /** رسالة الإنجاز: بتظهر فوق الجلسة بعد ما اللجنة تخلص، والمستخدم لازم يضغط «تمام» */
  readonly completion = signal<Completion | null>(null);

  /** التابة الافتراضية (الأرشيف) بس — المخزن بيتحمّل لما تتضغط */
  ngOnInit(): void {
    this.loadFilterLookups();
    this.loadTab();
  }

  setTab(t: Tab): void {
    if (this.warehouseOnly() && t === 'archive') return;
    this.tab.set(t); this.resetPage(); this.resetScan();
    this.loadTab();   // بيحمّل بيانات التابة اللي اتضغطت
  }

  private resolveArchivingRole(): void {
    const normalizeRole = (role: unknown): string =>
      String(role ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    const applyRole = (role: unknown): void => {
      this.warehouseOnly.set(normalizeRole(role) === 'warehouse');
      this.tab.set(this.warehouseOnly() ? 'warehouse' : 'archive');
      this.accessRoleResolved.set(true);
      this.roleLoadError.set(null);
      this.loadTab();
    };

    const cachedRole = this.authService.profileRole() || this.authService.currentUser()?.role;
    if (cachedRole) {
      applyRole(cachedRole);
      return;
    }

    this.authService.profile().subscribe({
      next: response => {
        const profile = response?.data?.data ?? response?.data ?? response;
        const role = profile?.roleName
          ?? profile?.role
          ?? profile?.user?.roleName
          ?? profile?.user?.role;
        if (!role) {
          this.roleLoadError.set('تعذر تحديد صلاحية المستخدم. أعد تحميل الصفحة.');
          return;
        }
        applyRole(role);
      },
      error: error => {
        console.error('Failed to resolve archiving role:', error);
        this.roleLoadError.set('تعذر تحميل صلاحية المستخدم. أعد المحاولة.');
      }
    });
  }

  retryResolveArchivingRole(): void {
    this.roleLoadError.set(null);
    this.resolveArchivingRole();
  }
  refresh(): void { this.loadTab(); }

  private loadTab(): void {
    if (this.tab() === 'archive') {
      const b = this.arBatch();
      if (b) {
        this.loadBatchCommittees(b);
        const id = this.arCommitteeId();
        if (id !== null) this.loadPackedBoxes(id);
      } else {
        this.loadArchive();
      }
    } else {
      this.loadOrders();
      const batchId = this.whBatchId();
      if (batchId !== null) this.loadCommittees(batchId);
    }
  }

  // =====================================================================
  //  جلسة السكان
  // =====================================================================
  readonly boxFilter = signal<BoxFilter>('all');
  readonly sideSearch = signal('');
  readonly errorCount = signal(0);

  readonly session = computed(() => {
    if (this.tab() === 'archive') {
      const c = this.arSelected(), b = this.arBatch();
      return c ? { id: c.id, number: c.number, subject: b?.subjectName ?? '', chips: [b?.governorateName ?? '', b?.subjectName ?? '', b?.roundName ?? ''] } : null;
    }
    const c = this.whSelected(), o = this.whSelectedOrder(), b = this.whSelectedBatch();
    return c ? { id: c.committeeId, number: c.committeeNumber, subject: this.orderTitle(o), chips: [o?.governorateName ?? '', this.orderTitle(o), b?.roundName ?? o?.roundName ?? ''] } : null;
  });

  readonly sessionBoxes = computed<SessionBox[]>(() => {
    if (this.tab() === 'archive') {
      if (!this.arSelected()) return [];
      const placedMap = new Map(this.placed().map(p => [p.trackingCode, p]));
      return this.packedBoxes().map(b => {
        const p = placedMap.get(b.trackingCode);
        const stored = (b.storageLocationId ?? 0) > 0;
        const state: SessionBox['state'] = p || stored ? 'done' : this.pendingBox() === b.trackingCode ? 'pending' : 'todo';
        return {
          id: b.boxId, seq: b.sequenceNo, code: b.trackingCode, state,
          note: p?.place ?? b.storageLocationQrCode ?? '',
          rack: b.storageLocationQrCode ?? '',
        };
      });
    }

    const c = this.whSelected();
    if (!c) return [];

    const scannedCodes = new Set(this.whScannedCodes());

    return c.boxes.map(b => {
      const delivered = this.boxDelivered(b);
      const scanned = scannedCodes.has(b.qrCode);

      return {
        id: b.boxId,
        seq: b.sequenceNo,
        code: b.qrCode,
        state: (
          delivered ? 'done' :
          scanned ? 'scanned' :
          'todo'
        ) as SessionBox['state'],
        note: delivered
          ? 'تم التسليم'
          : scanned
            ? 'تمت القراءة بنجاح — في انتظار التسليم'
            : '',
        rack: b.storageLocationCode ?? '',
      };
    });
  });

  readonly sessionStats = computed(() => {
    const list = this.sessionBoxes();
    const total = list.length, done = list.filter(b => b.state === 'done').length;
    return { total, done, remaining: total - done, pct: total ? Math.round((done / total) * 100) : 0 };
  });
  readonly visibleBoxes = computed(() => {
    const f = this.boxFilter();
    return this.sessionBoxes().filter(b => f === 'all' || (f === 'done' ? b.state === 'done' : b.state !== 'done'));
  });

  readonly sideList = computed<SideItem[]>(() => {
    const q = this.sideSearch().trim();
    const items: SideItem[] = this.tab() === 'archive'
      ? this.arCommittees().map(c => ({ id: c.id, number: c.number, label: `${c.boxCount} صناديق`, status: c.id === this.arCommitteeId() ? 'now' as const : this.arDone(c) ? 'done' as const : 'todo' as const }))
      : this.whCommittees().map(c => ({ id: c.committeeId, number: c.committeeNumber, label: `${c.boxes.length} صناديق`, status: c.committeeId === this.whCommitteeId() ? 'now' as const : this.whDone(c) ? 'done' as const : 'todo' as const }));
    return q ? items.filter(i => i.number.includes(q) || i.label.includes(q)) : items;
  });

  readonly canFinish = computed(() =>
    this.tab() === 'archive' && this.arAllPlaced() && this.placed().length > 0 && !this.completion());

  /** خلص مسح كل الصناديق وفاضل زرار الإرسال/التأكيد */
  readonly readyToSubmit = computed(() => {
    if (this.completion()) return false;
    if (this.tab() === 'archive') return this.arAllPlaced() && this.placed().length > 0;
    const expected = this.whExpectedScanCount();
    return expected > 0 && this.whScannedCount() >= expected;
  });

  /** نسبة شريط التقدم في قارئ الباركود */
  readonly scanProgress = computed(() => {
    if (this.tab() === 'archive') return this.sessionStats().pct;
    const expected = this.whExpectedScanCount();
    return expected ? Math.min(100, Math.round((this.whScannedCount() / expected) * 100)) : this.sessionStats().pct;
  });

  openCommittee(id: number): void { this.tab() === 'archive' ? this.pickArCommittee(id) : this.pickWhCommittee(id); }
  closeSession(): void {
    if (!this.session()) return;
    this.tab() === 'archive' ? this.pickArCommittee(null) : this.pickWhCommittee(null);
  }

  /** زرار «تمام» في رسالة الإنجاز: يقفل شاشة السكان ويحدّث القوائم */
  acknowledgeComplete(): void {
    const archive = this.tab() === 'archive';
    const batch = this.arBatch();
    this.completion.set(null);
    this.closeSession();
    if (archive) {
      if (batch) this.loadBatchCommittees(batch, true);
    } else {
      this.loadOrders();
      const batchId = this.whBatchId();
      if (batchId !== null) this.loadCommittees(batchId, true);
    }
  }

  whDeliveredCount(c: DeliveryCommitteeDto): number { return c.boxes.filter(b => this.boxDelivered(b)).length; }
  whLocations(c: DeliveryCommitteeDto): string[] { return [...new Set(c.boxes.map(b => b.storageLocationCode).filter(Boolean))]; }

  // ---------------------------------------------------------------- scanner
  private buf = '';
  private lastKey = 0;
  private queue: string[] = [];

  /**
   * الماسح شغّال على مستوى الصفحة كلها من غير focus على أي input:
   * بنلقط keydown على document، وبنقرا e.code عشان الكيبورد العربي، وEnter/Tab بينهوا القراءة.
   * أي عنصر جواه [data-no-scan] (زي بحث اللجان والفلاتر) بيتجاهل.
   */
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.session()) {
      this.completion() ? this.acknowledgeComplete() : this.closeSession();
      return;
    }
    if (this.completion()) return;   // رسالة الإنجاز ظاهرة — مفيش سكان
    const t = e.target as HTMLElement | null;
    if (t?.closest('[data-no-scan]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const now = Date.now();
    if (now - this.lastKey > 250) this.buf = '';
    this.lastKey = now;

    if (e.key === 'Enter' || e.key === 'Tab') {
      const code = this.buf; this.buf = '';
      if (code.length >= 3) { e.preventDefault(); this.onScan(code); }
      return;
    }
    const ch = this.keyChar(e);
    if (ch) this.buf += ch;
  }

  private keyChar(e: KeyboardEvent): string {
    if (e.key.length === 1 && e.key.charCodeAt(0) < 128) return e.key;
    const c = e.code;
    let m: RegExpExecArray | null;
    if ((m = /^Key([A-Z])$/.exec(c))) return e.shiftKey ? m[1] : m[1].toLowerCase();
    if ((m = /^(?:Digit|Numpad)(\d)$/.exec(c))) return m[1];
    if (c === 'Minus' && e.shiftKey) return '_';
    return ({ Minus: '-', NumpadSubtract: '-', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Backslash: '\\' } as Record<string, string>)[c] ?? '';
  }

  manualScan(input: HTMLInputElement): void {
    const v = input.value.trim();
    if (v) this.onScan(v);
    input.value = '';
  }
  sideEnter(): void {
    const v = this.sideSearch().trim();
    if (v.length >= 6) { this.sideSearch.set(''); this.onScan(v); }
  }

  /** كل قراءة بتدخل طابور — مفيش قراءة بتضيع لو في طلب شغال */
  onScan(raw: string): void {
    if (this.completion()) return;
    const code = raw.trim();
    if (!code) return;
    this.queue.push(code);
    this.pump();
  }
  private pump(): void {
    while (!this.busy() && this.queue.length) {
      const code = this.queue.shift()!;
      this.lastRead.set(code);
      this.feedback.set(null);   // نمسح نتيجة القراءة السابقة قبل ما نعالج الجديدة

      // كل الصناديق اتمسحت: المسح مقفول لحد الإرسال/التأكيد — منعرضش أي قراءة جديدة
      if (this.readyToSubmit()) {
        this.say('lock', this.tab() === 'archive'
          ? 'المسح مقفول — تم تحديد مكان كل الصناديق، اضغط «تأكيد تخزين اللجنة»'
          : 'المسح مقفول — تم مسح كل الصناديق، اضغط «تسليم» لإنهاء التسليم');
        continue;
      }

      if (this.tab() === 'archive') this.arSelected() ? this.archiveScan(code) : this.resolve(code);
      else this.whSelected() ? this.warehouseScan(code) : this.resolve(code);
    }
  }
  private begin(): void { this.busy.set(true); }
  private release(): void { this.busy.set(false); this.pump(); }

  // ---- أرشيف: صندوق ثم رف (بيتجمّعوا محليًا والتأكيد بـ confirm-committee)
  private archiveScan(code: string): void {
    if (this.arBoxesLoading()) return this.say('warn', 'جاري تحميل صناديق اللجنة — حاول كمان لحظة');

    const pending = this.pendingBox();
    const asBox = this.packedBoxes().find(b => b.trackingCode === code);
    const isDone = (b: CommitteeBoxItemDto) =>
      (b.storageLocationId ?? 0) > 0 || this.placed().some(p => p.trackingCode === b.trackingCode);

    if (!pending) {
      if (!asBox) {
        return this.say('err', 'القراءة غير مطابقة — الكود لا يتبع أي صندوق في اللجنة المختارة');
      }
      if (isDone(asBox)) return this.say('warn', 'الصندوق ده متخزن قبل كده');
      this.pendingBox.set(code);
      return this.say('ok', 'تم مسح الصندوق — امسح كود الرف');
    }

    if (asBox) {
      if (isDone(asBox)) return this.say('warn', 'الصندوق ده متخزن قبل كده');
      this.pendingBox.set(code);
      return this.say('warn', 'اتغيّر الصندوق — امسح كود الرف');
    }

    this.begin();
    this.api.resolveLocation(code).pipe(finalize(() => this.release())).subscribe({
      next: r => {
        if (!r.success || !r.data) {
          return this.say('err', 'القراءة غير مطابقة — كود الرف غير معروف');
        }
        const place = `${r.data.rack} / ${r.data.shelf}`;
        this.placed.update(p => [...p, { trackingCode: pending, qrCode: code, place }]);
        this.pendingBox.set(null);
        this.say('ok', this.arAllPlaced()
          ? `تم تخزين الصندوق في ${place} — اضغط «تأكيد تخزين اللجنة»`
          : `تم تخزين الصندوق في ${place}`);
      },
      error: e => this.say('err', this.errText(e)),
    });
  }

  /** POST /Boxes/storage/confirm-committee */
  confirmCommittee(): void {
    const c = this.arSelected();
    if (!c || !this.placed().length || this.busy()) return;
    this.begin();
    this.api.confirmCommitteeStorage({ placements: this.placed().map(p => ({ trackingCode: p.trackingCode, qrCode: p.qrCode })) })
      .pipe(finalize(() => this.release())).subscribe({
        next: r => {
          if (!r.success) return this.say('err', r.message || 'تعذر تأكيد التخزين');
          this.doneCommittees.update(s => new Set(s).add(c.id));
          this.feedback.set(null);
          // الإغلاق والتحديث بيحصلوا لما المستخدم يضغط «تمام»
          this.completion.set({
            title: 'تم تخزين اللجنة بنجاح',
            text: `تم تخزين كل صناديق اللجنة ${c.number} وتسجيل أماكنها في المخزن.`,
          });
        },
        error: e => this.say('err', this.errText(e)),
      });
  }

  // ---- مخزن: نجمع أكواد اللجنة أولًا، ثم نرسل طلبًا واحدًا بعد آخر صندوق.
  private warehouseScan(code: string): void {
    const committee = this.whSelected();
    if (!committee) return;

    const box = committee.boxes.find(item => item.qrCode === code);

    // الكود غير تابع للجنة المختارة
    if (!box) {
      this.say('err', 'القراءة غير مطابقة — الكود لا يتبع اللجنة المختارة');
      return;
    }

    // الصندوق تم تسليمه بالفعل
    if (this.boxDelivered(box)) {
      this.say('warn', `الصندوق ${box.sequenceNo} تم تسليمه بالفعل`);
      return;
    }

    // الصندوق تمت قراءته من قبل
    if (this.whScannedCodes().includes(code)) {
      this.say('warn', `الصندوق ${box.sequenceNo} تمت قراءته بالفعل`);
      return;
    }

    // تسجيل القراءة الصحيحة
    this.whScannedCodes.update(codes => [...codes, code]);

    const scanned = this.whScannedCount();
    const expected = this.whExpectedScanCount();

    this.say(
      'ok',
      scanned >= expected
        ? `تمت قراءة الصندوق ${box.sequenceNo} — تم مسح كل الصناديق (${scanned} من ${expected})، اضغط «تسليم»`
        : `تمت القراءة بنجاح — الصندوق ${box.sequenceNo} مطابق للجنة (${scanned} من ${expected})`
    );
  }

  submitWarehouseDelivery(): void {
    const committee = this.whSelected();
    const qrCodes = this.whScannedCodes();

    if (!committee || !qrCodes.length || this.busy()) return;

    this.whSubmittedCount.set(qrCodes.length);
    this.whDeliveryError.set(false);
    this.begin();

    this.api.deliverCommittee(committee.committeeId, qrCodes)
      .pipe(finalize(() => this.release()))
      .subscribe({
        next: response => {
          const result = response.data ?? null;
          this.deliverResult.set(result);

          const problems = result?.problems ?? [];
          const failedCodes = new Set(problems.map(problem => problem.qrCode));

          // لو الطلب كله فشل بدون تفاصيل لكل كود، لا نعتبر أي صندوق تم تسليمه.
          const successfulCodes = response.success
            ? qrCodes.filter(code => !failedCodes.has(code))
            : [];

          successfulCodes.forEach(code => this.patchBox(committee.committeeId, code));

          // نحتفظ بالأكواد الفاشلة فقط حتى لا نعيد إرسال الصناديق الناجحة عند المحاولة مرة أخرى.
          const retryCodes = response.success
            ? qrCodes.filter(code => failedCodes.has(code))
            : qrCodes;

          this.whScannedCodes.set(retryCodes);
          this.whDeliveryError.set(!response.success || retryCodes.length > 0);

          const deliveredCount = result?.deliveredBoxCount ?? successfulCodes.length;

          const left = this.whSelected()?.boxes.filter(box => !this.boxDelivered(box)).length ?? 0;

          if (this.whDeliveryError()) {
            this.say(
              'err',
              `تم تأكيد ${successfulCodes.length} صندوق، ويوجد ${retryCodes.length} صندوق لم يتم تسليمه`
            );
          } else if (left === 0) {
            this.doneCommittees.update(set => new Set(set).add(committee.committeeId));
            this.feedback.set(null);
            // الإغلاق والتحديث بيحصلوا لما المستخدم يضغط «تمام»
            this.completion.set({
              title: 'تم تسليم اللجنة بالكامل',
              text: `تم تسليم كل صناديق اللجنة ${committee.committeeNumber} (${deliveredCount} صندوق) وتسجيل التسليم إلكترونيًا.`,
            });
            return;
          } else {
            this.messages.add({
              severity: 'success',
              summary: 'تم التسليم',
              detail: `تم تسليم ${deliveredCount} صندوق — متبقي ${left} صندوق في اللجنة`,
              life: 5000,
            });
            this.say('ok', `تم تسليم ${deliveredCount} صندوق — متبقي ${left}`);
          }

          this.loadOrders();
          const batchId = this.whBatchId();
          if (batchId !== null) this.loadCommittees(batchId, true);
        },
        error: error => {
          this.whDeliveryError.set(true);
          this.say('err', this.errText(error));
        },
      });
  }

  private patchBox(committeeId: number, code: string): void {
    this.whCommittees.update(list => list.map(c => c.committeeId !== committeeId ? c
      : { ...c, boxes: c.boxes.map(b => b.qrCode === code ? { ...b, status: DELIVERED_TEXT } : b) }));
  }

  // ---- استعلام (من غير لجنة مختارة)
  private resolve(code: string): void {
    this.begin();
    this.api.resolveLocation(code).pipe(finalize(() => this.release())).subscribe({
      next: r => r.success && r.data ? this.lookup.set({ kind: 'location', data: r.data }) : this.resolveBox(code),
      error: () => this.resolveBox(code),
    });
  }
  private resolveBox(code: string): void {
    this.api.resolveBox(code).subscribe({
      next: r => r.success && r.data ? this.lookup.set({ kind: 'box', data: r.data }) : this.say('err', r.message || 'الكود غير معروف'),
      error: e => this.say('err', this.errText(e)),
    });
  }
  closeLookup(): void { this.lookup.set(null); }

  // ---- helpers
  private resetScan(): void {
    this.packedBoxes.set([]); this.arBoxesLoading.set(false);
    this.pendingBox.set(null); this.placed.set([]);
    this.deliverResult.set(null);
    this.whScannedCodes.set([]);
    this.whSubmittedCount.set(0);
    this.whDeliveryError.set(false);
    this.completion.set(null);
    this.lookup.set(null); this.feedback.set(null);
    this.errorCount.set(0); this.boxFilter.set('all'); this.sideSearch.set(''); this.queue = [];
  }

  /** النتيجة (نجاح/تحذير/خطأ) بتفضل ظاهرة لحد القراءة الجاية — من غير timeout */
  private say(kind: Feedback['kind'], text: string): void {
    if (kind === 'err' && this.session()) {
      this.errorCount.update(n => n + 1);
    }
    this.feedback.set({ kind, text });
  }
  private toArray<T>(d: unknown): T[] {
    if (Array.isArray(d)) return d as T[];
    const inner = (d as { data?: unknown } | null)?.data;
    return Array.isArray(inner) ? (inner as T[]) : [];
  }

  /**
   * بيحوّل رد الـ Lookups (سواء array مباشرة أو ApiResponse أو paged) لـ {id, name}.
   * لو أسماء الحقول في الـ API عندك مختلفة، ضيفيها في القوائم تحت.
   */
  private toOptions(res: unknown): LookupOption[] {
    let list = this.toArray<any>(res);
    if (!list.length) list = this.toArray<any>((res as { data?: unknown } | null)?.data);
    return list
      .map(x => ({
        id: Number(x?.id ?? x?.governorateId ?? x?.subjectId ?? x?.value),
        name: String(x?.name ?? x?.nameAr ?? x?.arabicName ?? x?.governorateName ?? x?.subjectName ?? x?.title ?? x?.label ?? ''),
      }))
      .filter(o => Number.isFinite(o.id) && o.id > 0 && o.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }

  private errText(e: any): string {
    return e?.error?.message || e?.error?.errors?.[0] || e?.message || 'حصل خطأ في الاتصال';
  }
}