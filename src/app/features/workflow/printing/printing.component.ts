
import { CommonModule } from '@angular/common';
import {
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { SelectOption } from '../../../core/models/committee.model';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { Lookups } from '../../../shared/services/lookups';

const DONE = 'تم الانتهاء';
const REJECTED = 'مرفوض';
const PENDING = 'قيد الطباعة';

interface ReviewUser {
  id: number;
  name: string;
  role: string;
}

interface PrintingRow extends WorkflowStatusRow {
  id: number;
  committeeNumber: string;
  governorate: string;
}

@Component({
  selector: 'app-printing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    TextareaModule,
    TooltipModule,
    WorkflowStepLayoutComponent
  ],
  templateUrl: './printing.component.html',
  styleUrl: './printing.component.scss',
  encapsulation: ViewEncapsulation.None
})
export default class PrintingComponent implements OnInit {
  private readonly lookupsService = inject(Lookups);
  private readonly committeeInput$ = new Subject<string>();

  // ==========================================
  // Page configuration
  // ==========================================

  readonly essentials = [
    'البحث بالمحافظة',
    'البحث بالمادة',
    'البحث برقم اللجنة',
    'تسجيل انتهاء الطباعة'
  ];

  readonly reviewUsers: ReviewUser[] = [
    { id: 1, name: 'أحمد محمد', role: 'مراجع أول' },
    { id: 2, name: 'محمد علي', role: 'مراجع جودة' },
    { id: 3, name: 'سارة أحمد', role: 'مراجع محتوى' },
    { id: 4, name: 'محمود حسن', role: 'مراجع نهائي' }
  ];

  readonly pageSizes = [
    { label: '6', value: 6 },
    { label: '12', value: 12 },
    { label: '24', value: 24 }
  ];

  // ==========================================
  // Lookups from API
  // ==========================================

  readonly governorates = signal<SelectOption[]>([]);
  readonly subjects = signal<SelectOption[]>([]);

  readonly governoratesLoading = signal(false);
  readonly subjectsLoading = signal(false);

  readonly governoratesError = signal(false);
  readonly subjectsError = signal(false);

  ngOnInit(): void {
    this.loadGovernorates();
    this.loadSubjects();
  }

  /**
   * GET api/Governorates
   */
  loadGovernorates(): void {
    this.governoratesLoading.set(true);
    this.governoratesError.set(false);

    this.lookupsService.getLookupGovernorateData().subscribe({
      next: (response: any) => {
        const options = this.normalizeLookupOptions(response, {
          nameKeys: [
            'governorateName',
            'governorateNameAr',
            'nameAr',
            'arabicName',
            'governorate',
            'name',
            'title',
            'label'
          ],
          idKeys: [
            'governorateId',
            'governorateID',
            'id',
            'value'
          ]
        });

        this.governorates.set(options);
        this.governoratesLoading.set(false);

        this.rebuildRows();
      },
      error: (error: unknown) => {
        console.error('Failed to load governorates:', error);
        this.governoratesError.set(true);
        this.governoratesLoading.set(false);
      }
    });
  }

  /**
   * GET api/Subjects
   */
  loadSubjects(): void {
    this.subjectsLoading.set(true);
    this.subjectsError.set(false);

    this.lookupsService.getLookupSubjectData().subscribe({
      next: (response: any) => {
        const options = this.normalizeLookupOptions(response, {
          nameKeys: [
            'subjectName',
            'subjectNameAr',
            'nameAr',
            'arabicName',
            'subject',
            'name',
            'title',
            'label'
          ],
          idKeys: [
            'subjectId',
            'subjectID',
            'id',
            'value'
          ]
        });

        this.subjects.set(options);
        this.subjectsLoading.set(false);

        this.rebuildRows();
      },
      error: (error: unknown) => {
        console.error('Failed to load subjects:', error);
        this.subjectsError.set(true);
        this.subjectsLoading.set(false);
      }
    });
  }

  /**
   * يحول استجابة الـ API إلى SelectOption.
   * يدعم Array مباشرة أو Array داخل data/items/result.
   */
  private normalizeLookupOptions(
    response: any,
    config: {
      nameKeys: string[];
      idKeys: string[];
    }
  ): SelectOption[] {
    const items = this.extractLookupArray(response);

    const mapped = items
      .map((item: any): SelectOption | null => {
        if (
          typeof item === 'string' ||
          typeof item === 'number'
        ) {
          const value = String(item).trim();

          return value
            ? { label: value, value }
            : null;
        }

        if (!item || typeof item !== 'object') {
          return null;
        }

        let label = '';

        for (const key of config.nameKeys) {
          const candidate = item[key];

          if (
            candidate !== null &&
            candidate !== undefined &&
            String(candidate).trim() !== ''
          ) {
            label = String(candidate).trim();
            break;
          }
        }

        if (!label) {
          return null;
        }

        let value = label;

for (const key of config.idKeys) {
  const candidate = item[key];

  if (
    candidate !== null &&
    candidate !== undefined &&
    String(candidate).trim() !== ''
  ) {
    value = String(candidate);
    break;
  }
}

return { label, value };
      })
      .filter(
        (option): option is SelectOption => option !== null
      );

    // إزالة العناصر المكررة حسب القيمة
    return [
      ...new Map(
        mapped.map(option => [String(option.value), option])
      ).values()
    ];
  }

