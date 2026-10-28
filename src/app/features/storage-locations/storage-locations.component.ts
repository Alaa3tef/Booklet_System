import { CommonModule } from "@angular/common";
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Observable, Subject, Subscription, debounceTime } from "rxjs";

import { MessageService } from "primeng/api";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { InputNumberModule } from "primeng/inputnumber";
import { InputTextModule } from "primeng/inputtext";
import { SelectModule } from "primeng/select";
import { TableModule } from "primeng/table";
import { ToastModule } from "primeng/toast";
import { TooltipModule } from "primeng/tooltip";

import { StorageLocation, LookupItem } from "./model/storageLocation.model";
import { StorageLocationsService } from "./service/storage-locations-service";

@Component({
  selector: "app-storage-locations",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TableModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [MessageService],
  templateUrl: "./storage-locations.component.html",
  styleUrl: "./storage-locations.component.scss",
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

  // FILTERS / PAGING
  readonly warehouseFilter = signal<number | null>(null);
  readonly searchInput = signal("");
  readonly searchTerm = signal("");
  readonly ascending = signal(true);
  readonly pageNumber = signal(1);
  readonly pageSize = signal(10);

  readonly pageSizeOptions = [
    { label: "10", value: 10 },
    { label: "20", value: 20 },
    { label: "30", value: 30 },
  ];

  readonly hasActiveFilters = computed(
    () =>
      this.warehouseFilter() !== null ||
      !!this.searchTerm() ||
      !this.ascending(),
  );

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalCount() / this.pageSize())),
  );

  readonly paginationStart = computed(() =>
    this.totalCount() === 0 ? 0 : (this.pageNumber() - 1) * this.pageSize() + 1,
  );

  readonly paginationEnd = computed(() =>
    Math.min(this.pageNumber() * this.pageSize(), this.totalCount()),
  );

  readonly paginationPages = computed<(number | "dots")[]>(() => {
    const total = this.totalPages();
    const current = this.pageNumber();

    if (total <= 4) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 2) {
      return [1, 2, 3, "dots", total];
    }
    if (current >= total - 1) {
      return [1, "dots", total - 2, total - 1, total];
    }
    return [1, "dots", current, "dots", total];
  });

  // DIALOG
  formVisible = false;
  readonly editingId = signal<number | null>(null);
  readonly editingWarehouse = signal("");
  readonly loadingForm = signal(false);
  readonly saving = signal(false);

  // فورم الإضافة: أرقام (عدد)
  readonly addForm = this.fb.group({
    warehouseId: this.fb.control<number | null>(null, Validators.required),
    areas: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    racksPerArea: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    shelvesPerRack: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
    ]),
    binsPerArea: this.fb.control<number | null>(null, [Validators.min(1)]),
  });

  // فورم التعديل: نصوص (قيمة الموقع)
  readonly editForm = this.fb.group({
    warehouseId: this.fb.control<number | null>({
      value: null,
      disabled: true,
    }),
    qrCode: this.fb.nonNullable.control({ value: "", disabled: true }),
    area: this.fb.nonNullable.control("", [
      Validators.required,
      Validators.maxLength(50),
    ]),
    rack: this.fb.nonNullable.control("", [
      Validators.required,
      Validators.maxLength(50),
    ]),
    shelf: this.fb.nonNullable.control("", [
      Validators.required,
      Validators.maxLength(50),
    ]),
    bin: this.fb.nonNullable.control("", [Validators.maxLength(50)]),
  });

  get activeForm(): FormGroup {
    return this.editingId() === null ? this.addForm : this.editForm;
  }

  // DELETE
  deleteVisible = false;
  readonly deleteTarget = signal<StorageLocation | null>(null);
  readonly deleting = signal(false);

  // PRINT QR
  readonly printingAll = signal(false);
  readonly printingId = signal<number | null>(null);

  ngOnInit(): void {
    this.api
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.warehouses.set(list),
        error: () => this.showError("تعذر تحميل قائمة المخازن"),
      });

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
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
        ascending: this.ascending(),
      })
      .subscribe({
        next: (res: any) => {
          const items = res.data?.data ?? [];
          const total = res.data?.totalCount ?? 0;

          this.rows.set(items);
          this.totalCount.set(total);
          this.loading.set(false);

          // لو الصفحة الحالية أصبحت فارغة بعد الحذف
          if (items.length === 0 && this.pageNumber() > 1 && total > 0) {
            this.pageNumber.set(
              Math.max(1, Math.ceil(total / this.pageSize())),
            );
            this.load();
          }
        },
        error: () => {
          this.rows.set([]);
          this.totalCount.set(0);
          this.loadError.set(true);
          this.loading.set(false);
        },
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
    this.ascending.update((value) => !value);
    this.pageNumber.set(1);
    this.load();
  }

  clearFilters(): void {
    this.warehouseFilter.set(null);
    this.searchInput.set("");
    this.searchTerm.set("");
    this.ascending.set(true);
    this.pageNumber.set(1);
    this.load();
  }

  // PAGINATION
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.pageNumber()) {
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
      this.warehouses().find((w) => w.id === row.warehouseId)?.name ??
      `#${row.warehouseId}`
    );
  }

  // PRINT QR
  // بدون id => طباعة الكل | مع id => طباعة موقع واحد
  // بدون id => طباعة مواقع المخزن المختار في الفلتر (أو الكل لو مفيش مخزن)
  // مع id => طباعة موقع واحد
 
