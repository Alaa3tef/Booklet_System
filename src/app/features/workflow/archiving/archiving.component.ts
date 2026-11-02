import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

// Layout & Services
import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { Lookups } from '../../../shared/services/lookups';
import {
  ArchivingBoxService,
  BatchStorageDto,
  StorageRackDto,
  StorageBoxDto,
  StorageLocationResolveDto,
  BoxResolveDto,
  CommitteeBoxItemDto
} from './service/archiving-box.service';

export interface SelectOption {
  label: string;
  value: number | string;
}

export type ArchivingViewTab = 'batches' | 'scanner';

@Component({
  selector: 'app-archiving',
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
  templateUrl: './archiving.component.html',
  styleUrl: './archiving.component.scss'
})
export default class ArchivingComponent implements OnInit {
  private archivingBoxService = inject(ArchivingBoxService);
  private lookupService = inject(Lookups);
  private messageService = inject(MessageService);

  readonly essentials = [
    'مسح باركود الصندوق والرف',
    'تسكين الصناديق في الأرفف والأماكن المحددة',
    'تأكيد تخزين لجان المواد إلكترونيًا'
  ];

  // ================================================================
  // VIEW SWITCH (TABS)
  // ================================================================
  readonly activeTab = signal<ArchivingViewTab>('batches');

  setTab(tab: ArchivingViewTab): void {
    this.activeTab.set(tab);
    if (tab === 'batches' && this.batches().length === 0) {
      this.loadBatches();
    }
  }

  // ================================================================
  // LOOKUPS & SEARCH FILTERS
  // ================================================================
  readonly governorates = signal<SelectOption[]>([]);
  readonly subjects = signal<SelectOption[]>([]);
  readonly lookupsLoading = signal<boolean>(false);

  readonly searchGovernorate = signal<number | string | null>(null);
  readonly searchSubject = signal<number | string | null>(null);
  readonly searchBatchQuery = signal<string>('');

  setGovernorate(v: number | string | null): void {
    this.searchGovernorate.set(v);
    this.resetPage();
    this.loadBatches();
  }

  setSubject(v: number | string | null): void {
    this.searchSubject.set(v);
    this.resetPage();
    this.loadBatches();
  }

  setBatchQuery(q: string): void {
    this.searchBatchQuery.set(q ?? '');
    this.resetPage();
  }

  readonly activeFilters = computed(() => {
    const list: { key: string; title: string; value: string }[] = [];

    const govVal = this.searchGovernorate();
    if (govVal && govVal !== 'all') {
      const match = this.governorates().find(g => g.value === govVal);
      list.push({ key: 'governorate', title: 'المحافظة', value: match?.label || String(govVal) });
    }

    const subVal = this.searchSubject();
    if (subVal && subVal !== 'all') {
      const match = this.subjects().find(s => s.value === subVal);
      list.push({ key: 'subject', title: 'المادة', value: match?.label || String(subVal) });
    }

    const q = this.searchBatchQuery().trim();
    if (q) {
      list.push({ key: 'query', title: 'بحث سريع', value: q });
    }

    return list;
  });

  removeFilter(key: string): void {
    if (key === 'governorate') this.searchGovernorate.set(null);
    if (key === 'subject') this.searchSubject.set(null);
    if (key === 'query') this.searchBatchQuery.set('');
    this.resetPage();
    this.loadBatches();
  }

  clearFilters(): void {
    this.searchGovernorate.set(null);
    this.searchSubject.set(null);
    this.searchBatchQuery.set('');
    this.resetPage();
    this.loadBatches();
  }

  // ================================================================
  // BATCHES DATA & KPIs (GET /api/Boxes/by-governorate-subject)
  // ================================================================
  readonly batches = signal<BatchStorageDto[]>([]);
  readonly batchesLoading = signal<boolean>(false);