  private extractLookupArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const keys = [
      'data',
      'items',
      'result',
      'results',
      'records'
    ];

    for (const key of keys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value;
      }

      if (value && typeof value === 'object') {
        const nested = this.extractLookupArray(value);

        if (nested.length) {
          return nested;
        }
      }
    }

    return [];
  }

  // ==========================================
  // Filters
  // ==========================================

  selectedGovernorate: string | number = '';
  selectedSubject: string | number = '';
  selectedCommittee = '';

  get hasActiveFilters(): boolean {
    return !!(
      this.selectedGovernorate ||
      this.selectedSubject ||
      this.selectedCommittee.trim()
    );
  }

  // ==========================================
  // Rows
  // ==========================================

  private readonly allRows = signal<PrintingRow[]>([]);

  readonly rows = signal<PrintingRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);

  /**
   * بيانات تجريبية للبطاقات فقط.
   * أسماء المواد والمحافظات مأخوذة من الـ lookups المحملة.
   *
   * استبدلي هذه الدالة باستدعاء API اللجان عند توفر endpoint الطباعة.
   */
  private buildRowsFromLookups(): PrintingRow[] {
    const governorateOptions = this.governorates();
    const subjectOptions = this.subjects();

    if (!governorateOptions.length || !subjectOptions.length) {
      return [];
    }

    return Array.from({ length: 14 }, (_, i) => {
      const status =
        i % 7 === 5
          ? DONE
          : i % 7 === 6
            ? REJECTED
            : PENDING;

      const governorate =
        governorateOptions[i % governorateOptions.length];

      const subject =
        subjectOptions[i % subjectOptions.length];

      return {
        id: i + 1,
        index: i + 1,
        subject: subject.label,
        governorate: governorate.label,
        committeeNumber: String(100 + i),
        status,
        statusTone:
          status === DONE
            ? 'success'
            : status === REJECTED
              ? 'danger'
              : 'warning',
        rejectionReason:
          status === REJECTED
            ? 'يوجد خطأ في ترتيب الصفحات ويجب إعادة الطباعة.'
            : ''
      } as PrintingRow;
    });
  }

  /**
   * يعاد تجهيز البيانات التجريبية بعد تحميل القائمتين.
   */
  private rebuildRows(): void {
    if (
      this.governoratesLoading() ||
      this.subjectsLoading()
    ) {
      return;
    }

    if (
      !this.governorates().length ||
      !this.subjects().length
    ) {
      this.allRows.set([]);
      this.currentPage.set(1);
      this.reload();
      return;
    }

    this.allRows.set(this.buildRowsFromLookups());
    this.currentPage.set(1);
    this.reload();
  }

  // ==========================================
  // Filtering and pagination
  // ==========================================

  readonly pageSize = signal(6);
  readonly currentPage = signal(1);

  readonly totalPages = computed(() =>
    Math.max(
      1,
      Math.ceil(this.total() / this.pageSize())
    )
  );

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

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

  readonly paginationStart = computed(() =>
    this.total() === 0
      ? 0
      : (this.currentPage() - 1) * this.pageSize() + 1
  );

  readonly paginationEnd = computed(() =>
    Math.min(
      this.currentPage() * this.pageSize(),
      this.total()
    )
  );

  constructor() {
    this.committeeInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe(() => this.onFilterChange());
  }

  /**
   * تطبيق الفلاتر على بيانات البطاقات.
   * قيم الـ dropdown هي IDs، لكن المقارنة تتم باستخدام الاسم.
   */
  reload(): void {
    const governorateLabel = this.governorates().find(
      option =>
        String(option.value) === String(this.selectedGovernorate)
    )?.label;

    const subjectLabel = this.subjects().find(
      option =>
        String(option.value) === String(this.selectedSubject)
    )?.label;

    const committee = this.selectedCommittee.trim();

    const filtered = this.allRows().filter(row =>
      (!this.selectedGovernorate ||
        row.governorate === governorateLabel) &&
      (!this.selectedSubject ||
        row.subject === subjectLabel) &&
      (!committee ||
        row.committeeNumber.includes(committee))
    );

    const start =
      (this.currentPage() - 1) * this.pageSize();

    this.total.set(filtered.length);
    this.rows.set(
      filtered.slice(start, start + this.pageSize())
    );
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.reload();
  }

  onCommitteeInput(value: string): void {
    this.selectedCommittee = value;
    this.committeeInput$.next(value.trim());
  }

  resetFilters(): void {
    this.selectedGovernorate = '';
    this.selectedSubject = '';
    this.selectedCommittee = '';

    // إلغاء أي قيمة بحث معلقة قبل تطبيق الفلاتر الجديدة
    this.committeeInput$.next('');

    this.onFilterChange();
  }

  goToPage(page: number): void {
    if (
      page < 1 ||
      page > this.totalPages() ||
      page === this.currentPage()
    ) {
      return;
    }

    this.currentPage.set(page);
    this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.onFilterChange();
  }

  private updateRow(
    id: number | string,
    changes: Partial<PrintingRow>
  ): void {
    this.allRows.update(rows =>
      rows.map(row =>
        String(row.id) === String(id)
          ? { ...row, ...changes }
          : row
      )
    );

    this.reload();
  }

  // ==========================================
  // Card helpers
  // ==========================================

  isDone(row: WorkflowStatusRow): boolean {
    return row.status === DONE;
  }

  isRejected(row: WorkflowStatusRow): boolean {
    return row.status === REJECTED;
  }

  isPending(row: WorkflowStatusRow): boolean {
    return !this.isDone(row) && !this.isRejected(row);
  }

  statusIcon(row: WorkflowStatusRow): string {
    return this.isDone(row)
      ? 'pi-check-circle'
      : this.isRejected(row)
        ? 'pi-times-circle'
        : 'pi-clock';
  }

  // ==========================================
  // Finish printing
  // ==========================================

  selectedRow: PrintingRow | null = null;

  confirmDialogVisible = false;
  finishSubmitting = false;

  openConfirmDialog(row: WorkflowStatusRow): void {
    if (!this.isPending(row)) {
      return;
    }

    this.selectedRow = row as PrintingRow;
    this.confirmDialogVisible = true;
  }

  closeConfirmDialog(): void {
    if (this.finishSubmitting) {
      return;
    }

    this.confirmDialogVisible = false;
    this.selectedRow = null;
  }

  confirmFinish(): void {
    if (!this.selectedRow || this.finishSubmitting) {
      return;
    }

    this.finishSubmitting = true;

    // تحديث محلي مؤقت لحين ربط API تغيير الحالة.
    this.updateRow(this.selectedRow.id, {
      status: DONE,
      statusTone: 'success'
    });

    this.finishSubmitting = false;
    this.confirmDialogVisible = false;
    this.selectedRow = null;
  }

  // ==========================================
  // Reject dialog
  // ==========================================

  rejectDialogVisible = false;
  rejectReason = '';
  selectedReviewers: ReviewUser[] = [];
  rejectSubmitting = false;

  get isRejectFormValid(): boolean {
    return (
      this.rejectReason.trim().length >= 10 &&
      this.selectedReviewers.length > 0
    );
  }

  openRejectDialog(row: WorkflowStatusRow): void {
    if (!this.isPending(row)) {
      return;
    }

    this.selectedRow = row as PrintingRow;
    this.rejectReason = '';
    this.selectedReviewers = [];
    this.rejectSubmitting = false;
    this.rejectDialogVisible = true;
  }

  closeRejectDialog(): void {
    if (this.rejectSubmitting) {
      return;
    }

    this.rejectDialogVisible = false;
    this.selectedRow = null;
    this.rejectReason = '';
    this.selectedReviewers = [];
  }

  submitRejection(): void {
    if (
      !this.selectedRow ||
      !this.isRejectFormValid ||
      this.rejectSubmitting
    ) {
      return;
    }

    this.rejectSubmitting = true;

    const rowId = this.selectedRow.id;

    this.updateRow(rowId, {
      status: REJECTED,
      statusTone: 'danger',
      rejectionReason: this.rejectReason.trim()
    });

    this.rejectSubmitting = false;
    this.rejectDialogVisible = false;
    this.selectedRow = null;
    this.rejectReason = '';
    this.selectedReviewers = [];
  }

  // ==========================================
  // View rejection reason
  // ==========================================

  rejectionReasonDialogVisible = false;
  selectedRejectionReason = '';

  openRejectionReasonDialog(row: WorkflowStatusRow): void {
    if (!this.isRejected(row)) {
      return;
    }

    this.selectedRow = row as PrintingRow;

    this.selectedRejectionReason =
      row.rejectionReason?.trim() ||
      'لم يتم تسجيل سبب الرفض.';

    this.rejectionReasonDialogVisible = true;
  }

  closeRejectionReasonDialog(): void {
    this.rejectionReasonDialogVisible = false;
    this.selectedRejectionReason = '';
    this.selectedRow = null;
  }
}
