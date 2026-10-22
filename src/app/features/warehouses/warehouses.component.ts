import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MenuModule, Menu } from 'primeng/menu';
import { MenuItem, MessageService } from 'primeng/api';
import { Warehouse } from './interfaces/warehouse';
import { WarehouseService } from './service/warehouse.service';

interface WarehouseForm { code: string; name: string; }

const CODE_REGEX = /^[1-9]$/;
// letters (any language), digits and single spaces
const NAME_REGEX = /^[\p{L}\p{M}\p{N}]+(?:\s[\p{L}\p{M}\p{N}]+)*$/u;

@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, DialogModule, FloatLabelModule, MenuModule],
  templateUrl: './warehouses.component.html',
  styleUrl: './warehouses.component.scss'
})
export default class WarehousesComponent implements OnInit {

  private readonly service = inject(WarehouseService);
  private readonly toast = inject(MessageService);   // global MessageService (app-toast)

  // ---------- STATE ----------
  items        = signal<Warehouse[]>([]);
  loading      = signal(false);
  loadError    = signal(false);
  totalRecords = signal(0);
  pageSize     = signal(8);     // 8 cards + the "add" card = a 3 x 3 grid
  currentPage  = signal(1);
  searchQuery  = signal('');

  showFormModal   = signal(false);
  showDeleteModal = signal(false);
  editingId       = signal<number | null>(null);
  deleteTarget    = signal<Warehouse | null>(null);
  saving          = signal(false);
  formLoading     = signal(false);
  deleting        = signal(false);

  form      = signal<WarehouseForm>({ code: '', name: '' });
  formError = signal('');
  touched   = signal<Partial<Record<keyof WarehouseForm, boolean>>>({});

  menuItems = signal<MenuItem[]>([]);
  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void { this.load(); }

