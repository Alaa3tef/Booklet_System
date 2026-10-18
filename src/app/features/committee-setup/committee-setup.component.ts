
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import {
  CommitteeRow,
  SelectOption,
  StepItem
} from '../../core/models/committee.model';

import { CommitteeService } from './service/committee-service';

interface CommitteeTableRow extends CommitteeRow {
  governorate: string;
  subject: string;
}

interface EducationalAdministration {
  label: string;
  value: string;
  governorate: string;
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
    InputTextModule
  ],
  templateUrl: './committee-setup.component.html',
  styleUrl: './committee-setup.component.scss'
})
export default class CommitteeSetupComponent {

  private readonly committeeService = inject(CommitteeService);
  private readonly toast = inject(MessageService);

  // =========================================================
  // STEPS
  // =========================================================

  readonly steps = signal<StepItem[]>([
    {
      order: 1,
      label: 'اختيار المحافظة والمادة',
      state: 'active'
    },
    {
      order: 2,
      label: 'رفع ملف اللجان',
      state: 'pending'
    },
    {
      order: 3,
      label: 'مراجعة البيانات',
      state: 'pending'
    },
    {
      order: 4,
      label: 'إنشاء الملفات',
      state: 'pending'
    }
  ]);

  // =========================================================
  // SETUP OPTIONS
  // =========================================================

  readonly rounds: SelectOption[] = [
    { label: 'الدور الأول', value: 'round1' },
    { label: 'الدور الثاني', value: 'round2' }
  ];

  readonly subjects: SelectOption[] = [
    { label: 'اللغة العربية', value: 'arabic' },
    { label: 'اللغة الإنجليزية', value: 'english' },
    { label: 'الرياضيات', value: 'math' },
    { label: 'العلوم', value: 'science' }
  ];

  readonly governorates: SelectOption[] = [
    { label: 'القاهرة', value: 'cairo' },
    { label: 'الجيزة', value: 'giza' },
    { label: 'الإسكندرية', value: 'alexandria' },
    { label: 'الدقهلية', value: 'dakahlia' }
  ];

  selectedRound: string = 'round1';
  selectedSubject: string = 'arabic';
  selectedGovernorate: string = 'cairo';
  selectedYear = 27;

  // =========================================================
  // EDUCATIONAL ADMINISTRATIONS
  // Replace this sample data with your API response.
  // =========================================================

  readonly administrations: EducationalAdministration[] = [
    {
      label: 'شرق القاهرة',
      value: 'شرق القاهرة',
      governorate: 'cairo'
    },
    {
      label: 'غرب القاهرة',
      value: 'غرب القاهرة',
      governorate: 'cairo'
    },
    {
      label: 'روض الفرج',
      value: 'روض الفرج',
      governorate: 'cairo'
    },
    {
      label: 'شبرا',
      value: 'شبرا',
      governorate: 'cairo'
    },
    {
      label: 'مصر الجديدة',
      value: 'مصر الجديدة',
      governorate: 'cairo'
    },
    {
      label: 'شمال الجيزة',
      value: 'شمال الجيزة',
      governorate: 'giza'
    },
    {
      label: 'جنوب الجيزة',
      value: 'جنوب الجيزة',
      governorate: 'giza'
    },
    {
      label: 'شرق الإسكندرية',
      value: 'شرق الإسكندرية',
      governorate: 'alexandria'
    },
    {
      label: 'غرب الإسكندرية',
      value: 'غرب الإسكندرية',
      governorate: 'alexandria'
    },
    {
      label: 'شرق المنصورة',
      value: 'شرق المنصورة',
      governorate: 'dakahlia'
    },
    {
      label: 'غرب المنصورة',
      value: 'غرب المنصورة',
      governorate: 'dakahlia'
    }
  ];

  // =========================================================
  // TABLE FILTERS
  // =========================================================

  readonly searchTerm = signal('');
  
readonly isDragOver = signal(false);

  readonly filterGovernorate = signal<string | null>(null);
  readonly filterSubject = signal<string | null>(null);
  readonly filterAdministration = signal<string | null>(null);

