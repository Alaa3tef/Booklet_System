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

type StatusTab = 'all' | 'pending' | 'done' | 'rejected';
type Tone = 'success' | 'danger' | 'warning';

interface ReviewUser {
  id: number;
  name: string;
  role: string;
}

/** لجنة واحدة داخل مادة */
interface CommitteeRow extends WorkflowStatusRow {
  id: number;
  committeeNumber: string;
  governorate: string;
  educationId?: string;
}

/** بطاقة المادة (تجميع اللجان حسب المادة) */
interface SubjectGroup {
  key: string;
  subject: string;
  total: number;
  pending: number;
  done: number;
  rejected: number;
  progress: number; // نسبة المنتهي من الطباعة
  tone: Tone;
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

  readonly statusTabs: { key: StatusTab; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'pending', label: 'قيد الطباعة' },
    { key: 'done', label: 'تم الانتهاء' },
    { key: 'rejected', label: 'مرفوض' }
  ];

  // استخدمي نفس مصدر الإدارات التعليمية الموجود في صفحة الجودة
  educationals: SelectOption[] = [];

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

  /** GET api/Governorates */
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
          idKeys: ['governorateId', 'governorateID', 'id', 'value']
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

  /** GET api/Subjects */
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
          idKeys: ['subjectId', 'subjectID', 'id', 'value']
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

  /** يحول استجابة الـ API إلى SelectOption. */
  private normalizeLookupOptions(
    response: any,
    config: { nameKeys: string[]; idKeys: string[] }
  ): SelectOption[] {
    const items = this.extractLookupArray(response);

    const mapped = items
      .map((item: any): SelectOption | null => {
        if (typeof item === 'string' || typeof item === 'number') {
          const value = String(item).trim();
          return value ? { label: value, value } : null;
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
      .filter((option): option is SelectOption => option !== null);

    // إزالة العناصر المكررة حسب القيمة
    return [
      ...new Map(mapped.map(option => [String(option.value), option])).values()
    ];
  }

  private extractLookupArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (!response || typeof response !== 'object') {
      return [];
    }

    const keys = ['data', 'items', 'result', 'results', 'records'];

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
  selectedEducation: string | number | null = null;
  selectedCommittee = '';

  get hasActiveFilters(): boolean {
    return !!(
      this.selectedGovernorate ||
      this.selectedSubject ||
      this.selectedEducation ||
      this.selectedCommittee.trim()
    );
  }

  // ==========================================
  // Data (committees -> grouped by subject)
  // ==========================================

  /** كل اللجان (مصدر الحقيقة) */
  private readonly allRows = signal<CommitteeRow[]>([]);

  /** اللجان بعد تطبيق الفلاتر */
  readonly filteredRows = signal<CommitteeRow[]>([]);

  /** كل المواد بعد الفلاتر (قبل الـ pagination) */
  private readonly allGroups = signal<SubjectGroup[]>([]);

  /** المواد المعروضة في الصفحة الحالية */
  readonly groups = signal<SubjectGroup[]>([]);

  readonly total = signal(0);
  readonly totalCommittees = computed(() => this.filteredRows().length);
  readonly loading = signal(false);

  /**
   * بيانات تجريبية: كل مادة تحتها مجموعة لجان.
   * استبدليها باستدعاء API اللجان عند توفر endpoint الطباعة.
   */
  private buildRowsFromLookups(): CommitteeRow[] {
    const governorateOptions = this.governorates();
    const subjectOptions = this.subjects();

    if (!governorateOptions.length || !subjectOptions.length) {
      return [];
    }

    const rows: CommitteeRow[] = [];
    let id = 1;

    subjectOptions.forEach((subject, s) => {
      const count = 6 + (s % 5);

      for (let c = 0; c < count; c++) {
        const mod = (s + c) % 7;
        const status = mod === 5 ? DONE : mod === 6 ? REJECTED : PENDING;
        const governorate = governorateOptions[(s + c) % governorateOptions.length];
        const education = this.educationals.length
          ? this.educationals[(s + c) % this.educationals.length]
          : null;

        rows.push({
          id: id++,
          index: c + 1,
          subject: subject.label,
          governorate: governorate.label,
          committeeNumber: String(100 + id),
          educationId: education ? String(education.value) : undefined,
          status,
          statusTone: status === DONE ? 'success' : status === REJECTED ? 'danger' : 'warning',
          rejectionReason:
            status === REJECTED ? 'يوجد خطأ في ترتيب الصفحات ويجب إعادة الطباعة.' : ''
        } as CommitteeRow);
      }
    });

    return rows;
  }

  private rebuildRows(): void {
    if (this.governoratesLoading() || this.subjectsLoading()) {
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
    Math.max(1, Math.ceil(this.total() / this.pageSize()))
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
    this.total() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1
  );

  readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.total())
  );

  constructor() {
    this.committeeInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.onFilterChange());
  }

  /** تطبيق الفلاتر ثم تجميع اللجان حسب المادة ثم تقسيم الصفحات */
  reload(): void {
    const governorateLabel = this.governorates().find(
      o => String(o.value) === String(this.selectedGovernorate)
    )?.label;

    const subjectLabel = this.subjects().find(
      o => String(o.value) === String(this.selectedSubject)
    )?.label;

    const committee = this.selectedCommittee.trim();
    const education = this.selectedEducation ? String(this.selectedEducation) : '';

    const filtered = this.allRows().filter(
      row =>
        (!this.selectedGovernorate || row.governorate === governorateLabel) &&
        (!this.selectedSubject || row.subject === subjectLabel) &&
        (!education || row.educationId === education) &&
        (!committee || row.committeeNumber.includes(committee))
    );

    this.filteredRows.set(filtered);

    // تجميع حسب المادة
    const map = new Map<string, CommitteeRow[]>();
    for (const row of filtered) {
      const list = map.get(row.subject);
      if (list) {
        list.push(row);
      } else {
        map.set(row.subject, [row]);
      }
    }

    const groups: SubjectGroup[] = [...map.entries()].map(([subject, list]) => {
      const done = list.filter(r => r.status === DONE).length;
      const rejected = list.filter(r => r.status === REJECTED).length;
      const pending = list.length - done - rejected;

      return {
        key: subject,
        subject,
        total: list.length,
        pending,
        done,
        rejected,
        progress: Math.round((done / list.length) * 100),
        tone: pending > 0 ? 'warning' : rejected > 0 ? 'danger' : 'success'
      };
    });

    this.allGroups.set(groups);
    this.total.set(groups.length);

    const maxPage = Math.max(1, Math.ceil(groups.length / this.pageSize()));
    if (this.currentPage() > maxPage) {
      this.currentPage.set(maxPage);
    }

    const start = (this.currentPage() - 1) * this.pageSize();
    this.groups.set(groups.slice(start, start + this.pageSize()));
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
    this.selectedEducation = null;
    this.committeeInput$.next('');
    this.onFilterChange();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }

    this.currentPage.set(page);
    this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.onFilterChange();
  }

  /** تحديث أكتر من لجنة مرة واحدة */
  private updateRows(ids: Set<number>, changes: Partial<CommitteeRow>): void {
    this.allRows.update(rows =>
      rows.map(row => (ids.has(row.id) ? { ...row, ...changes } : row))
    );

    this.reload();
  }

  // ==========================================
  // Helpers
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

  trackGroup = (_: number, g: SubjectGroup) => g.key;
  trackRow = (_: number, r: CommitteeRow) => r.id;

  // ==========================================
  // Committees dialog (opens when a subject card is clicked)
  // ==========================================

  committeesDialogVisible = false;

  readonly activeSubject = signal<string | null>(null);
  readonly dialogSearch = signal('');
  readonly dialogTab = signal<StatusTab>('all');

  /** كل لجان المادة المفتوحة (بعد فلاتر الصفحة) */
  private readonly subjectRows = computed(() => {
    const subject = this.activeSubject();
    return subject ? this.filteredRows().filter(r => r.subject === subject) : [];
  });

  readonly activeGroup = computed(
    () => this.allGroups().find(g => g.key === this.activeSubject()) ?? null
  );

  readonly dialogCounts = computed(() => {
    const rows = this.subjectRows();
    const done = rows.filter(r => this.isDone(r)).length;
    const rejected = rows.filter(r => this.isRejected(r)).length;

    return {
      all: rows.length,
      pending: rows.length - done - rejected,
      done,
      rejected
    } as Record<StatusTab, number>;
  });

  /** اللجان الظاهرة في الدايلوج بعد التبويب والبحث */
  readonly dialogRows = computed(() => {
    const tab = this.dialogTab();
    const search = this.dialogSearch().trim();

    return this.subjectRows().filter(row => {
      const tabOk =
        tab === 'all' ||
        (tab === 'pending' && this.isPending(row)) ||
        (tab === 'done' && this.isDone(row)) ||
        (tab === 'rejected' && this.isRejected(row));

      return tabOk && (!search || row.committeeNumber.includes(search));
    });
  });

  openCommittees(group: SubjectGroup): void {
    this.activeSubject.set(group.key);
    this.dialogSearch.set('');
    this.dialogTab.set('all');
    this.selectedIds.set(new Set());
    this.committeesDialogVisible = true;
  }

  closeCommittees(): void {
    this.committeesDialogVisible = false;
    this.activeSubject.set(null);
    this.selectedIds.set(new Set());
  }

  // ---------- Multi selection ----------

  readonly selectedIds = signal<Set<number>>(new Set());

  readonly selectedRows = computed(() =>
    this.allRows().filter(r => this.selectedIds().has(r.id))
  );

  readonly selectedCount = computed(() => this.selectedIds().size);

  /** اللجان القابلة للاختيار (قيد الطباعة فقط) داخل العرض الحالي */
  private readonly selectableInView = computed(() =>
    this.dialogRows().filter(r => this.isPending(r))
  );

  readonly allSelected = computed(() => {
    const list = this.selectableInView();
    return list.length > 0 && list.every(r => this.selectedIds().has(r.id));
  });

  readonly someSelected = computed(
    () => this.selectedCount() > 0 && !this.allSelected()
  );

  isSelected(row: CommitteeRow): boolean {
    return this.selectedIds().has(row.id);
  }

  toggleRow(row: CommitteeRow): void {
    if (!this.isPending(row)) {
      return;
    }

    this.selectedIds.update(set => {
      const next = new Set(set);
      next.has(row.id) ? next.delete(row.id) : next.add(row.id);
      return next;
    });
  }

  toggleAll(): void {
    const list = this.selectableInView();

    this.selectedIds.update(set => {
      const next = new Set(set);

      if (this.allSelected()) {
        list.forEach(r => next.delete(r.id));
      } else {
        list.forEach(r => next.add(r.id));
      }

      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  setTab(tab: StatusTab): void {
    this.dialogTab.set(tab);
  }

  // ==========================================
  // Finish printing (bulk)
  // ==========================================

  confirmDialogVisible = false;
  finishSubmitting = false;

  openConfirmDialog(): void {
    if (!this.selectedCount()) {
      return;
    }

    this.confirmDialogVisible = true;
  }

  closeConfirmDialog(): void {
    if (this.finishSubmitting) {
      return;
    }

    this.confirmDialogVisible = false;
  }

  confirmFinish(): void {
    if (!this.selectedCount() || this.finishSubmitting) {
      return;
    }

    this.finishSubmitting = true;

    // الـ IDs اللي هتتبعت للـ API:
    const committeeIds = [...this.selectedIds()];
    console.log('Finish printing for committee ids:', committeeIds);

    // تحديث محلي مؤقت لحين ربط API تغيير الحالة (ابعتي committeeIds كـ array).
    this.updateRows(new Set(committeeIds), {
      status: DONE,
      statusTone: 'success'
    });

    this.finishSubmitting = false;
    this.confirmDialogVisible = false;
    this.clearSelection();
  }

  // ==========================================
  // Reject dialog (bulk)
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

  openRejectDialog(): void {
    if (!this.selectedCount()) {
      return;
    }

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
    this.rejectReason = '';
    this.selectedReviewers = [];
  }

  submitRejection(): void {
    if (!this.selectedCount() || !this.isRejectFormValid || this.rejectSubmitting) {
      return;
    }

    this.rejectSubmitting = true;

    const committeeIds = [...this.selectedIds()];

    this.updateRows(new Set(committeeIds), {
      status: REJECTED,
      statusTone: 'danger',
      rejectionReason: this.rejectReason.trim()
    });

    this.rejectSubmitting = false;
    this.rejectDialogVisible = false;
    this.rejectReason = '';
    this.selectedReviewers = [];
    this.clearSelection();
  }

  // ==========================================
  // View rejection reason (single committee)
  // ==========================================

  rejectionReasonDialogVisible = false;
  selectedRejectionReason = '';
  selectedRejectedRow: CommitteeRow | null = null;

  openRejectionReasonDialog(row: CommitteeRow): void {
    if (!this.isRejected(row)) {
      return;
    }

    this.selectedRejectedRow = row;
    this.selectedRejectionReason =
      row.rejectionReason?.trim() || 'لم يتم تسجيل سبب الرفض.';
    this.rejectionReasonDialogVisible = true;
  }

  closeRejectionReasonDialog(): void {
    this.rejectionReasonDialogVisible = false;
    this.selectedRejectionReason = '';
    this.selectedRejectedRow = null;
  }
}