  // ---------- DERIVED ----------
  readonly isEdit = computed(() => this.editingId() !== null);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalRecords() / this.pageSize())));

  readonly rangeFrom = computed(() =>
    this.totalRecords() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1);

  readonly rangeTo = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.totalRecords()));

  readonly pageNumbers = computed(() => {
    const total = this.totalPages(), cur = this.currentPage();
    const pages: (number | '...')[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cur > 3) pages.push('...');
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
      if (cur < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  // Summary tiles (based on the warehouses currently loaded)
  readonly latest = computed<Warehouse | null>(() =>
    [...this.items()].sort((a, b) => b.dateCreated.localeCompare(a.dateCreated))[0] ?? null);

  // Validation
  readonly fieldErrors = computed(() => {
    const f = this.form();
    const code = f.code.trim();
    const name = f.name.trim();
    const e: Partial<Record<keyof WarehouseForm, string>> = {};

    if (!code)                       e.code = 'رقم المخزن مطلوب';
    else if (!CODE_REGEX.test(code)) e.code = 'أدخل رقمًا واحدًا من 1 إلى 9';

    if (!name)                                   e.name = 'اسم المخزن مطلوب';
    else if (name.length < 2)                    e.name = 'اسم المخزن قصير جدًا';
    else if (!NAME_REGEX.test(name))             e.name = 'الاسم يقبل حروفًا وأرقامًا فقط (بدون رموز)';
    return e;
  });

  readonly formValid = computed(() => Object.keys(this.fieldErrors()).length === 0);

  showError(key: keyof WarehouseForm): string | null {
    const msg = this.fieldErrors()[key];
    if (!msg) return null;
    return (this.touched()[key] || this.form()[key] !== '') ? msg : null;
  }

  readonly liveError = computed(() => {
    for (const k of ['code', 'name'] as const) {
      const m = this.showError(k);
      if (m) return m;
    }
    return '';
  });

  // ---------- LOAD ----------
  load(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.service.getAll(this.searchQuery(), this.currentPage(), this.pageSize()).subscribe({
      next: res => {
        this.items.set(res.data?.data ?? []);
        this.totalRecords.set(res.data?.totalCount ?? 0);
        this.loading.set(false);
      },
      error: err => {
        console.error('Load warehouses error:', err);
        this.items.set([]);
        this.totalRecords.set(0);
        this.loadError.set(true);
        this.loading.set(false);
      }
    });
  }

  // ---------- SEARCH / PAGING ----------
  onSearch(value: string): void {
    this.searchQuery.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {      // wait until the user stops typing
      this.currentPage.set(1);
      this.load();
    }, 350);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(1);
    this.load();
  }

  goToPage(p: number | '...'): void {
    if (typeof p === 'number' && p !== this.currentPage()) {
      this.currentPage.set(p);
      this.load();
    }
  }
  prevPage(): void { if (this.currentPage() > 1) { this.currentPage.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.currentPage() < this.totalPages()) { this.currentPage.update(p => p + 1); this.load(); } }

  // ---------- ROW MENU ----------
  openMenu(event: Event, w: Warehouse, menu: Menu): void {
    this.menuItems.set([
      { label: 'تعديل', icon: 'pi pi-pencil', command: () => this.openEditModal(w) },
      { separator: true },
      { label: 'حذف', icon: 'pi pi-trash', styleClass: 'menu-danger', command: () => this.confirmDelete(w) }
    ]);
    menu.toggle(event);
  }

  // ---------- ADD / EDIT ----------
  updateForm<K extends keyof WarehouseForm>(key: K, value: string | null): void {
    const nextValue = key === 'code'
      ? (value ?? '').replace(/[^1-9]/g, '').slice(0, 1)
      : value ?? '';
    this.form.update(f => ({ ...f, [key]: nextValue }));
    this.formError.set('');
  }

  private codeNumber(code: string): string {
    return /^W([1-9])$/i.exec(code.trim())?.[1] ?? '';
  }

  markTouched(key: keyof WarehouseForm): void {
    this.touched.update(t => ({ ...t, [key]: true }));
  }

  openAddModal(): void {
    this.editingId.set(null);
    this.form.set({ code: '', name: '' });
    this.formError.set('');
    this.touched.set({});
    this.showFormModal.set(true);
  }

  openEditModal(w: Warehouse): void {
    this.editingId.set(w.id);
    this.form.set({ code: this.codeNumber(w.code), name: w.name });
    this.formError.set('');
    this.touched.set({});
    this.formLoading.set(true);
    this.showFormModal.set(true);

    this.service.getById(w.id).subscribe({
      next: res => {
        this.form.set({ code: this.codeNumber(res.data.code), name: res.data.name });
        this.formLoading.set(false);
      },
      error: err => {
        console.error('Get warehouse error:', err);
        this.formLoading.set(false);
        this.formError.set(err?.error?.message ?? 'تعذّر تحميل بيانات المخزن');
      }
    });
  }

  closeFormModal(): void {
    this.showFormModal.set(false);
    this.editingId.set(null);
    this.formLoading.set(false);
    this.touched.set({});
  }

  submitForm(): void {
    if (this.formLoading() || this.saving()) return;

    if (!this.formValid()) {
      this.touched.set({ code: true, name: true });
      return;
    }

    const editing = this.isEdit();
    const body = { code: `W${this.form().code.trim()}`, name: this.form().name.trim() };

    this.saving.set(true);
    const request$ = editing
      ? this.service.update(this.editingId()!, body)
      : this.service.create(body);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeFormModal();
        this.load();
        this.toast.add({
          severity: 'success', summary: 'تمت العملية', life: 3500,
          detail: editing ? 'تم تعديل المخزن بنجاح' : 'تمت إضافة المخزن بنجاح'
        });
      },
      error: err => {
        console.error('Save warehouse error:', err);
        this.saving.set(false);
        const msg = err?.error?.message ??
          (editing ? 'حدث خطأ أثناء تعديل المخزن' : 'حدث خطأ أثناء إضافة المخزن');
        this.formError.set(msg);
        this.toast.add({ severity: 'error', summary: 'حدث خطأ', detail: msg, life: 5000 });
      }
    });
  }

  // ---------- DELETE ----------
  confirmDelete(w: Warehouse): void {
    this.deleteTarget.set(w);
    this.showDeleteModal.set(true);
  }

  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.deleteTarget.set(null);
  }

  executeDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;

    this.deleting.set(true);
    this.service.delete(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.cancelDelete();
        if (this.items().length === 1 && this.currentPage() > 1) this.currentPage.update(p => p - 1);
        this.load();
        this.toast.add({ severity: 'success', summary: 'تمت العملية', detail: 'تم حذف المخزن بنجاح', life: 3500 });
      },
      error: err => {
        console.error('Delete warehouse error:', err);
        this.deleting.set(false);
        this.toast.add({
          severity: 'error', summary: 'حدث خطأ', life: 5000,
          detail: err?.error?.message ?? 'تعذّر حذف المخزن (قد يكون مرتبطًا ببيانات أخرى)'
        });
      }
    });
  }
}