  readonly first = signal(0);
  readonly pageSize = signal(5);

readonly currentPage = computed(
  () => Math.floor(this.first() / this.pageSize()) + 1
);

readonly totalPages = computed(() =>
  Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize()))
);

readonly visiblePages = computed<(number | 'dots')[]>(() => {
  const total = this.totalPages();
  const current = this.currentPage();

  // لو 3 صفحات أو أقل، اعرضيهم كلهم
  if (total <= 3) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // أول 3 صفحات
  if (current <= 2) {
    return [1, 2, 3, 'dots', total];
  }

  // آخر 3 صفحات
  if (current >= total - 1) {
    return [1, 'dots', total - 2, total - 1, total];
  }

  // الصفحات في المنتصف
  return [1, 'dots', current, 'dots', total];
});

goToPage(page: number): void {
  const total = this.totalPages();

  if (page < 1 || page > total) return;

  this.first.set((page - 1) * this.pageSize());
}

changePageSize(size: number): void {
  this.pageSize.set(size);
  this.first.set(0);
}
  readonly administrationOptions = computed<SelectOption[]>(() => {
    const governorate = this.filterGovernorate();

    if (!governorate) {
      return [];
    }

    return this.administrations
      .filter(item => item.governorate === governorate)
      .map(item => ({
        label: item.label,
        value: item.value
      }));
  });

  // =========================================================
  // TABLE DATA
  // Sample data: replace with actual API data.
  // =========================================================

  readonly rows = signal<CommitteeTableRow[]>([
    {
      index: 1,
      committeeNumber: '101',
      schoolName: 'مدرسة مصطفى كامل',
      educationalAdministration: 'شرق القاهرة',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'arabic'
    },
    {
      index: 2,
      committeeNumber: '102',
      schoolName: 'مدرسة روض الفرج',
      educationalAdministration: 'روض الفرج',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'arabic'
    },
    {
      index: 3,
      committeeNumber: '103',
      schoolName: 'مدرسة العباسية',
      educationalAdministration: 'غرب القاهرة',
      bookletCount: 25,
      status: 'valid',
      governorate: 'cairo',
      subject: 'english'
    },
    {
      index: 4,
      committeeNumber: '104',
      schoolName: 'مدرسة شبرا الثانوية',
      educationalAdministration: 'شبرا',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'math'
    },
    {
      index: 5,
      committeeNumber: '105',
      schoolName: 'مدرسة الحلمية',
      educationalAdministration: 'مصر الجديدة',
      bookletCount: 30,
      status: 'invalid',
      governorate: 'cairo',
      subject: 'science'
    },
    {
      index: 6,
      committeeNumber: '201',
      schoolName: 'مدرسة الجيزة الثانوية',
      educationalAdministration: 'شمال الجيزة',
      bookletCount: 25,
      status: 'valid',
      governorate: 'giza',
      subject: 'arabic'
    },
    {
      index: 7,
      committeeNumber: '301',
      schoolName: 'مدرسة المنصورة الرسمية',
      educationalAdministration: 'شرق المنصورة',
      bookletCount: 20,
      status: 'valid',
      governorate: 'dakahlia',
      subject: 'math'
    },
     {
      index: 1,
      committeeNumber: '101',
      schoolName: 'مدرسة مصطفى كامل',
      educationalAdministration: 'شرق القاهرة',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'arabic'
    },
    {
      index: 2,
      committeeNumber: '102',
      schoolName: 'مدرسة روض الفرج',
      educationalAdministration: 'روض الفرج',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'arabic'
    },
    {
      index: 3,
      committeeNumber: '103',
      schoolName: 'مدرسة العباسية',
      educationalAdministration: 'غرب القاهرة',
      bookletCount: 25,
      status: 'valid',
      governorate: 'cairo',
      subject: 'english'
    },
    {
      index: 4,
      committeeNumber: '104',
      schoolName: 'مدرسة شبرا الثانوية',
      educationalAdministration: 'شبرا',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'math'
    },
    {
      index: 5,
      committeeNumber: '105',
      schoolName: 'مدرسة الحلمية',
      educationalAdministration: 'مصر الجديدة',
      bookletCount: 30,
      status: 'invalid',
      governorate: 'cairo',
      subject: 'science'
    },
    {
      index: 6,
      committeeNumber: '201',
      schoolName: 'مدرسة الجيزة الثانوية',
      educationalAdministration: 'شمال الجيزة',
      bookletCount: 25,
      status: 'valid',
      governorate: 'giza',
      subject: 'arabic'
    },
    {
      index: 7,
      committeeNumber: '301',
      schoolName: 'مدرسة المنصورة الرسمية',
      educationalAdministration: 'شرق المنصورة',
      bookletCount: 20,
      status: 'valid',
      governorate: 'dakahlia',
      subject: 'math'
    },
    {
      index: 1,
      committeeNumber: '101',
      schoolName: 'مدرسة مصطفى كامل',
      educationalAdministration: 'شرق القاهرة',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'arabic'
    },
    {
      index: 2,
      committeeNumber: '102',
      schoolName: 'مدرسة روض الفرج',
      educationalAdministration: 'روض الفرج',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'arabic'
    },
    {
      index: 3,
      committeeNumber: '103',
      schoolName: 'مدرسة العباسية',
      educationalAdministration: 'غرب القاهرة',
      bookletCount: 25,
      status: 'valid',
      governorate: 'cairo',
      subject: 'english'
    },
    {
      index: 4,
      committeeNumber: '104',
      schoolName: 'مدرسة شبرا الثانوية',
      educationalAdministration: 'شبرا',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'math'
    },
    {
      index: 5,
      committeeNumber: '105',
      schoolName: 'مدرسة الحلمية',
      educationalAdministration: 'مصر الجديدة',
      bookletCount: 30,
      status: 'invalid',
      governorate: 'cairo',
      subject: 'science'
    },
    {
      index: 6,
      committeeNumber: '201',
      schoolName: 'مدرسة الجيزة الثانوية',
      educationalAdministration: 'شمال الجيزة',
      bookletCount: 25,
      status: 'valid',
      governorate: 'giza',
      subject: 'arabic'
    },
    {
      index: 7,
      committeeNumber: '301',
      schoolName: 'مدرسة المنصورة الرسمية',
      educationalAdministration: 'شرق المنصورة',
      bookletCount: 20,
      status: 'valid',
      governorate: 'dakahlia',
      subject: 'math'
    },
     {
      index: 1,
      committeeNumber: '101',
      schoolName: 'مدرسة مصطفى كامل',
      educationalAdministration: 'شرق القاهرة',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'arabic'
    },
    {
      index: 2,
      committeeNumber: '102',
      schoolName: 'مدرسة روض الفرج',
      educationalAdministration: 'روض الفرج',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'arabic'
    },
    {
      index: 3,
      committeeNumber: '103',
      schoolName: 'مدرسة العباسية',
      educationalAdministration: 'غرب القاهرة',
      bookletCount: 25,
      status: 'valid',
      governorate: 'cairo',
      subject: 'english'
    },
    {
      index: 4,
      committeeNumber: '104',
      schoolName: 'مدرسة شبرا الثانوية',
      educationalAdministration: 'شبرا',
      bookletCount: 20,
      status: 'valid',
      governorate: 'cairo',
      subject: 'math'
    },
    {
      index: 5,
      committeeNumber: '105',
      schoolName: 'مدرسة الحلمية',
      educationalAdministration: 'مصر الجديدة',
      bookletCount: 30,
      status: 'invalid',
      governorate: 'cairo',
      subject: 'science'
    },
    {
      index: 6,
      committeeNumber: '201',
      schoolName: 'مدرسة الجيزة الثانوية',
      educationalAdministration: 'شمال الجيزة',
      bookletCount: 25,
      status: 'valid',
      governorate: 'giza',
      subject: 'arabic'
    },
    {
      index: 7,
      committeeNumber: '301',
      schoolName: 'مدرسة المنصورة الرسمية',
      educationalAdministration: 'شرق المنصورة',
      bookletCount: 20,
      status: 'valid',
      governorate: 'dakahlia',
      subject: 'math'
    },
  ]);

  readonly paginatedRows = computed<CommitteeTableRow[]>(() => {
  const rows = this.filteredRows();
  const start = this.first();
  const end = start + this.pageSize();

  return rows.slice(start, end);
});
  // =========================================================
  // COMPUTED TABLE RESULTS
  // =========================================================

  readonly filteredRows = computed<CommitteeTableRow[]>(() => {
    const search = this.searchTerm().trim().toLocaleLowerCase();
    const governorate = this.filterGovernorate();
    const subject = this.filterSubject();
    const administration = this.filterAdministration();

    return this.rows().filter(row => {
      const matchesSearch =
        !search ||
        String(row.committeeNumber)
          .toLocaleLowerCase()
          .includes(search) ||
        String(row.schoolName)
          .toLocaleLowerCase()
          .includes(search);

      const matchesGovernorate =
        !governorate || row.governorate === governorate;

      const matchesSubject =
        !subject || row.subject === subject;

      const matchesAdministration =
        !administration ||
        row.educationalAdministration === administration;

      return (
        matchesSearch &&
        matchesGovernorate &&
        matchesSubject &&
        matchesAdministration
      );
    });
  });

  readonly totalCommittees = computed(
    () => this.rows().length
  );

  readonly totalBooklets = computed(
    () => this.rows().reduce(
      (sum, row) => sum + Number(row.bookletCount || 0),
      0
    )
  );

  readonly filteredTotalCommittees = computed(
    () => this.filteredRows().length
  );

  readonly filteredTotalBooklets = computed(
    () => this.filteredRows().reduce(
      (sum, row) => sum + Number(row.bookletCount || 0),
      0
    )
  );

  // =========================================================
  // FILE UPLOAD STATE
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

  // Allow selecting the same file again.
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

  // Avoid removing the active state when moving between
  // child elements inside the drop area.
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

  if (!file) {
    return;
  }

  this.processSelectedFile(file);
}