printQr(id?: number): void {
  if (
    this.loading() ||
    this.rows().length === 0 ||
    this.printingAll() ||
    this.printingId() !== null
  ) {
    return;
  }

  const warehouseId = id === undefined ? this.warehouseFilter() : null;

  if (id === undefined) {
    this.printingAll.set(true);
  } else {
    this.printingId.set(id);
  }

  const baseName =
    id !== undefined
      ? `qr-location-${id}`
      : warehouseId !== null
        ? `qr-warehouse-${warehouseId}`
        : 'qr-all-locations';

  this.downloadFile(this.api.printQr(warehouseId), baseName, () => {
    this.printingAll.set(false);
    this.printingId.set(null);
  });
}


  private downloadFile(
    request$: Observable<Blob>,
    baseName: string,
    done: () => void,
  ): void {
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        done();

        const isPdf = blob.type === "application/pdf";
        const url = URL.createObjectURL(blob);

        // PDF يتفتح في تبويب جديد، غير كده (ZIP) يتنزّل
        if (isPdf) {
          window.open(url, "_blank");
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = `${baseName}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }

        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) => {
        done();
        this.showError(this.errorMessage(err));
      },
    });
  }

  // ADD / EDIT
  openAdd(): void {
    this.editingId.set(null);
    this.addForm.reset();

    if (this.warehouseFilter() !== null) {
      this.addForm.controls.warehouseId.setValue(this.warehouseFilter());
    }

    this.formVisible = true;
  }

  openEdit(row: StorageLocation): void {
    this.editingId.set(row.id);
    this.editingWarehouse.set(this.warehouseName(row));
    this.editForm.reset();
    this.loadingForm.set(true);
    this.formVisible = true;

    this.api
      .getById(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loc: any) => {
          const d = loc.data;
          this.editForm.patchValue({
            warehouseId: d.warehouseId ?? row.warehouseId,
            qrCode: String(d.qrCode ?? ""),
            area: String(d.area ?? ""),
            rack: String(d.rack ?? ""),
            shelf: String(d.shelf ?? ""),
            bin: String(d.bin ?? ""),
          });
          this.loadingForm.set(false);
        },
        error: (err) => {
          this.loadingForm.set(false);
          this.formVisible = false;
          this.showError(this.errorMessage(err));
        },
      });
  }

  invalid(form: FormGroup, name: string): boolean {
    const control = form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  save(): void {
    if (this.saving() || this.loadingForm()) {
      return;
    }

    const form = this.activeForm;

    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const id = this.editingId();
    let request$: Observable<unknown>;

    if (id === null) {
      const v = this.addForm.getRawValue();
      request$ = this.api.create({
        warehouseId: v.warehouseId!,
        areas: v.areas!,
        racksPerArea: v.racksPerArea!,
        shelvesPerRack: v.shelvesPerRack!,
        binsPerArea: v.binsPerArea!,
      });
    } else {
      const v = this.editForm.getRawValue();
      request$ = this.api.update(id, {
        area: v.area.trim(),
        rack: v.rack.trim(),
        shelf: v.shelf.trim(),
        bin: v.bin.trim(),
        qrCode: v.qrCode.trim()
      });
    }

    this.saving.set(true);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.formVisible = false;

        this.toast.add({
          severity: "success",
          summary: "تم بنجاح",
          detail:
            id === null ? "تمت إضافة موقع التخزين" : "تم تعديل موقع التخزين",
        });

        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(this.errorMessage(err));
      },
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
            severity: "success",
            summary: "تم الحذف",
            detail: "تم حذف موقع التخزين",
          });

          this.load();
        },
        error: (err) => {
          this.deleting.set(false);
          this.showError(this.errorMessage(err));
        },
      });
  }

  // HELPERS
  private errorMessage(err: any): string {
    const serverMessage = err?.error?.message ?? err?.error?.title;

    if (serverMessage && typeof serverMessage === "string") {
      return serverMessage;
    }

    switch (err?.status) {
      case 0:
        return "تعذر الاتصال بالخادم";
      case 404:
        return "موقع التخزين غير موجود";
      case 409:
        return "الكود مستخدم بالفعل أو الموقع مستخدم في بيانات أخرى";
      default:
        return "حدث خطأ غير متوقع، حاول مرة أخرى";
    }
  }

  private showError(detail: string): void {
    this.toast.add({ severity: "error", summary: "خطأ", detail });
  }
}
