import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { MessageService } from 'primeng/api';
import { Lookups } from '../../../shared/services/lookups';
import { forkJoin } from 'rxjs';

// =========================================================
// TYPES
// =========================================================

interface ArchiveRow {
  index: number;
  governorate: string;
  subject: string;
  committeeNumber: string;
  scanPart: string;
  location: string;

  status: 'جاهز للتخزين' | 'تم التخزين' | 'تم التسليم';
  statusTone: 'warning' | 'success' | 'info';

  storage?: {
    zone: string;
    shelf: string;
    box: string;
  };

  delivered?: boolean;
}

interface SelectOption {
  label: string;
  value: string;
}

type DialogMode = 'storage' | 'delivery';
type StepType = 'shelf' | 'zone' | 'box' | 'committee';

interface ScanStepData {
  scanType: string;
  qrCode: string;
  name: string;
  extra: string;
}

interface ScanStep {
  type: StepType;
  title: string;
  subtitle: string;
  scanned: boolean;
  data?: ScanStepData;
}

// =========================================================
// COMPONENT
// =========================================================

@Component({
  selector: 'app-archiving',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    ButtonModule,
    TagModule,
    WorkflowStepLayoutComponent
  ],

  templateUrl: './archiving.component.html',
  styleUrl: './archiving.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush
})
export default class ArchivingComponent {
 private lookupService = inject(Lookups);
  private messageService = inject(MessageService);

  // ==========================================
// PAGINATION
// ==========================================

readonly pageSize = signal(5);

readonly currentPage = signal(1);

readonly totalPages = computed(() => {
  return Math.max(
    1,
    Math.ceil(
      this.rows().length / this.pageSize()
    )
  );
});

readonly paginatedRows = computed(() => {

  const page = this.currentPage();
  const size = this.pageSize();

  const start = (page - 1) * size;
  const end = start + size;

  return this.rows().slice(start, end);
});

readonly paginationPages = computed(() => {

  const total = this.totalPages();
  const current = this.currentPage();

  // 4 صفحات أو أقل
  if (total <= 4) {
    return Array.from(
      { length: total },
      (_, index) => index + 1
    );
  }

  // أول الصفحات
  if (current <= 2) {
    return [1, 2, 3, 'dots', total];
  }

  // آخر الصفحات
  if (current >= total - 1) {
    return [
      1,
      'dots',
      total - 2,
      total - 1,
      total
    ];
  }

  // الصفحات الوسط
  return [
    1,
    'dots',
    current,
    'dots',
    total
  ];
});

readonly paginationStart = computed(() => {

  if (this.rows().length === 0) {
    return 0;
  }

  return (
    (this.currentPage() - 1) *
      this.pageSize() +
    1
  );
});

readonly paginationEnd = computed(() => {

  return Math.min(
    this.currentPage() * this.pageSize(),
    this.rows().length
  );
});


goToPage(page: number): void {

  if (
    page < 1 ||
    page > this.totalPages() ||
    page === this.currentPage()
  ) {
    return;
  }

  this.currentPage.set(page);
}


previousPage(): void {
  this.goToPage(this.currentPage() - 1);
}


nextPage(): void {
  this.goToPage(this.currentPage() + 1);
}


onPageSizeChange(): void {
  this.currentPage.set(1);
}
  // =========================================================
  // SEARCH (signals)
  // =========================================================

  readonly searchGovernorate = signal('');
  readonly searchCommittee = signal('');
  readonly searchSubject = signal('');

  governorates: SelectOption[] = [];
  subjects: SelectOption[] = [];