private processSelectedFile(file: File): void {
  const extension = file.name
    .split('.')
    .pop()
    ?.toLowerCase();

  if (!extension || !['xlsx', 'xls'].includes(extension)) {
    this.selectedFile = null;
    this.uploadedFile.set(null);
    this.filesGenerated.set(false);
    this.saveError.set(
      'صيغة الملف غير مدعومة. اختاري ملف Excel بصيغة XLS أو XLSX.'
    );

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
  // UPLOAD / CREATE FILES
  // Keeps the existing service signature.
  // =========================================================

  createFiles(): void {
    if (!this.selectedFile || this.saving()) {
      return;
    }

    if (
      !this.selectedGovernorate ||
      !this.selectedSubject ||
      !this.selectedRound ||
      !Number.isInteger(Number(this.selectedYear)) ||
      Number(this.selectedYear) < 1 ||
      Number(this.selectedYear) > 99
    ) {
      this.saveError.set(
        'يرجى مراجعة بيانات المحافظة والمادة والدور والسنة.'
      );
      return;
    }

    this.saving.set(true);
    this.saveError.set('');
    this.filesGenerated.set(false);

    this.committeeService
      .uploadCommittees(
        this.selectedFile,
        this.selectedGovernorate,
        this.selectedSubject,
        this.selectedRound
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.filesGenerated.set(true);

          this.toast.add({
            severity: 'success',
            summary: 'تمت العملية بنجاح',
            detail: 'تم رفع الملف وتنفيذ الطلب بنجاح.',
            life: 3500
          });
        },

        error: err => {
          console.error('Upload error:', err);

          this.saving.set(false);
          this.filesGenerated.set(false);

          this.saveError.set(
            this.extractErrorMessage(err)
          );

          this.toast.add({
            severity: 'error',
            summary: 'تعذّر تنفيذ العملية',
            detail: this.saveError(),
            life: 5000
          });
        }
      });
  }

  private extractErrorMessage(err: any): string {
    const body = err?.error;

    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    return (
      body?.message ||
      body?.Message ||
      body?.detail ||
      err?.message ||
      'تعذّر رفع الملف. يرجى المحاولة مرة أخرى.'
    );
  }

  // =========================================================
  // TABLE FILTER HANDLERS
  // =========================================================

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
    this.resetPage();
  }

  onFilterGovernorateChange(value: string | null): void {
    this.filterGovernorate.set(value);
    this.filterAdministration.set(null);
    this.resetPage();
  }

  onFilterSubjectChange(value: string | null): void {
    this.filterSubject.set(value);
    this.resetPage();
  }

  onFilterAdministrationChange(value: string | null): void {
    this.filterAdministration.set(value);
    this.resetPage();
  }

  resetTableFilters(): void {
    this.searchTerm.set('');
    this.filterGovernorate.set(null);
    this.filterSubject.set(null);
    this.filterAdministration.set(null);
    this.resetPage();
  }

  private resetPage(): void {
    this.first.set(0);
  }

  onPage(event: { first?: number; rows?: number }): void {
    this.first.set(event.first ?? 0);

    if (event.rows) {
      this.pageSize.set(event.rows);
    }
  }

  // =========================================================
  // DISPLAY LABELS
  // =========================================================

  getGovernorateLabel(value: string): string {
    return this.governorates.find(
      item => item.value === value
    )?.label ?? value;
  }

  getSubjectLabel(value: string): string {
    return this.subjects.find(
      item => item.value === value
    )?.label ?? value;
  }

  // =========================================================
  // EXPORT FILTERED REPORT TO CSV / EXCEL
  // Exports every matching row, not only the visible page.
  // =========================================================

  exportReport(): void {
    const data = this.filteredRows();

    if (!data.length) {
      this.toast.add({
        severity: 'warn',
        summary: 'لا توجد بيانات',
        detail: 'لا توجد نتائج مطابقة للفلاتر لتصديرها.',
        life: 3000
      });

      return;
    }

    const csvCell = (value: unknown): string => {
      const text = String(value ?? '');

      return `"${text.replace(/"/g, '""')}"`;
    };

    const selectedGovernorate = this.filterGovernorate()
      ? this.getGovernorateLabel(this.filterGovernorate()!)
      : 'كل المحافظات';

    const selectedSubject = this.filterSubject()
      ? this.getSubjectLabel(this.filterSubject()!)
      : 'كل المواد';

    const selectedAdministration =
      this.filterAdministration() ?? 'كل الإدارات';

    const reportRows: unknown[][] = [
      ['تقرير بيانات اللجان'],
      ['المحافظة', selectedGovernorate],
      ['المادة', selectedSubject],
      ['الإدارة التعليمية', selectedAdministration],
      ['عبارة البحث', this.searchTerm() || 'بدون بحث'],
      ['عدد اللجان', data.length],
      [
        'إجمالي البوكليتات',
        data.reduce(
          (sum, row) => sum + Number(row.bookletCount || 0),
          0
        )
      ],
      ['تاريخ التصدير', new Date().toLocaleString('ar-EG')],
      [],
      [
        'م',
        'رقم اللجنة',
        'اسم اللجنة / المدرسة',
        'المحافظة',
        'المادة',
        'الإدارة التعليمية',
        'عدد البوكليتات',
        'الحالة'
      ],
      ...data.map((row, index) => [
        index + 1,
        row.committeeNumber,
        row.schoolName,
        this.getGovernorateLabel(row.governorate),
        this.getSubjectLabel(row.subject),
        row.educationalAdministration,
        row.bookletCount,
        row.status === 'valid' ? 'صحيح' : 'خطأ'
      ])
    ];

    const csv =
      '\uFEFF' +
      reportRows
        .map(row => row.map(csvCell).join(','))
        .join('\r\n');

    const blob = new Blob(
      [csv],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    const date = new Date().toISOString().slice(0, 10);

    anchor.href = url;
    anchor.download = `تقرير-اللجان-${date}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    this.toast.add({
      severity: 'success',
      summary: 'تم تصدير التقرير',
      detail: `تم تصدير ${data.length} لجنة وفقًا للفلاتر الحالية.`,
      life: 3000
    });
  }
}
