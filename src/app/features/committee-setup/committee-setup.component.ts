
import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService, MessageService as PrimeSelectOption } from 'primeng/api';

import {
  CommitteeRow,
  SelectOption,
  StepItem
} from '../../core/models/committee.model';

import { Lookups } from '../../shared/services/lookups';
import { CommitteeService } from './service/committee-service';
import { toOptions } from './to-options';

interface CommitteeTableRow extends CommitteeRow {
  governorate: string;
  subject: string;
  fileName: string;
  errors: string[];
  status: 'valid' | 'invalid';
}

@Component({
  selector: 'app-committee-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    SelectModule,
    TableModule,
    ButtonModule,
    DividerModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    DialogModule,
    ToastModule
  ],
  templateUrl: './committee-setup.component.html',
  styleUrl: './committee-setup.component.scss'
})
export default class CommitteeSetupComponent implements OnInit, OnDestroy {

  private readonly committeeService = inject(CommitteeService);
  private readonly lookups = inject(Lookups);
  private readonly toast = inject(MessageService);

  // =========================================================
  // STEPS
  // =========================================================

  readonly steps = signal<StepItem[]>([
    { order: 1, label: 'اختيار المحافظة والمادة', state: 'active' },
    { order: 2, label: 'رفع ملف اللجان', state: 'pending' },
    { order: 3, label: 'مراجعة البيانات', state: 'pending' },
    { order: 4, label: 'إنشاء الملفات', state: 'pending' }
  ]);

  // =========================================================
  // LOOKUPS
  // =========================================================

  readonly rounds = signal<SelectOption[]>([]);
  readonly educationalStages = signal<SelectOption[]>([]);
  readonly governorates = signal<SelectOption[]>([]);
  readonly subjects = signal<SelectOption[]>([]);
  readonly lookupsLoading = signal(false);

  selectedRound: string | null = null;
  selectedEducationalStage: string | null = null;
  selectedGovernorate: string | null = null;
  selectedYear = 27;