  ngOnInit(): void {
    this.loadLookups();
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

  // =========================================================
  // MOCK DATA
  // =========================================================

  readonly rows = signal<ArchiveRow[]>([
    {
      index: 1,
      governorate: 'الدقهلية',
      subject: 'اللغة العربية',
      committeeNumber: '101',
      scanPart: 'الجزء الأول',
      location: 'A-01-01',
      status: 'تم التخزين',
      statusTone: 'success',
      storage: {
        zone: 'المخزن الرئيسي',
        shelf: 'A-01',
        box: 'BOX-001'
      }
    },
    {
      index: 2,
      governorate: 'الدقهلية',
      subject: 'اللغة الإنجليزية',
      committeeNumber: '102',
      scanPart: 'الجزء الأول',
      location: 'A-01-02',
      status: 'جاهز للتخزين',
      statusTone: 'warning'
    },
    {
      index: 3,
      governorate: 'القاهرة',
      subject: 'الرياضيات',
      committeeNumber: '203',
      scanPart: 'الجزء الثاني',
      location: 'B-02-03',
      status: 'جاهز للتخزين',
      statusTone: 'warning'
    },
    {
      index: 4,
      governorate: 'الجيزة',
      subject: 'العلوم',
      committeeNumber: '304',
      scanPart: 'الجزء الأول',
      location: 'C-03-01',
      status: 'تم التسليم',
      statusTone: 'info',
      storage: {
        zone: 'المخزن الرئيسي',
        shelf: 'C-03',
        box: 'BOX-004'
      },
      delivered: true
    },
    {
      index: 5,
      governorate: 'الإسكندرية',
      subject: 'الدراسات الاجتماعية',
      committeeNumber: '405',
      scanPart: 'الجزء الثاني',
      location: 'D-04-02',
      status: 'جاهز للتخزين',
      statusTone: 'warning'
    }
  ]);

  // =========================================================
  // FILTERED DATA
  // =========================================================

  readonly filteredRows = computed(() => {
    const governorate = this.searchGovernorate();
    const committee = this.searchCommittee().trim().toLowerCase();
    const subject = this.searchSubject();

    return this.rows().filter(row =>
      (!governorate || row.governorate === governorate) &&
      (!committee || row.committeeNumber.toLowerCase().includes(committee)) &&
      (!subject || row.subject === subject)
    );
  });

  // =========================================================
  // DIALOG STATE
  // =========================================================

  readonly dialogVisible = signal(false);
  readonly dialogMode = signal<DialogMode>('storage');
  readonly selectedRow = signal<ArchiveRow | null>(null);

  readonly steps = signal<ScanStep[]>([]);
  readonly currentIndex = signal(0);
  readonly isScanning = signal(false);
  readonly scanMessage = signal('');
  readonly selectedZone = signal('main');

  readonly zones: SelectOption[] = [
    { label: 'المخزن الرئيسي', value: 'main' },
    { label: 'المخزن الفرعي', value: 'secondary' }
  ];

  readonly isStorage = computed(() => this.dialogMode() === 'storage');

  readonly currentStep = computed(() => this.steps()[this.currentIndex()]);

  readonly completedScans = computed(
    () => this.steps().filter(s => s.scanned).length
  );

  readonly allScansCompleted = computed(
    () =>
      this.steps().length > 0 &&
      this.completedScans() === this.steps().length
  );

  readonly scanProgress = computed(() => {
    const total = this.steps().length;
    return total
      ? Math.round((this.completedScans() / total) * 100)
      : 0;
  });

  readonly zoneLabel = computed(
    () => this.zones.find(z => z.value === this.selectedZone())?.label ?? ''
  );

  // =========================================================
  // UI
  // =========================================================

  readonly essentials = [
    'البحث عن المادة أو اللجنة',
    'Scan الرف والصندوق',
    'تحديد مكان التخزين',
    'تأكيد التخزين',
    'Scan اللجنة عند التسليم'
  ];

  // =========================================================
  // OPEN / CLOSE
  // =========================================================

  openStorageDialog(row: ArchiveRow): void {
    this.openDialog(row, 'storage');
  }

  openDeliveryDialog(row: ArchiveRow): void {
    if (row.status !== 'تم التخزين') {
      return;
    }

    this.openDialog(row, 'delivery');
  }

  private openDialog(row: ArchiveRow, mode: DialogMode): void {
    this.selectedRow.set(row);
    this.dialogMode.set(mode);
    this.steps.set(this.buildSteps(mode));
    this.currentIndex.set(0);
    this.isScanning.set(false);
    this.scanMessage.set('');
    this.selectedZone.set('main');
    this.dialogVisible.set(true);
  }

  private buildSteps(mode: DialogMode): ScanStep[] {
    return mode === 'storage'
      ? [
          {
            type: 'shelf',
            title: 'Scan الرف',
            subtitle: 'مسح QR الخاص بالرف',
            scanned: false
          },
          // {
          //   type: 'zone',
          //   title: 'تحديد المنطقة',
          //   subtitle: 'اختيار منطقة التخزين',
          //   scanned: false
          // },
          {
            type: 'box',
            title: 'Scan الصندوق',
            subtitle: 'مسح QR الخاص بالصندوق',
            scanned: false
          }
        ]
      : [
          // {
          //   type: 'committee',
          //   title: 'Scan اللجنة',
          //   subtitle: 'مسح QR الخاص باللجنة',
          //   scanned: false
          // },
          {
            type: 'box',
            title: 'Scan الصندوق',
            subtitle: 'التأكد من مطابقة الصندوق',
            scanned: false
          }
        ];
  }

  closeDialog(): void {
    if (this.isScanning()) {
      return;
    }

    this.dialogVisible.set(false);
  }

  onDialogHide(): void {
    this.selectedRow.set(null);
    this.steps.set([]);
    this.scanMessage.set('');
  }

  // =========================================================
  // STEPS
  // =========================================================

  isLocked(index: number): boolean {
    const pending = this.steps().findIndex(s => !s.scanned);
    return pending !== -1 && index > pending;
  }

  selectScanStep(index: number): void {
    if (this.isScanning() || this.isLocked(index)) {
      return;
    }

    this.currentIndex.set(index);
  }

  previousScan(): void {
    if (this.currentIndex() === 0 || this.isScanning()) {
      return;
    }

    this.currentIndex.update(i => i - 1);
  }

  nextScan(): void {
    if (!this.currentStep()?.scanned) {
      return;
    }

    if (this.currentIndex() >= this.steps().length - 1) {
      return;
    }

    this.currentIndex.update(i => i + 1);
  }

  stepIcon(type: StepType): string {
    return {
      shelf: 'pi-bars',
      zone: 'pi-map-marker',
      box: 'pi-box',
      committee: 'pi-users'
    }[type];
  }

  // =========================================================
  // SCAN
  // =========================================================

  startScan(): void {
    const step = this.currentStep();

    if (!step || step.scanned || this.isScanning()) {
      return;
    }

    if (step.type === 'zone') {
      this.finishStep(
        'zone',
        {
          scanType: 'Storage Zone',
          qrCode: this.selectedZone(),
          name: this.zoneLabel(),
          extra: 'منطقة التخزين'
        },
        'تم تحديد منطقة التخزين. يمكنك الآن مسح الصندوق.'
      );
      return;
    }

    this.isScanning.set(true);
    this.scanMessage.set('');

    setTimeout(() => {
      this.completeScan(step.type);
      this.isScanning.set(false);
    }, 900);
  }

  private completeScan(type: StepType): void {
    const row = this.selectedRow();

    if (!row) {
      return;
    }

    switch (type) {
      case 'shelf':
        this.finishStep(
          'shelf',
          {
            scanType: 'Shelf QR',
            qrCode: 'SHELF-A01',
            name: 'رف A-01',
            extra: 'السعة: 24 صندوق'
          },
          'تمت قراءة QR الرف بنجاح. حدّدي الآن منطقة التخزين.'
        );
        break;

      case 'committee':
        this.finishStep(
          'committee',
          {
            scanType: 'Committee QR',
            qrCode: `COM-${row.committeeNumber}`,
            name: `اللجنة ${row.committeeNumber}`,
            extra: `${row.subject} · ${row.governorate}`
          },
          'تمت قراءة QR اللجنة بنجاح. امسحي الصندوق للتأكد من المطابقة.'
        );
        break;

      case 'box':
        this.finishStep(
          'box',
          this.isStorage()
            ? {
                scanType: 'Box QR',
                qrCode: `BOX-${row.committeeNumber}`,
                name: 'صندوق أرشيف',
                extra: 'الحالة: ممتلئ'
              }
            : {
                scanType: 'Box QR',
                qrCode: row.storage?.box ?? 'غير محدد',
                name: 'صندوق أرشيف',
                extra: `الرف: ${row.storage?.shelf ?? '—'}`
              },
          this.isStorage()
            ? 'تمت قراءة QR الصندوق بنجاح. فحص التخزين مكتمل.'
            : 'تمت مطابقة الصندوق بنجاح. فحص التسليم مكتمل.'
        );
        break;
    }
  }

  private finishStep(
    type: StepType,
    data: ScanStepData,
    message: string
  ): void {
    this.steps.update(steps =>
      steps.map(s => (s.type === type ? { ...s, scanned: true, data } : s))
    );

    this.scanMessage.set(message);

    const next = this.steps().findIndex(s => !s.scanned);

    if (next !== -1) {
      this.currentIndex.set(next);
    }
  }

  private stepData(type: StepType): ScanStepData | undefined {
    return this.steps().find(s => s.type === type)?.data;
  }

  // =========================================================
  // CONFIRM
  // =========================================================

  confirm(): void {
    const row = this.selectedRow();

    if (!row || !this.allScansCompleted()) {
      return;
    }

    if (this.isStorage()) {
      const shelf = this.stepData('shelf')?.qrCode ?? '';
      const box = this.stepData('box')?.qrCode ?? '';

      this.rows.update(rows =>
        rows.map((r): ArchiveRow =>
          r.index !== row.index
            ? r
            : {
                ...r,
                status: 'تم التخزين',
                statusTone: 'success',
                location: `${shelf}-${box}`,
                storage: {
                  zone: this.zoneLabel(),
                  shelf,
                  box
                }
              }
        )
      );
    } else {
      this.rows.update(rows =>
        rows.map((r): ArchiveRow =>
          r.index !== row.index
            ? r
            : {
                ...r,
                status: 'تم التسليم',
                statusTone: 'info',
                delivered: true
              }
        )
      );
    }

    this.dialogVisible.set(false);
  }

  // =========================================================
  // HELPERS
  // =========================================================

  clearFilters(): void {
    this.searchGovernorate.set('');
    this.searchCommittee.set('');
    this.searchSubject.set('');
  }

  getStatusSeverity(
    status: ArchiveRow['status']
  ): 'success' | 'warning' | 'info' {
    switch (status) {
      case 'تم التخزين':
        return 'success';

      case 'تم التسليم':
        return 'info';

      default:
        return 'warning';
    }
  }
}