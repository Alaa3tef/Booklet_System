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
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import {
  CommitteeRow,
  SelectOption,
  StepItem
} from '../../core/models/committee.model';

import { Lookups } from '../../shared/services/lookups';
import { CommitteeService } from './service/committee-service';
import { toOptions } from './to-options';

@Component({
  selector: 'app-committee-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    TableModule,
    ButtonModule,
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

  readonly rows = signal<any[]>([]);
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

  readonly visibleRows = computed<any[]>(() => {
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

  // Supports: response.data.data / response.data.totalCount
  private parseHistory(response: unknown): { items: any[]; total: number } {
    const raw = response as any;
    const body = raw?.data ?? raw;

    const items: any[] = [body, body?.data, body?.items, body?.records, body?.result]
      .find(Array.isArray) ?? [];

    const total = Number(
      body?.totalCount ??
      body?.totalRecords ??
      body?.total ??
      items.length
    );

    return { items, total };
  }

  private mapHistoryRow(item: any, index: number): any {
    const errors = this.normalizeErrors(item?.errors);
    const status = String(item?.status ?? '').toLowerCase();

    const invalid =
      ['rejected', 'invalid', 'failed'].includes(status) ||
      item?.isValid === false ||
      item?.success === false ||
      errors.length > 0;

    return {
      id: String(item?.auditLogId ?? item?.id ?? item?.committeeId ?? ''),
      index: this.first() + index + 1,

      committeeNumber: String(
        item?.committeeNumber ??
        item?.committeeCode ??
        item?.auditLogId ??
        item?.id ??
        ''
      ),

      schoolName: String(
        item?.schoolName ?? item?.committeeName ?? item?.fileName ?? ''
      ),

      educationalAdministration: String(
        item?.educationalAdministration ?? item?.administrationName ?? ''
      ),

      bookletCount: Number(
        item?.bookletCount ?? item?.booklets ?? item?.rowsCount ?? 0
      ),

      status: invalid ? 'invalid' : 'valid',
      transferred: item?.isTransferred === true || item?.transferred === true,

      governorate: String(item?.governorateCode ?? item?.governorate ?? ''),
      subject: String(item?.subjectCode ?? item?.subject ?? ''),
      round: String(item?.roundCode ?? item?.round ?? ''),
      educationalStage: String(
        item?.educationalStageCode ?? item?.educationalStage ?? ''
      ),

      fileName: String(item?.fileName ?? ''),
      errors
    } as any;
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
    const searchValue = value ?? '';
    const trimmedValue = searchValue.trim();

    this.searchTerm.set(searchValue);
    this.first.set(0);

    // إلغاء أي عملية بحث سابقة لم يتم تنفيذها
    clearTimeout(this.searchTimer);

    // أقل من 3 حروف: لا نرسل طلب بحث جديد
    if (trimmedValue.length > 0 && trimmedValue.length < 3) {
      return;
    }

    // انتظار 400 مللي ثانية بعد توقف المستخدم عن الكتابة
    this.searchTimer = setTimeout(
      () => this.loadHistory(),
      trimmedValue.length >= 3 ? 400 : 0
    );
  }

  // =========================================================
  // ERRORS DIALOG (import errors + row errors)
  // =========================================================

  readonly importErrorsDialogVisible = signal(false);
  readonly importErrors = signal<string[]>([]);
  readonly errorsFileName = signal('');

  openErrors(row: any): void {
    this.importErrors.set(row.errors);
    this.errorsFileName.set(row.fileName || row.schoolName);
    this.importErrorsDialogVisible.set(true);
  }

  closeImportErrors(): void {
    this.importErrorsDialogVisible.set(false);
  }

  private showImportErrors(errors: string[]): void {
    const list = errors.length
      ? errors
      : ['تعذّر استيراد الملف. يرجى مراجعة البيانات والمحاولة مرة أخرى.'];

    this.importErrors.set(list);
    this.errorsFileName.set('');
    this.importErrorsDialogVisible.set(true);

    this.toast.add({
      key: 'import-summary',
      severity: 'error',
      summary: 'فشل استيراد الملف',
      detail: `تم اكتشاف ${list.length} أخطاء. افتحي تفاصيل الأخطاء لمراجعتها.`,
      life: 5000
    });
  }

  // =========================================================
  // TRANSFER TO PLANNING
  // =========================================================

  readonly transferDialogVisible = signal(false);
  readonly transferRow = signal<any | null>(null);
  readonly transferring = signal(false);

  openTransfer(row: any): void {
    this.transferRow.set(row);
    this.transferDialogVisible.set(true);
  }

  closeTransfer(): void {
    if (this.transferring()) {
      return;
    }

    this.transferDialogVisible.set(false);
    this.transferRow.set(null);
  }

  confirmTransfer(): void {
    const row = this.transferRow();

    if (!row || this.transferring()) {
      return;
    }

    this.transferring.set(true);

    // this.committeeService.transferToPlanning(row.id).subscribe({
    //   next: () => {
    //     this.transferring.set(false);
    //     this.closeTransfer();

    //     this.toast.add({
    //       severity: 'success',
    //       summary: 'تم التحويل',
    //       detail: `تم تحويل اللجنة رقم ${row.committeeNumber} إلى مستخدم Planning بنجاح.`,
    //       life: 3500
    //     });

    //     this.loadHistory();
    //   },
    //   error: err => {
    //     console.error('Transfer error:', err);
    //     this.transferring.set(false);

    //     this.toast.add({
    //       severity: 'error',
    //       summary: 'تعذّر تحويل اللجنة',
    //       detail: this.extractErrorMessage(err),
    //       life: 5000
    //     });
    //   }
    // });
  }

  // =========================================================
  // FILE UPLOAD
  // =========================================================

  private selectedFile: File | null = null;

  readonly uploadedFile = signal<{ name: string; sizeKb: number } | null>(null);
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

    if (!this.saving()) {
      this.isDragOver.set(true);
    }
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

    const file = event.dataTransfer?.files?.[0];

    if (file && !this.saving()) {
      this.processSelectedFile(file);
    }
  }

  private processSelectedFile(file: File): void {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (!extension || !['xlsx', 'xls'].includes(extension)) {
      this.resetFile();

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

    this.resetFile();
    this.saveError.set('');
  }

  private resetFile(): void {
    this.selectedFile = null;
    this.uploadedFile.set(null);
    this.filesGenerated.set(false);
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

        // 2xx لا يعني بالضرورة نجاح الاستيراد
        const responseErrors = this.normalizeErrors(
          (response as any)?.errors ?? (response as any)?.data?.errors
        );

        if ((response as any)?.success === false || responseErrors.length > 0) {
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

        const errors = this.extractApiErrors(err);

        this.saveError.set(
          errors.length > 1
            ? `فشل استيراد الملف، وتم اكتشاف ${errors.length} أخطاء.`
            : errors[0]
        );

        this.showImportErrors(errors);

        // تحديث الجدول ليظهر الاستيراد المرفوض
        this.first.set(0);
        this.loadHistory();
      }
    });
  }

  // =========================================================
  // ERROR HELPERS
  // =========================================================

  private normalizeErrors(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(item => String(item ?? '').trim()).filter(Boolean);
    }

    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }

    return [];
  }

  private extractApiErrors(err: any): string[] {
    const body = err?.error;

    const errors = this.normalizeErrors(
      body?.errors ?? body?.Errors ?? body?.data?.errors
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

  private extractErrorMessage(err: any): string {
    return this.extractApiErrors(err)[0];
  }

  // =========================================================
  // DISPLAY LABELS
  // =========================================================

  private labelOf(options: SelectOption[], value: string): string {
    return options.find(item => item.value === value)?.label ?? value;
  }

  getGovernorateLabel(value: string): string {
    return this.labelOf(this.governorates(), value);
  }

  getRoundLabel(value: string): string {
    return this.labelOf(this.rounds(), value);
  }

  getEduccationalStageLabel(value: string): string {
    return this.labelOf(this.educationalStages(), value);
  }

  getSubjectLabel(value: string): string {
    return this.labelOf(this.subjects(), value);
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
      '\uFEFF' + reportRows.map(row => row.map(csvCell).join(',')).join('\r\n');

    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    );

    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `تقرير-اللجان-${new Date().toISOString().slice(0, 10)}.csv`;

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