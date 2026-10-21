
import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Observable, Subject, Subscription, debounceTime } from 'rxjs';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  StorageLocation,
  LookupItem
} from './model/storageLocation.model';
import { StorageLocationsService } from './service/storage-locations-service';

const toOptions = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const value = `${prefix}${i + 1}`;
    return { label: value, value };
  });

@Component({
  selector: 'app-storage-locations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    ToastModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './storage-locations.component.html',
  styleUrl: './storage-locations.component.scss'
})
export default class StorageLocationsComponent implements OnInit {
  private readonly api = inject(StorageLocationsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  private listSub?: Subscription;
  private readonly search$ = new Subject<string>();

  // DATA
  readonly rows = signal<StorageLocation[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly warehouses = signal<LookupItem[]>([]);

  // STATISTICS
  readonly warehouseCount = computed(() => this.warehouses().length);

  readonly visibleAreaCount = computed(() =>
    new Set(this.rows().map(row => row.area).filter(Boolean)).size
  );

  readonly visibleLocationCount = computed(() => this.rows().length);

  // FILTERS / PAGING
  readonly warehouseFilter = signal<number | null>(null);
  readonly searchInput = signal('');
  readonly searchTerm = signal('');
  readonly ascending = signal(true);
  readonly pageNumber = signal(1);
  readonly pageSize = signal(10);

  readonly pageSizeOptions = [
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '30', value: 30 }
  ];

  readonly hasActiveFilters = computed(
    () =>
      this.warehouseFilter() !== null ||
      !!this.searchTerm() ||
      !this.ascending()
  );

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalCount() / this.pageSize()))
  );

  readonly paginationStart = computed(() =>
    this.totalCount() === 0
      ? 0
      : (this.pageNumber() - 1) * this.pageSize() + 1
  );

  readonly paginationEnd = computed(() =>
    Math.min(this.pageNumber() * this.pageSize(), this.totalCount())
  );

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const current = this.pageNumber();

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

  // FORM LOOKUPS
  readonly areaOptions = toOptions('A', 6);
  readonly rackOptions = toOptions('R', 20);
  readonly shelfOptions = toOptions('S', 10);
  readonly binOptions = toOptions('B', 10);

  formVisible = false;
  readonly editingId = signal<number | null>(null);
  readonly loadingForm = signal(false);
  readonly saving = signal(false);

  readonly form = this.fb.group({
    warehouseId: this.fb.control<number | null>(
      null,
      Validators.required
    ),
    code: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(50)
    ]),
    area: this.fb.control<string | null>(null, Validators.required),
    rack: this.fb.control<string | null>(null, Validators.required),
    shelf: this.fb.control<string | null>(null, Validators.required),
    bin: this.fb.control<string | null>(null, Validators.required)
  });

  // DELETE
  deleteVisible = false;
  readonly deleteTarget = signal<StorageLocation | null>(null);
  readonly deleting = signal(false);

  ngOnInit(): void {
    this.api
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => this.warehouses.set(list),
        error: () => this.showError('تعذر تحميل قائمة المخازن')
      });

    this.search$
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(term => {
        if (term === this.searchTerm()) {
          return;
        }

        this.searchTerm.set(term);
        this.pageNumber.set(1);
        this.load();
      });

    this.load();
  }

  // LOAD
  load(): void {
    this.listSub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(false);

    this.listSub = this.api
      .getAll({
        warehouseId: this.warehouseFilter(),
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        searchTerm: this.searchTerm(),
        ascending: this.ascending()
      })
      .subscribe({
        next: (res: any) => {
          const items = res.data?.data ?? [];
          const total = res.data?.totalCount ?? 0;

          this.rows.set(items);
          this.totalCount.set(total);
          this.loading.set(false);

          // لو الصفحة الحالية أصبحت فارغة بعد الحذف
          if (
            items.length === 0 &&
            this.pageNumber() > 1 &&
            total > 0
          ) {
            this.pageNumber.set(
              Math.max(1, Math.ceil(total / this.pageSize()))
            );
            this.load();
          }
        },
        error: () => {
          this.rows.set([]);
          this.totalCount.set(0);
          this.loadError.set(true);
          this.loading.set(false);
        }
      });
  }

  // FILTERS
  onWarehouseChange(id: number | null): void {
    this.warehouseFilter.set(id);
    this.pageNumber.set(1);
    this.load();
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
    this.search$.next(value.trim());
  }

  toggleSort(): void {
    this.ascending.update(value => !value);
    this.pageNumber.set(1);
    this.load();
  }

  clearFilters(): void {
    this.warehouseFilter.set(null);
    this.searchInput.set('');
    this.searchTerm.set('');
    this.ascending.set(true);
    this.pageNumber.set(1);
    this.load();
  }

  // PAGINATION
  goToPage(page: number): void {
    if (
      page < 1 ||
      page > this.totalPages() ||
      page === this.pageNumber()
    ) {
      return;
    }

    this.pageNumber.set(page);
    this.load();
  }

  previousPage(): void {
    this.goToPage(this.pageNumber() - 1);
  }

  nextPage(): void {
    this.goToPage(this.pageNumber() + 1);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }

  rowNumber(index: number): number {
    return (this.pageNumber() - 1) * this.pageSize() + index + 1;
  }

  warehouseName(row: StorageLocation): string {
    return (
      row.warehouseName ??
      this.warehouses().find(w => w.id === row.warehouseId)?.name ??
      `#${row.warehouseId}`
    );
  }

  // ADD / EDIT
  openAdd(): void {
    this.editingId.set(null);
    this.form.reset();
    this.form.controls.warehouseId.enable();

    if (this.warehouseFilter() !== null) {
      this.form.controls.warehouseId.setValue(this.warehouseFilter());
    }

    this.formVisible = true;
  }

  openEdit(row: StorageLocation): void {
    this.editingId.set(row.id);
    this.form.reset();
    this.form.controls.warehouseId.disable();
    this.loadingForm.set(true);
    this.formVisible = true;

    this.api
      .getById(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loc:any) => {
          this.form.patchValue({
            warehouseId: loc.data.warehouseId,
            code: loc.data.code,
            area: loc.data.area,
            rack: loc.data.rack,
            shelf: loc.data.shelf,
            bin: loc.data.bin
          });

          this.loadingForm.set(false);
        },
        error: err => {
          this.loadingForm.set(false);
          this.formVisible = false;
          this.showError(this.errorMessage(err));
        }
      });
  }

  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  save(): void {
    if (this.saving() || this.loadingForm()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const id = this.editingId();

    this.saving.set(true);

    const request$: Observable<unknown> =
      id === null
        ? this.api.create({
            warehouseId: value.warehouseId!,
            code: value.code.trim(),
            area: value.area!,
            rack: value.rack!,
            shelf: value.shelf!,
            bin: value.bin!
          })
        : this.api.update(id, {
            code: value.code.trim(),
            area: value.area!,
            rack: value.rack!,
            shelf: value.shelf!,
            bin: value.bin!
          });

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.formVisible = false;

          this.toast.add({
            severity: 'success',
            summary: 'تم بنجاح',
            detail:
              id === null
                ? 'تمت إضافة موقع التخزين'
                : 'تم تعديل موقع التخزين'
          });

          this.load();
        },
        error: err => {
          this.saving.set(false);
          this.showError(this.errorMessage(err));
        }
      });
  }

  closeForm(): void {
    if (this.saving()) {
      return;
    }

    this.formVisible = false;
  }

  // DELETE
  openDelete(row: StorageLocation): void {
    this.deleteTarget.set(row);
    this.deleteVisible = true;
  }

  closeDelete(): void {
    if (this.deleting()) {
      return;
    }

    this.deleteVisible = false;
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();

    if (!target || this.deleting()) {
      return;
    }

    this.deleting.set(true);

    this.api
      .delete(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.deleteVisible = false;
          this.deleteTarget.set(null);

          this.toast.add({
            severity: 'success',
            summary: 'تم الحذف',
            detail: 'تم حذف موقع التخزين'
          });

          this.load();
        },
        error: err => {
          this.deleting.set(false);
          this.showError(this.errorMessage(err));
        }
      });
  }

  // HELPERS
  private errorMessage(err: any): string {
    const serverMessage = err?.error?.message ?? err?.error?.title;

    if (serverMessage) {
      return serverMessage;
    }

    switch (err?.status) {
      case 0:
        return 'تعذر الاتصال بالخادم';
      case 404:
        return 'موقع التخزين غير موجود';
      case 409:
        return 'الكود مستخدم بالفعل أو الموقع مستخدم في بيانات أخرى';
      default:
        return 'حدث خطأ غير متوقع، حاول مرة أخرى';
    }
  }

  private showError(detail: string): void {
    this.toast.add({
      severity: 'error',
      summary: 'خطأ',
      detail
    });
  }
}
