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
import { forkJoin } from 'rxjs';
import { Lookups } from '../../../shared/services/lookups';

// ---------------------------------------------------------------- types
export type ArchiveStatus = 'جاهز للتخزين' | 'تم التخزين' | 'تم التسليم';
type ScanType = 'shelf' | 'box' | 'zone' | 'committee';
type FilterKey = 'governorate' | 'subject' | 'committee' | 'education';

export interface ArchiveRow {
  index: number;
  governorate: string;
  committeeNumber: string;
  educationNumber: string;
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
   private lookupService = inject(Lookups);
  private messageService = inject(MessageService);


  
  ngOnInit(): void {
    this.loadLookups();
  }
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
      { governorate: 'الدقهلية',   committeeNumber: '101', subject: 'اللغة العربية',   educationNumber: 'EDU-001',      scanPart: 'الجزء الأول',  status: 'تم التخزين',   storage: { shelf: 'A-01', box: 'BOX-001' } },
      { governorate: 'الدقهلية',   committeeNumber: '102', subject: 'اللغة الإنجليزية',  educationNumber: 'EDU-001',    scanPart: 'الجزء الأول',  status: 'جاهز للتخزين', storage: null },
      { governorate: 'القاهرة',    committeeNumber: '203', subject: 'الرياضيات',            educationNumber: 'EDU-002',    scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
      { governorate: 'الجيزة',     committeeNumber: '304', subject: 'العلوم',               educationNumber: 'EDU-003',    scanPart: 'الجزء الأول',  status: 'تم التسليم',   storage: { shelf: 'C-03', box: 'BOX-004' } },
      { governorate: 'الإسكندرية', committeeNumber: '405', subject: 'الدراسات الاجتماعية',  educationNumber: 'EDU-004',    scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
      { governorate: 'القاهرة',    committeeNumber: '206', subject: 'اللغة العربية',        educationNumber: 'EDU-005',    scanPart: 'الجزء الأول',  status: 'تم التخزين',   storage: { shelf: 'B-02', box: 'BOX-011' } },
      { governorate: 'الجيزة',     committeeNumber: '307', subject: 'الرياضيات',            educationNumber: 'EDU-006',    scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
      { governorate: 'الدقهلية',   committeeNumber: '108', subject: 'العلوم',               educationNumber: 'EDU-007',    scanPart: 'الجزء الأول',  status: 'تم التسليم',   storage: { shelf: 'A-04', box: 'BOX-020' } },
      { governorate: 'الإسكندرية', committeeNumber: '409', subject: 'اللغة الإنجليزية',     educationNumber: 'EDU-008',    scanPart: 'الجزء الثاني', status: 'تم التخزين',   storage: { shelf: 'D-01', box: 'BOX-031' } },
      { governorate: 'القاهرة',    committeeNumber: '210', subject: 'الدراسات الاجتماعية',  educationNumber: 'EDU-009',    scanPart: 'الجزء الأول',  status: 'جاهز للتخزين', storage: null },
      { governorate: 'الجيزة',     committeeNumber: '311', subject: 'اللغة العربية',        educationNumber: 'EDU-010',    scanPart: 'الجزء الأول',  status: 'جاهز للتخزين', storage: null },
      { governorate: 'الدقهلية',   committeeNumber: '112', subject: 'الرياضيات',            educationNumber: 'EDU-011',    scanPart: 'الجزء الثاني', status: 'تم التخزين',   storage: { shelf: 'A-02', box: 'BOX-044' } },
      { governorate: 'الإسكندرية', committeeNumber: '405', subject: 'الدراسات الاجتماعية',  educationNumber: 'EDU-004',    scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
      { governorate: 'الجيزة',     committeeNumber: '307', subject: 'الرياضيات',            educationNumber: 'EDU-006',    scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
      { governorate: 'القاهرة',    committeeNumber: '210', subject: 'الدراسات الاجتماعية',  educationNumber: 'EDU-009',    scanPart: 'الجزء الأول',  status: 'جاهز للتخزين', storage: null },
      { governorate: 'الجيزة',     committeeNumber: '311', subject: 'اللغة العربية',        educationNumber: 'EDU-010',    scanPart: 'الجزء الأول',  status: 'جاهز للتخزين', storage: null },
      { governorate: 'الدقهلية',   committeeNumber: '112', subject: 'الرياضيات',            educationNumber: 'EDU-011',    scanPart: 'الجزء الثاني', status: 'تم التخزين',   storage: { shelf: 'A-02', box: 'BOX-044' } },
      { governorate: 'الإسكندرية', committeeNumber: '405', subject: 'الدراسات الاجتماعية',  educationNumber: 'EDU-004',    scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
      { governorate: 'الجيزة',     committeeNumber: '307', subject: 'الرياضيات',            educationNumber: 'EDU-006',    scanPart: 'الجزء الثاني', status: 'جاهز للتخزين', storage: null },
    ];
          return base.map((r, i) => ({ ...r, index: i + 1 }));
  }

  // ================================================================
  // FILTERS  (same three filters as before)
  // ================================================================
 
  governorates: Option[] = [];
  subjects: Option[] = [];
  educationals: Option[] = [
    { label: 'كل الادارات التعليمية', value: 'all' },
    { label: 'EDU-001', value: 'EDU-001' },
    { label: 'EDU-002', value: 'EDU-002' },
    { label: 'EDU-003', value: 'EDU-003' },
    { label: 'EDU-004', value: 'EDU-004' },
    { label: 'EDU-005', value: 'EDU-005' },
    { label: 'EDU-006', value: 'EDU-006' },
    { label: 'EDU-007', value: 'EDU-007' },
    { label: 'EDU-008', value: 'EDU-008' },
    { label: 'EDU-009', value: 'EDU-009' },
    { label: 'EDU-010', value: 'EDU-010' },
    { label: 'EDU-011', value: 'EDU-011' }
  ];

  readonly searchGovernorate = signal<string | null>(null);
  readonly searchSubject     = signal<string | null>(null);
   readonly searchCommittee   = signal('');
  readonly searchEducation   = signal('');


  setGovernorate(v: string | null): void { this.searchGovernorate.set(v); this.resetPage(); }
  setSubject(v: string | null): void     { this.searchSubject.set(v);     this.resetPage(); }
  setCommittee(v: string): void          { this.searchCommittee.set(v ?? ''); this.resetPage(); }
  setEducation(v: string): void          { this.searchEducation.set(v ?? ''); this.resetPage(); }

  readonly filteredRows = computed(() => {
    const gov = this.searchGovernorate();
    const sub = this.searchSubject();
    const edu = this.searchEducation().trim();

    return this.rows().filter(r =>
      (!gov || r.governorate === gov) &&
      (!sub || r.subject === sub) &&
      (!edu || r.educationNumber.includes(edu))
    );
  });

  /** what the "filters applied" bar shows */
  readonly activeFilters = computed(() => {
    const list: { key: FilterKey; title: string; value: string }[] = [];
    if (this.searchGovernorate()) list.push({ key: 'governorate', title: 'المحافظة',   value: this.searchGovernorate()! });
    if (this.searchSubject())     list.push({ key: 'subject',     title: 'المادة',      value: this.searchSubject()! });
    if (this.searchEducation().trim()) list.push({ key: 'education', title: 'الادارة التعليمية', value: this.searchEducation().trim() });
    return list;
  });

  removeFilter(key: FilterKey): void {
    if (key === 'governorate') this.searchGovernorate.set(null);
    if (key === 'subject')     this.searchSubject.set(null);
    if (key === 'education')   this.searchEducation.set('');
    this.resetPage();
  }

  clearFilters(): void {
    this.searchGovernorate.set(null);
    this.searchSubject.set(null);
    this.searchEducation.set('');
    this.resetPage();
  }
 loadLookups(): void {
  forkJoin({
    governorates: this.lookupService.getLookupGovernorateData(),
    subjects: this.lookupService.getLookupSubjectData()
  }).subscribe({
    next: (res: any) => {
      // Governorates
      const governoratesData = res.governorates?.data?.data ?? [];

      this.governorates = [
        { label: 'كل المحافظات', value: 'all' },
        ...governoratesData.map((item: any) => ({
          label: item.nameAr ?? item.name,
          value: item.id
        }))
      ];

      // Subjects
      const subjectsData = res.subjects?.data?.data ?? [];

      this.subjects = [
        { label: 'كل المواد', value: 'all' },
        ...subjectsData.map((item: any) => ({
          label: item.name,
          value: item.id
        }))
      ];

      console.log('Governorates:', this.governorates);
      console.log('Subjects:', this.subjects);
    },
    error: (err) => {
      console.error('Error loading lookups:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'خطأ',
        detail: err.error?.message || 'فشل تحميل بيانات القوائم',
        life: 3000
      });
    }
  });
}
 
  // ================================================================
  // PAGINATION  (works on the filtered rows)
  // ================================================================
  readonly pageSize    = signal(6);   // 6 = 2 rows x 3 cards, 0 = show all
 
  readonly pageSizeOptions = [
    { label: '6',    value: 6 },
    { label: '12',   value: 12 },
    { label: '24',   value: 24 },
    { label: 'الكل', value: 0 }
  ];
  readonly currentPage = signal(1);
 
  readonly showAll = computed(() => this.pageSize() === 0);      // 0 = "الكل"
 
  readonly totalPages = computed(() =>
    this.showAll() ? 1 : Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize())));
 
  readonly paginatedRows = computed(() => {
    if (this.showAll()) return this.filteredRows();
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });
 
  readonly paginationStart = computed(() => {
    if (this.filteredRows().length === 0) return 0;
    return this.showAll() ? 1 : (this.currentPage() - 1) * this.pageSize() + 1;
  });
 
  readonly paginationEnd = computed(() =>
    this.showAll()
      ? this.filteredRows().length
      : Math.min(this.currentPage() * this.pageSize(), this.filteredRows().length));
 
  /**
   * Page numbers with dots (dots appear as soon as there are more than 3 pages
   * and at least one page is hidden):
   *   5 pages -> 1 2 ... 5  |  1 2 3 ... 5  |  1 2 3 4 5  |  1 ... 3 4 5  |  1 ... 4 5
   *   9 pages -> 1 2 ... 9  |  1 2 3 ... 9  |  1 ... 4 5 6 ... 9  |  1 ... 7 8 9
   */
  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const cur = Math.min(this.currentPage(), total);
 
    // first page + last page + the page before/after the current one
    const wanted = new Set<number>([1, total, cur - 1, cur, cur + 1]);
    const sorted = [...wanted].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
 
    const pages: (number | 'dots')[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) pages.push('dots');   // hidden pages in between
      pages.push(p);
    });
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

    this.messageService.add({
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