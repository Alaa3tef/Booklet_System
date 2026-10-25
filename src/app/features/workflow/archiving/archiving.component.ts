import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

// adjust this path to where your layout component lives
import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';

// ---------------------------------------------------------------- types
export type ArchiveStatus = 'جاهز للتخزين' | 'تم التخزين' | 'تم التسليم';
type ScanType = 'shelf' | 'box' | 'zone' | 'committee';
type FilterKey = 'governorate' | 'subject' | 'committee';

export interface ArchiveRow {
  index: number;
  governorate: string;
  committeeNumber: string;
  subject: string;
  scanPart: string;
  storage: { shelf: string; box: string } | null;
  status: ArchiveStatus;
}

interface ScanStep {
  type: ScanType;
  title: string;
  subtitle: string;
  scanned: boolean;
  data?: { scanType: string; qrCode: string; name: string; extra: string };
}

interface Option { label: string; value: string; }

@Component({
  selector: 'app-archiving',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, DialogModule, InputTextModule, SelectModule, TooltipModule,
     WorkflowStepLayoutComponent
  ],
  templateUrl: './archiving.component.html',
  styleUrl: './archiving.component.scss'
})
export default class ArchivingComponent {

  private readonly toast = inject(MessageService);

  // keep the value you already pass to the layout
  readonly essentials = [
    'مسح الرف والصندوق',
    'تحديد منطقة التخزين',
    'تسجيل التسليم إلكترونيًا'
  ];

  // ================================================================
  // DATA   (replace the sample data with your API call)
  // ================================================================
  readonly rows = signal<ArchiveRow[]>(this.sampleRows());

  // GET your endpoint here, then: this.rows.set(response.data.map(...))
  private sampleRows(): ArchiveRow[] {
    const base: Omit<ArchiveRow, 'index'>[] = [
      { governorate: 'الدقهلية',   committeeNumber: '101', subject: 'اللغة العربية',        scanPart: 'الجزء الأول',  status: 'تم التخزين',   storage: { shelf: 'A-01', box: 'BOX-001' } },
      { governorate: 'الدقهلية',   committeeNumber: '102', subject: 'اللغة الإنجليزية',     scanPart: 'الجزء الأول',  status: 'جاهز للتخزين', storage: null },
      { governorate: 'القاهرة',    committeeNumber: '203', subject: 'الرياضيات',            scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
      { governorate: 'الجيزة',     committeeNumber: '304', subject: 'العلوم',               scanPart: 'الجزء الأول',  status: 'تم التسليم',   storage: { shelf: 'C-03', box: 'BOX-004' } },
      { governorate: 'الإسكندرية', committeeNumber: '405', subject: 'الدراسات الاجتماعية',  scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
      { governorate: 'القاهرة',    committeeNumber: '206', subject: 'اللغة العربية',        scanPart: 'الجزء الأول',  status: 'تم التخزين',   storage: { shelf: 'B-02', box: 'BOX-011' } },
      { governorate: 'الجيزة',     committeeNumber: '307', subject: 'الرياضيات',            scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
      { governorate: 'الدقهلية',   committeeNumber: '108', subject: 'العلوم',               scanPart: 'الجزء الأول',  status: 'تم التسليم',   storage: { shelf: 'A-04', box: 'BOX-020' } },
      { governorate: 'الإسكندرية', committeeNumber: '409', subject: 'اللغة الإنجليزية',     scanPart: 'الجزء الثاني', status: 'تم التخزين',   storage: { shelf: 'D-01', box: 'BOX-031' } },
      { governorate: 'القاهرة',    committeeNumber: '210', subject: 'الدراسات الاجتماعية',  scanPart: 'الجزء الأول',  status: 'جاهز للتخزين', storage: null },
      { governorate: 'الجيزة',     committeeNumber: '311', subject: 'اللغة العربية',        scanPart: 'الجزء الأول',  status: 'جاهز للتخزين', storage: null },
      { governorate: 'الدقهلية',   committeeNumber: '112', subject: 'الرياضيات',            scanPart: 'الجزء الثاني', status: 'تم التخزين',   storage: { shelf: 'A-02', box: 'BOX-044' } }
    ];
    return base.map((r, i) => ({ ...r, index: i + 1 }));
  }

  // ================================================================
  // FILTERS  (same three filters as before)
  // ================================================================
  readonly governorates: Option[] = ['الدقهلية', 'القاهرة', 'الجيزة', 'الإسكندرية']
    .map(v => ({ label: v, value: v }));

  readonly subjects: Option[] = [
    'اللغة العربية', 'اللغة الإنجليزية', 'الرياضيات', 'العلوم', 'الدراسات الاجتماعية'
  ].map(v => ({ label: v, value: v }));

  readonly searchGovernorate = signal<string | null>(null);
  readonly searchSubject     = signal<string | null>(null);
  readonly searchCommittee   = signal('');

  setGovernorate(v: string | null): void { this.searchGovernorate.set(v); this.resetPage(); }
  setSubject(v: string | null): void     { this.searchSubject.set(v);     this.resetPage(); }
  setCommittee(v: string): void          { this.searchCommittee.set(v ?? ''); this.resetPage(); }

  readonly filteredRows = computed(() => {
    const gov = this.searchGovernorate();
    const sub = this.searchSubject();
    const com = this.searchCommittee().trim();

    return this.rows().filter(r =>
      (!gov || r.governorate === gov) &&
      (!sub || r.subject === sub) &&
      (!com || r.committeeNumber.includes(com))
    );
  });

  /** what the "filters applied" bar shows */
  readonly activeFilters = computed(() => {
    const list: { key: FilterKey; title: string; value: string }[] = [];
    if (this.searchGovernorate()) list.push({ key: 'governorate', title: 'المحافظة',   value: this.searchGovernorate()! });
    if (this.searchSubject())     list.push({ key: 'subject',     title: 'المادة',      value: this.searchSubject()! });
    if (this.searchCommittee().trim()) list.push({ key: 'committee', title: 'رقم اللجنة', value: this.searchCommittee().trim() });
    return list;
  });

  removeFilter(key: FilterKey): void {
    if (key === 'governorate') this.searchGovernorate.set(null);
    if (key === 'subject')     this.searchSubject.set(null);
    if (key === 'committee')   this.searchCommittee.set('');
    this.resetPage();
  }

  clearFilters(): void {
    this.searchGovernorate.set(null);
    this.searchSubject.set(null);
    this.searchCommittee.set('');
    this.resetPage();
  }

  // ================================================================
  // PAGINATION  (works on the filtered rows)
  // ================================================================
  readonly pageSize    = signal(4);
  readonly currentPage = signal(1);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize())));