  loadBatches(): void {
    this.batchesLoading.set(true);

    const govVal = this.searchGovernorate();
    const govId = govVal && govVal !== 'all' ? Number(govVal) : null;

    const subVal = this.searchSubject();
    const subId = subVal && subVal !== 'all' ? Number(subVal) : null;

    this.archivingBoxService.getBoxesByGovernorateAndSubject(govId, subId).subscribe({
      next: res => {
        const raw = res as any;
        const list: BatchStorageDto[] = Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.data?.data)
          ? raw.data.data
          : Array.isArray(raw)
          ? raw
          : [];
        this.batches.set(list);
        this.batchesLoading.set(false);
      },
      error: err => {
        console.error('Error loading storage batches:', err);
        this.batchesLoading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ',
          detail: err?.error?.message || 'فشل تحميل دفعات التخزين',
          life: 3500
        });
      }
    });
  }

  readonly filteredBatches = computed(() => {
    const query = this.searchBatchQuery().trim().toLowerCase();
    const list = this.batches();

    if (!query) return list;

    return list.filter(b => {
      const matchBatch =
        String(b.batchId).includes(query) ||
        (b.governorateName && b.governorateName.toLowerCase().includes(query)) ||
        (b.subjectName && b.subjectName.toLowerCase().includes(query)) ||
        (b.roundName && b.roundName.toLowerCase().includes(query)) ||
        (b.statusName && b.statusName.toLowerCase().includes(query));

      if (matchBatch) return true;

      // Check racks & boxes inside
      if (b.racks && b.racks.length) {
        return b.racks.some(r => {
          const matchRack =
            (r.warehouseName && r.warehouseName.toLowerCase().includes(query)) ||
            (r.rack && r.rack.toLowerCase().includes(query)) ||
            (r.area && r.area.toLowerCase().includes(query));
          if (matchRack) return true;

          return r.boxes && r.boxes.some(box =>
            String(box.committeeNumber).toLowerCase().includes(query) ||
            (box.qrCode && box.qrCode.toLowerCase().includes(query)) ||
            (box.shelfLocationCode && box.shelfLocationCode.toLowerCase().includes(query)) ||
            (box.statusName && box.statusName.toLowerCase().includes(query))
          );
        });
      }

      return false;
    });
  });

  // KPI Metrics Computed
  readonly totalBatchesCount = computed(() => this.filteredBatches().length);

  readonly totalBoxesCount = computed(() => {
    let count = 0;
    for (const b of this.filteredBatches()) {
      if (b.racks) {
        for (const r of b.racks) {
          count += r.boxes?.length || 0;
        }
      }
    }
    return count;
  });

  readonly storedBoxesCount = computed(() => {
    let count = 0;
    for (const b of this.filteredBatches()) {
      if (b.racks) {
        for (const r of b.racks) {
          if (r.boxes) {
            count += r.boxes.filter(box => box.shelfLocationId > 0 || !!box.shelfLocationCode).length;
          }
        }
      }
    }
    return count;
  });

  readonly pendingBoxesCount = computed(() => {
    return Math.max(0, this.totalBoxesCount() - this.storedBoxesCount());
  });

  readonly readyForDeliveryCount = computed(() => {
    let count = 0;
    for (const b of this.filteredBatches()) {
      if (b.racks) {
        for (const r of b.racks) {
          if (r.boxes) {
            count += r.boxes.filter(box => box.isReadyForDelivery).length;
          }
        }
      }
    }
    return count;
  });

  // Helper getters for a specific batch
  getBatchTotalBoxes(batch: BatchStorageDto): number {
    if (!batch.racks) return 0;
    return batch.racks.reduce((acc, r) => acc + (r.boxes?.length || 0), 0);
  }

  getBatchStoredBoxes(batch: BatchStorageDto): number {
    if (!batch.racks) return 0;
    return batch.racks.reduce((acc, r) => {
      const stored = r.boxes?.filter(box => box.shelfLocationId > 0 || !!box.shelfLocationCode).length || 0;
      return acc + stored;
    }, 0);
  }

  getBatchStoredPercentage(batch: BatchStorageDto): number {
    const total = this.getBatchTotalBoxes(batch);
    if (!total) return 0;
    return Math.round((this.getBatchStoredBoxes(batch) / total) * 100);
  }

  getBatchUniqueWarehouses(batch: BatchStorageDto): string[] {
    if (!batch.racks) return [];
    const set = new Set<string>();
    batch.racks.forEach(r => {
      if (r.warehouseName) set.add(r.warehouseName);
    });
    return Array.from(set);
  }

  // ================================================================
  // PAGINATION (matching Planning component)
  // ================================================================
  readonly pageSize = signal(6);
  readonly currentPage = signal(1);

  readonly pageSizeOptions = [
    { label: '6', value: 6 },
    { label: '12', value: 12 },
    { label: '24', value: 24 },
    { label: 'الكل', value: 0 }
  ];

  readonly showAll = computed(() => this.pageSize() === 0);

  readonly totalPages = computed(() =>
    this.showAll()
      ? 1
      : Math.max(1, Math.ceil(this.filteredBatches().length / this.pageSize()))
  );

  readonly paginatedBatches = computed(() => {
    if (this.showAll()) return this.filteredBatches();
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize();
    return this.filteredBatches().slice(start, start + this.pageSize());
  });

  readonly paginationStart = computed(() => {
    if (this.filteredBatches().length === 0) return 0;
    return this.showAll() ? 1 : (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly paginationEnd = computed(() =>
    this.showAll()
      ? this.filteredBatches().length
      : Math.min(this.currentPage() * this.pageSize(), this.filteredBatches().length)
  );

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const cur = Math.min(this.currentPage(), total);
    const wanted = new Set<number>([1, total, cur - 1, cur, cur + 1]);
    const sorted = [...wanted].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);

    const pages: (number | 'dots')[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) pages.push('dots');
      pages.push(p);
    });
    return pages;
  });

  private resetPage(): void {
    this.currentPage.set(1);
  }

  onPageSizeChange(): void {
    this.resetPage();
  }

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) {
      this.currentPage.set(p);
    }
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  // ================================================================
  // BATCH DETAILS DIALOG
  // ================================================================
  batchDetailsVisible = signal<boolean>(false);
  selectedBatch = signal<BatchStorageDto | null>(null);
  batchModalSearch = signal<string>('');

  openBatchDetails(batch: BatchStorageDto): void {
    this.selectedBatch.set(batch);
    this.batchModalSearch.set('');
    this.batchDetailsVisible.set(true);
  }

  closeBatchDetails(): void {
    this.batchDetailsVisible.set(false);
    this.selectedBatch.set(null);
  }

  readonly allBoxesInSelectedBatch = computed(() => {
    const batch = this.selectedBatch();
    if (!batch || !batch.racks) return [];

    const boxes: (StorageBoxDto & { warehouseName?: string; rackName?: string })[] = [];
    for (const r of batch.racks) {
      if (r.boxes) {
        for (const b of r.boxes) {
          boxes.push({
            ...b,
            warehouseName: r.warehouseName,
            rackName: r.rack
          });
        }
      }
    }
    return boxes;
  });

  readonly filteredBatchBoxes = computed(() => {
    const q = this.batchModalSearch().trim().toLowerCase();
    const list = this.allBoxesInSelectedBatch();
    if (!q) return list;

    return list.filter(b =>
      String(b.committeeNumber).toLowerCase().includes(q) ||
      (b.qrCode && b.qrCode.toLowerCase().includes(q)) ||
      (b.shelfLocationCode && b.shelfLocationCode.toLowerCase().includes(q)) ||
      (b.rack && b.rack.toLowerCase().includes(q)) ||
      (b.warehouseName && b.warehouseName.toLowerCase().includes(q)) ||
      (b.statusName && b.statusName.toLowerCase().includes(q))
    );
  });

  // ================================================================
  // SCANNER & STORAGE RESOLVER WORKSPACE & DIALOG
  // Endpoints:
  // - GET /api/Boxes/storage/resolve-location/{qrCode}
  // - GET /api/Boxes/storage/resolve-box/{trackingCode}
  // - POST /api/Boxes/assign-storage-location
  // - POST /api/Boxes/storage/confirm-committee
  // ================================================================
  scannerDialogVisible = signal<boolean>(false);

  // Inputs
  scannedLocationQr = signal<string>('');
  scannedTrackingCode = signal<string>('');

  // Resolved entities
  resolvedLocation = signal<StorageLocationResolveDto | null>(null);
  resolvedBox = signal<BoxResolveDto | null>(null);

  // Status flags
  locationLoading = signal<boolean>(false);
  boxLoading = signal<boolean>(false);
  assigningStorage = signal<boolean>(false);
  confirmingCommittee = signal<boolean>(false);

  locationError = signal<string | null>(null);
  boxError = signal<string | null>(null);

  openScannerModal(box?: StorageBoxDto, batch?: BatchStorageDto | null): void {
    this.resetScanner();
    if (box) {
      this.scannedTrackingCode.set(box.qrCode || '');
      this.resolveBox(box.qrCode);
      if (box.shelfLocationCode) {
        this.scannedLocationQr.set(box.shelfLocationCode);
        this.resolveLocation(box.shelfLocationCode);
      }
    }
    this.scannerDialogVisible.set(true);
  }

  closeScannerModal(): void {
    this.scannerDialogVisible.set(false);
    this.resetScanner();
  }

  resetScanner(): void {
    this.scannedLocationQr.set('');
    this.scannedTrackingCode.set('');
    this.resolvedLocation.set(null);
    this.resolvedBox.set(null);
    this.locationError.set(null);
    this.boxError.set(null);
  }

  /**
   * Resolve Location via GET /api/Boxes/storage/resolve-location/{qrCode}
   */
  resolveLocation(forcedQr?: string): void {
    const qr = (forcedQr ?? this.scannedLocationQr()).trim();
    if (!qr) {
      this.locationError.set('يرجى إدخال أو مسح كود الرف/الموقع أولاً');
      return;
    }

    this.locationLoading.set(true);
    this.locationError.set(null);

    this.archivingBoxService.resolveLocation(qr).subscribe({
      next: res => {
        this.locationLoading.set(false);
        const data = res?.data;
        if (data) {
          this.resolvedLocation.set(data);
          this.messageService.add({
            severity: 'success',
            summary: 'تم العثور على الموقع',
            detail: `المخزن: ${data.warehouseName || data.warehouseCode} - الرف: ${data.rack || data.rackCode || qr}`,
            life: 2500
          });
        } else {
          this.locationError.set('لم يتم العثور على بيانات لهذا الموقع');
        }
      },
      error: err => {
        this.locationLoading.set(false);
        const msg = err?.error?.message || 'تعذر الوصول إلى موقع التخزين المحدد';
        this.locationError.set(msg);
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ في الموقع',
          detail: msg,
          life: 3500
        });
      }
    });
  }

  /**
   * Resolve Box via GET /api/Boxes/storage/resolve-box/{trackingCode}
   */
  resolveBox(forcedCode?: string): void {
    const code = (forcedCode ?? this.scannedTrackingCode()).trim();
    if (!code) {
      this.boxError.set('يرجى إدخال أو مسح باركود الصندوق أولاً');
      return;
    }

    this.boxLoading.set(true);
    this.boxError.set(null);

    this.archivingBoxService.resolveBox(code).subscribe({
      next: res => {
        this.boxLoading.set(false);
        const data = res?.data;
        if (data) {
          this.resolvedBox.set(data);
          this.messageService.add({
            severity: 'success',
            summary: 'تم العثور على الصندوق',
            detail: `لجنة: ${data.committeeNumber} - ${data.schoolName || ''}`,
            life: 2500
          });
        } else {
          this.boxError.set('لم يتم العثور على بيانات لهذا الصندوق');
        }
      },
      error: err => {
        this.boxLoading.set(false);
        const msg = err?.error?.message || 'تعذر الوصول إلى الصندوق المحدد';
        this.boxError.set(msg);
        this.messageService.add({
          severity: 'error',
          summary: 'خطأ في الصندوق',
          detail: msg,
          life: 3500
        });
      }
    });
  }

  /**
   * Assign Single Box via POST /api/Boxes/assign-storage-location
   */
  assignStorageLocation(): void {
    const location = this.resolvedLocation();
    const box = this.resolvedBox();

    const trackingCode = (box?.scannedTrackingCode || this.scannedTrackingCode()).trim();
    const qrCode = (location?.qrCode || this.scannedLocationQr()).trim();

    if (!trackingCode || !qrCode) {
      this.messageService.add({
        severity: 'warn',
        summary: 'تنبيه',
        detail: 'يرجى التأكد من مسح كود الرف وكود الصندوق معًا قبل التسكين',
        life: 3500
      });
      return;
    }

    this.assigningStorage.set(true);
    this.archivingBoxService.assignStorageLocation({ trackingCode, qrCode }).subscribe({
      next: res => {
        this.assigningStorage.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'تم التسكين بنجاح',
          detail: res?.message || `تم تسكين الصندوق ${trackingCode} في الموقع ${qrCode}`,
          life: 3500
        });

        // Re-resolve location to update stored boxes count and items
        this.resolveLocation(qrCode);
        this.resolveBox(trackingCode);
        this.loadBatches();
      },
      error: err => {
        this.assigningStorage.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'فشل التسكين',
          detail: err?.error?.message || 'تعذر تسكين الصندوق في هذا الموقع',
          life: 4000
        });
      }
    });
  }

  /**
   * Confirm Entire Committee via POST /api/Boxes/storage/confirm-committee
   */
  confirmEntireCommittee(): void {
    const location = this.resolvedLocation();
    const box = this.resolvedBox();

    const qrCode = (location?.qrCode || this.scannedLocationQr()).trim();
    if (!qrCode) {
      this.messageService.add({
        severity: 'warn',
        summary: 'تنبيه',
        detail: 'يرجى تحديد ومسح موقع التخزين (الرف) أولاً',
        life: 3500
      });
      return;
    }

    if (!box || !box.boxes || box.boxes.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'تنبيه',
        detail: 'لا توجد صناديق للجنة الحالية لتأكيد تخزينها',
        life: 3500
      });
      return;
    }

    const placements = box.boxes.map(b => ({
      trackingCode: b.trackingCode,
      qrCode: qrCode
    }));

    this.confirmingCommittee.set(true);
    this.archivingBoxService.confirmCommitteeStorage({ placements }).subscribe({
      next: res => {
        this.confirmingCommittee.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'تم تأكيد اللجنة',
          detail: res?.message || `تم تأكيد تخزين جميع صناديق اللجنة (${placements.length}) بنجاح`,
          life: 4000
        });

        // Refresh
        this.resolveLocation(qrCode);
        this.resolveBox(box.scannedTrackingCode);
        this.loadBatches();
      },
      error: err => {
        this.confirmingCommittee.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'فشل التأكيد',
          detail: err?.error?.message || 'تعذر تأكيد تخزين صناديق اللجنة',
          life: 4000
        });
      }
    });
  }

  // ================================================================
  // LIFECYCLE & LOOKUPS LOADING
  // ================================================================
  ngOnInit(): void {
    this.loadLookups();
    this.loadBatches();
  }

  /**
   * Recursively extract array from any lookup JSON format
   */
  private extractLookupArray(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;

    const possibleKeys = ['data', 'items', 'result', 'results', 'records', 'value'];
    for (const key of possibleKeys) {
      const val = response[key];
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object') {
        const nested = this.extractLookupArray(val);
        if (nested.length > 0) return nested;
      }
    }
    return [];
  }

  /**
   * Map lookups to standard SelectOption array with fallback labels
   */
  private mapToOptions(
    rawList: any[],
    defaultLabel: string,
    idKeys: string[] = ['id', 'governorateId', 'subjectId', 'code', 'value']
  ): SelectOption[] {
    const options: SelectOption[] = [{ label: defaultLabel, value: 'all' }];
    if (!Array.isArray(rawList)) return options;

    rawList.forEach((item: any) => {
      if (!item) return;

      let value: number | string | null = null;
      for (const k of idKeys) {
        if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
          const num = Number(item[k]);
          value = !isNaN(num) && num > 0 ? num : item[k];
          break;
        }
      }

      const nameKeys = ['nameAr', 'arabicName', 'name', 'title', 'governorateName', 'subjectName', 'label'];
      let label: string | null = null;
      for (const k of nameKeys) {
        if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
          label = String(item[k]).trim();
          break;
        }
      }

      if (value != null && label) {
        options.push({ label, value });
      }
    });

    return options;
  }

  loadLookups(): void {
    this.lookupsLoading.set(true);

    forkJoin({
      governorates: this.lookupService.getLookupGovernorateData().pipe(
        catchError(e => {
          console.error('Gov lookup err:', e);
          return of([]);
        })
      ),
      subjects: this.lookupService.getLookupSubjectData().pipe(
        catchError(e => {
          console.error('Subject lookup err:', e);
          return of([]);
        })
      )
    }).subscribe({
      next: res => {
        const rawGov = this.extractLookupArray(res.governorates);
        const rawSub = this.extractLookupArray(res.subjects);

        this.governorates.set(this.mapToOptions(rawGov, 'كل المحافظات'));
        this.subjects.set(this.mapToOptions(rawSub, 'كل المواد'));
        this.lookupsLoading.set(false);
      },
      error: err => {
        console.error('Error loading lookups in Archiving:', err);
        this.lookupsLoading.set(false);
      }
    });
  }
}