  ngOnInit(): void {
    this.loadLookups();
    this.loadHistory();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  private loadLookups(): void {
    this.lookupsLoading.set(true);

    forkJoin({
      governorates: this.lookups.getLookupGovernorateData(),
      subjects: this.lookups.getLookupSubjectData(),
      rounds: this.committeeService.getRounds(),
      stages: this.committeeService.getEducationstages()
    }).subscribe({
      next: ({ governorates, subjects, rounds, stages }) => {
        this.governorates.set(toOptions(governorates));
        this.subjects.set(toOptions(subjects));
        this.rounds.set(toOptions(rounds));
        this.educationalStages.set(toOptions(stages));
        this.lookupsLoading.set(false);
      },
      error: err => {
        console.error('Lookups error:', err);
        this.lookupsLoading.set(false);

        this.toast.add({
          severity: 'error',
          summary: 'تعذّر تحميل القوائم',
          detail: this.extractErrorMessage(err),
          life: 5000
        });
      }
    });
  }

  // =========================================================
  // HISTORY
  // =========================================================

  readonly rows = signal<CommitteeTableRow[]>([]);
  readonly totalRecords = signal(0);
  readonly tableLoading = signal(false);

  readonly searchTerm = signal('');
  readonly filterGovernorate = signal<string | null>(null);
  readonly filterSubject = signal<string | null>(null);

  readonly first = signal(0);
  readonly pageSize = signal(5);
  readonly isDragOver = signal(false);

  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly currentPage = computed(
    () => Math.floor(this.first() / this.pageSize()) + 1
  );

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalRecords() / this.pageSize()))
  );

  readonly visiblePages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 3) {
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

  readonly visibleRows = computed<CommitteeTableRow[]>(() => {
    const governorate = this.filterGovernorate();
    const subject = this.filterSubject();

    return this.rows().filter(row =>
      (!governorate || row.governorate === governorate) &&
      (!subject || row.subject === subject)
    );
  });

  readonly totalBooklets = computed(() =>
    this.visibleRows().reduce(
      (sum, row) => sum + Number(row.bookletCount || 0),
      0
    )
  );

  // =========================================================
  // HISTORY API RESPONSE
  // Supports:
  // response.data.data
  // response.data.totalCount
  // =========================================================

  loadHistory(): void {
    this.tableLoading.set(true);

    this.committeeService.getHistory({
      pageNumber: this.currentPage(),
      pageSize: this.pageSize(),
      searchTerm: this.searchTerm()
    }).subscribe({
      next: response => {
        const { items, total } = this.parseHistory(response);

        this.rows.set(
          items.map((item, index) => this.mapHistoryRow(item, index))
        );

        this.totalRecords.set(total);
        this.tableLoading.set(false);
      },
      error: err => {
        console.error('History error:', err);

        this.tableLoading.set(false);
        this.rows.set([]);
        this.totalRecords.set(0);

        this.toast.add({
          severity: 'error',
          summary: 'تعذّر تحميل سجل الاستيراد',
          detail: this.extractErrorMessage(err),
          life: 5000
        });
      }
    });
  }

  private parseHistory(
    response: unknown
  ): { items: any[]; total: number } {
    const raw = response as any;

    // Example:
    // raw.data.currentPage
    // raw.data.totalCount
    // raw.data.data = history items
    const body = raw?.data ?? raw;

    const items: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.items)
          ? body.items
          : Array.isArray(body?.records)
            ? body.records
            : Array.isArray(body?.result)
              ? body.result
              : [];

    const total = Number(
      body?.totalCount ??
      body?.totalRecords ??
      body?.total ??
      items.length
    );

    return { items, total };
  }

  private mapHistoryRow(
    item: any,
    index: number
  ): CommitteeTableRow {
    const errors = this.normalizeErrors(item?.errors);

    const status = String(item?.status ?? '').toLowerCase();

    const invalid =
      status === 'rejected' ||
      status === 'invalid' ||
      status === 'failed' ||
      item?.isValid === false ||
      item?.success === false ||
      errors.length > 0;

    return {
      index: this.first() + index + 1,

      // The history endpoint is an import-history endpoint.
      // auditLogId is used as a fallback when no committee ID exists.
      committeeNumber: String(
        item?.committeeNumber ??
        item?.committeeCode ??
        item?.auditLogId ??
        item?.id ??
        ''
      ),

      schoolName: String(
        item?.schoolName ??
        item?.committeeName ??
        item?.fileName ??
        ''
      ),

      educationalAdministration: String(
        item?.educationalAdministration ??
        item?.administrationName ??
        ''
      ),

      bookletCount: Number(
        item?.bookletCount ??
        item?.booklets ??
        item?.rowsCount ??
        0
      ),

      status: invalid ? 'invalid' : 'valid',

      governorate: String(
        item?.governorateCode ??
        item?.governorate ??
        ''
      ),

      subject: String(
        item?.subjectCode ??
        item?.subject ??
        ''
      ),

      fileName: String(item?.fileName ?? ''),

      errors
    } as CommitteeTableRow;
  }

  // =========================================================
  // PAGINATION AND FILTERS
  // =========================================================

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) {
      return;
    }

    this.first.set((page - 1) * this.pageSize());
    this.loadHistory();
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.first.set(0);
    this.loadHistory();
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
    this.first.set(0);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.loadHistory();
    }, 400);
  }

  onFilterGovernorateChange(value: string | null): void {
    this.filterGovernorate.set(value);
  }

  onFilterSubjectChange(value: string | null): void {
    this.filterSubject.set(value);
  }

  resetTableFilters(): void {
    this.searchTerm.set('');
    this.filterGovernorate.set(null);
    this.filterSubject.set(null);
    this.first.set(0);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.loadHistory();
  }

  // =========================================================
  // ERROR DIALOG
  // =========================================================

  readonly errorsDialogVisible = signal(false);
  readonly selectedErrorRow = signal<CommitteeTableRow | null>(null);

  openErrors(row: CommitteeTableRow): void {
    this.selectedErrorRow.set(row);
    this.errorsDialogVisible.set(true);
  }

  closeErrors(): void {
    this.errorsDialogVisible.set(false);
    this.selectedErrorRow.set(null);
  }

  // =========================================================
  // FILE UPLOAD
  // =========================================================

  private selectedFile: File | null = null;

  readonly uploadedFile = signal<{
    name: string;
    sizeKb: number;
  } | null>(null);

  readonly saving = signal(false);
  readonly filesGenerated = signal(false);
  readonly saveError = signal('');

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.processSelectedFile(file);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();

    if (this.saving()) {
      return;
    }

    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();

    const currentTarget = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget as Node | null;

    if (nextTarget && currentTarget.contains(nextTarget)) {
      return;
    }

    this.isDragOver.set(false);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);

    if (this.saving()) {
      return;
    }

    const file = event.dataTransfer?.files?.[0];

    if (file) {
      this.processSelectedFile(file);
    }
  }

  private processSelectedFile(file: File): void {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (!extension || !['xlsx', 'xls'].includes(extension)) {
      this.selectedFile = null;
      this.uploadedFile.set(null);
      this.filesGenerated.set(false);

      this.saveError.set(
        'صيغة الملف غير مدعومة. اختاري ملف Excel بصيغة XLS أو XLSX.'
      );

      this.toast.add({
        severity: 'error',
        summary: 'صيغة ملف غير مدعومة',
        detail: this.saveError(),
        life: 5000
      });

      return;
    }

    this.selectedFile = file;

    this.uploadedFile.set({
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024))
    });

    this.filesGenerated.set(false);
    this.saveError.set('');
  }

  removeSelectedFile(): void {
    if (this.saving()) {
      return;
    }

    this.selectedFile = null;
    this.uploadedFile.set(null);
    this.filesGenerated.set(false);
    this.saveError.set('');
  }

  // =========================================================
  // IMPORT
  // =========================================================

  createFiles(): void {
    if (!this.selectedFile || this.saving()) {
      return;
    }

    const year = Number(this.selectedYear);

    if (
      !this.selectedGovernorate ||
      !this.selectedEducationalStage ||
      !this.selectedRound ||
      !Number.isInteger(year) ||
      year < 1 ||
      year > 99
    ) {
      this.saveError.set(
        'يرجى مراجعة بيانات المحافظة والمرحلة التعليمية والدور والسنة.'
      );

      this.toast.add({
        severity: 'warn',
        summary: 'بيانات غير مكتملة',
        detail: this.saveError(),
        life: 4000
      });

      return;
    }

    this.saving.set(true);
    this.saveError.set('');
    this.filesGenerated.set(false);

    this.committeeService.uploadCommittees({
      file: this.selectedFile,
      year,
      roundCode: this.selectedRound,
      governorateCode: this.selectedGovernorate,
      educationalStageCode: this.selectedEducationalStage
    }).subscribe({
      next: response => {
        this.saving.set(false);

        // Do not treat an unsuccessful response as a success
        // just because the HTTP status was 2xx.
        const responseErrors = this.normalizeErrors(
          (response as any)?.errors ??
          (response as any)?.data?.errors
        );

        if (
          (response as any)?.success === false ||
          responseErrors.length > 0
        ) {
          this.filesGenerated.set(false);
          this.saveError.set(
            `فشل استيراد الملف، وتم اكتشاف ${responseErrors.length} أخطاء.`
          );

          this.showImportErrors(responseErrors);
          this.loadHistory();
          return;
        }

        this.filesGenerated.set(true);

        this.toast.add({
          severity: 'success',
          summary: 'تمت العملية بنجاح',
          detail: 'تم رفع الملف وتنفيذ الطلب بنجاح.',
          life: 3500
        });

        this.first.set(0);
        this.loadHistory();
      },

      error: err => {
        console.error('Upload error:', err);

        this.saving.set(false);
        this.filesGenerated.set(false);

        const errors = this.extractApiErrors(err);

        this.saveError.set(
          errors.length > 1
            ? `فشل استيراد الملف، وتم اكتشاف ${errors.length} أخطاء.`
            : errors[0]
        );

        this.showImportErrors(errors);

        // Refresh history so that the rejected import appears in the table.
        this.first.set(0);
        this.loadHistory();
      }
    });
  }

  // =========================================================
  // IMPORT ERRORS / TOAST
  // =========================================================

  private normalizeErrors(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map(item => String(item ?? '').trim())
        .filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }

    return [];
  }

  private extractApiErrors(err: any): string[] {
    const body = err?.error;

    // The backend may return the 422 body directly in error.errors.
    const errors = this.normalizeErrors(
      body?.errors ??
      body?.Errors ??
      body?.data?.errors
    );

    if (errors.length) {
      return errors;
    }

    if (typeof body === 'string' && body.trim()) {
      return [body.trim()];
    }

    return [
      body?.message ||
      body?.Message ||
      body?.detail ||
      body?.title ||
      err?.message ||
      'تعذّر تنفيذ الطلب. يرجى المحاولة مرة أخرى.'
    ];
  }

  private showImportErrors(errors: string[]): void {
    if (!errors.length) {
      errors = ['تعذّر استيراد الملف. يرجى مراجعة البيانات والمحاولة مرة أخرى.'];
    }

    this.toast.add({
      severity: 'error',
      summary: `فشل استيراد الملف (${errors.length} أخطاء)`,
      detail: 'تفاصيل الأخطاء تظهر في الرسائل التالية.',
      life: 6000
    });

    // One toast per backend error, preserving the original Arabic message.
    errors.forEach((message, index) => {
      this.toast.add({
        severity: 'error',
        summary: `الخطأ ${index + 1} من ${errors.length}`,
        detail: message,
        sticky: true
      });
    });
  }

  private extractErrorMessage(err: any): string {
    return this.extractApiErrors(err)[0];
  }

  // =========================================================
  // DISPLAY LABELS
  // =========================================================

  getGovernorateLabel(value: string): string {
    return this.governorates().find(item => item.value === value)?.label ?? value;
  }

  getSubjectLabel(value: string): string {
    return this.subjects().find(item => item.value === value)?.label ?? value;
  }

  // =========================================================
  // EXPORT
  // =========================================================

  exportReport(): void {
    const data = this.visibleRows();

    if (!data.length) {
      this.toast.add({
        severity: 'warn',
        summary: 'لا توجد بيانات',
        detail: 'لا توجد نتائج مطابقة للفلاتر لتصديرها.',
        life: 3000
      });

      return;
    }

    const csvCell = (value: unknown): string =>
      `"${String(value ?? '').replace(/"/g, '""')}"`;

    const governorate = this.filterGovernorate()
      ? this.getGovernorateLabel(this.filterGovernorate()!)
      : 'كل المحافظات';

    const subject = this.filterSubject()
      ? this.getSubjectLabel(this.filterSubject()!)
      : 'كل المواد';

    const reportRows: unknown[][] = [
      ['تقرير بيانات اللجان'],
      ['المحافظة', governorate],
      ['المادة', subject],
      ['عبارة البحث', this.searchTerm() || 'بدون بحث'],
      ['عدد السجلات', data.length],
      ['إجمالي البوكليتات', this.totalBooklets()],
      ['تاريخ التصدير', new Date().toLocaleString('ar-EG')],
      [],
      [
        'م',
        'رقم اللجنة / السجل',
        'اسم اللجنة / الملف',
        'المحافظة',
        'المادة',
        'الإدارة التعليمية',
        'عدد البوكليتات',
        'الحالة',
        'الأخطاء'
      ],
      ...data.map((row, index) => [
        index + 1,
        row.committeeNumber,
        row.schoolName,
        this.getGovernorateLabel(row.governorate),
        this.getSubjectLabel(row.subject),
        row.educationalAdministration,
        row.bookletCount,
        row.status === 'valid' ? 'صحيح' : 'مرفوض',
        row.errors.join(' | ')
      ])
    ];

    const csv =
      '\uFEFF' +
      reportRows.map(row => row.map(csvCell).join(',')).join('\r\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    );

    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download =
      `تقرير-اللجان-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    this.toast.add({
      severity: 'success',
      summary: 'تم تصدير التقرير',
      detail: `تم تصدير ${data.length} سجل وفقًا للفلاتر الحالية.`,
      life: 3000
    });
  }
}