  readonly paginatedRows = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  readonly paginationStart = computed(() =>
    this.filteredRows().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1);

  readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredRows().length));

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages(), cur = this.currentPage();
    const pages: (number | 'dots')[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cur > 3) pages.push('dots');
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
      if (cur < total - 2) pages.push('dots');
      pages.push(total);
    }
    return pages;
  });

  private resetPage(): void { this.currentPage.set(1); }

  onPageSizeChange(): void { this.resetPage(); }
  goToPage(p: number): void { if (p >= 1 && p <= this.totalPages()) this.currentPage.set(p); }
  previousPage(): void { this.goToPage(this.currentPage() - 1); }
  nextPage(): void     { this.goToPage(this.currentPage() + 1); }

  // ================================================================
  // CARD HELPERS
  // ================================================================
  readonly stages: ArchiveStatus[] = ['جاهز للتخزين', 'تم التخزين', 'تم التسليم'];

  stepIndex(status: ArchiveStatus): number {
    return Math.max(0, this.stages.indexOf(status));
  }

  statusClass(status: ArchiveStatus): string {
    return ({ 'جاهز للتخزين': 'st-ready', 'تم التخزين': 'st-stored', 'تم التسليم': 'st-delivered' })[status] ?? '';
  }

  partClass(part: string): string {
    return part.includes('الأول') ? 'part-1' : 'part-2';
  }

  // ================================================================
  // SCAN DIALOG
  // ================================================================
  dialogVisible = signal(false);
  selectedRow   = signal<ArchiveRow | null>(null);
  mode          = signal<'storage' | 'delivery'>('storage');
  steps         = signal<ScanStep[]>([]);
  currentIndex  = signal(0);
  isScanning    = signal(false);
  scanMessage   = signal('');

  readonly zones: Option[] = ['A', 'B', 'C', 'D'].map(z => ({ label: `المنطقة ${z}`, value: z }));
  selectedZone = 'A';

  readonly isStorage = computed(() => this.mode() === 'storage');
  readonly currentStep = computed(() => this.steps()[this.currentIndex()] ?? null);
  readonly completedScans = computed(() => this.steps().filter(s => s.scanned).length);
  readonly allScansCompleted = computed(() =>
    this.steps().length > 0 && this.completedScans() === this.steps().length);
  readonly scanProgress = computed(() =>
    this.steps().length ? Math.round((this.completedScans() / this.steps().length) * 100) : 0);

  openStorageDialog(row: ArchiveRow): void {
    this.openDialog(row, 'storage', [
      { type: 'shelf', title: 'مسح الرف',   subtitle: 'QR الخاص بالرف', scanned: false },
      { type: 'box',   title: 'مسح الصندوق', subtitle: 'QR الخاص بالصندوق', scanned: false },
      { type: 'zone',  title: 'تحديد المنطقة', subtitle: 'اختيار منطقة التخزين', scanned: false }
    ]);
  }

  openDeliveryDialog(row: ArchiveRow): void {
    this.openDialog(row, 'delivery', [
      { type: 'committee', title: 'مسح اللجنة',   subtitle: 'QR الخاص باللجنة', scanned: false },
      { type: 'box',       title: 'مسح الصندوق', subtitle: 'QR الخاص بالصندوق', scanned: false }
    ]);
  }

  private openDialog(row: ArchiveRow, mode: 'storage' | 'delivery', steps: ScanStep[]): void {
    this.selectedRow.set(row);
    this.mode.set(mode);
    this.steps.set(steps);
    this.currentIndex.set(0);
    this.scanMessage.set('');
    this.isScanning.set(false);
    this.dialogVisible.set(true);
  }

  isLocked(i: number): boolean {
    return i > 0 && !this.steps()[i - 1]?.scanned;
  }

  selectScanStep(i: number): void {
    if (this.isScanning() || this.isLocked(i)) return;
    this.currentIndex.set(i);
    this.scanMessage.set('');
  }

  stepIcon(type: ScanType): string {
    return ({ shelf: 'pi-th-large', box: 'pi-box', zone: 'pi-map-marker', committee: 'pi-users' })[type];
  }

  startScan(): void {
    const step = this.currentStep();
    const row = this.selectedRow();
    if (!step || !row || step.scanned || this.isScanning()) return;

    this.isScanning.set(true);
    this.scanMessage.set('');

    // replace the timeout with the real scanner / API call
    setTimeout(() => {
      this.steps.update(list => list.map((s, i) =>
        i === this.currentIndex() ? { ...s, scanned: true, data: this.buildScanData(s.type, row) } : s));
      this.isScanning.set(false);
      this.scanMessage.set('تم تنفيذ الخطوة بنجاح');
    }, step.type === 'zone' ? 300 : 1200);
  }

  private buildScanData(type: ScanType, row: ArchiveRow): ScanStep['data'] {
    switch (type) {
      case 'shelf':     return { scanType: 'مسح الرف',    qrCode: 'QR-SHELF-A-01',  name: 'رف A-01',  extra: `لجنة ${row.committeeNumber}` };
      case 'box':       return { scanType: 'مسح الصندوق', qrCode: 'QR-BOX-001',     name: 'BOX-001',  extra: row.subject };
      case 'zone':      return { scanType: 'تحديد المنطقة', qrCode: '—',            name: `المنطقة ${this.selectedZone}`, extra: row.governorate };
      case 'committee': return { scanType: 'مسح اللجنة',  qrCode: `QR-COMMITTEE-${row.committeeNumber}`, name: `لجنة ${row.committeeNumber}`, extra: row.governorate };
    }
  }

  previousScan(): void { if (this.currentIndex() > 0) this.currentIndex.update(i => i - 1); }
  nextScan(): void {
    if (this.currentStep()?.scanned && this.currentIndex() < this.steps().length - 1) {
      this.currentIndex.update(i => i + 1);
    }
  }

  confirm(): void {
    const row = this.selectedRow();
    if (!row || !this.allScansCompleted()) return;

    const shelf = this.steps().find(s => s.type === 'shelf')?.data?.name.replace('رف ', '') ?? 'A-01';
    const box   = this.steps().find(s => s.type === 'box')?.data?.name ?? 'BOX-001';

    // call your API here, then reload the rows instead of editing them locally
    this.rows.update(list => list.map(r =>
      r.index !== row.index ? r
        : this.isStorage()
          ? { ...r, status: 'تم التخزين' as ArchiveStatus, storage: { shelf, box } }
          : { ...r, status: 'تم التسليم' as ArchiveStatus }));

    this.toast.add({
      severity: 'success', summary: 'تمت العملية', life: 3500,
      detail: this.isStorage() ? 'تم تأكيد التخزين بنجاح' : 'تم تأكيد التسليم بنجاح'
    });
    this.closeDialog();
  }

  closeDialog(): void { this.dialogVisible.set(false); }

  onDialogHide(): void {
    this.selectedRow.set(null);
    this.steps.set([]);
    this.currentIndex.set(0);
    this.isScanning.set(false);
    this.scanMessage.set('');
  }
}