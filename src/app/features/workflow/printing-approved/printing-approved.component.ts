
import {
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';

import { MessageService } from 'primeng/api';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { Lookups } from '../../../shared/services/lookups';

import {
  PrintingApprovalService,
  PendingBatchSummary,
  PendingBatchDetails
} from './service/printing-approval';


interface ReviewUser {
  id: number;
  name: string;
  role: string;
  avatar?: string;
}

interface SelectOption {
  label: string;
  value: string | number;
}

type FilterKey = 'governorate' | 'subject';

type StepState =
  | 'done'
  | 'current'
  | 'pending'
  | 'rejected';

type StatusTone =
  | 'warning'
  | 'success'
  | 'danger';


/** كارد واحد = batch واحد (محافظة + مادة + دور) */
interface ApprovalRow {
  index: number;
  batchId: number;
  displayLabel: string;
  year: number | null;
  roundCode: string;
  roundName: string;
  governorateName: string;
  subjectName: string;
  committeeCount: number | null;
  requiredBookletTotal: number | null;
  reserveBookletTotal: number | null;
  expectedBoxCount: number | null;
  detailsFailed: boolean;
  status: string;
  statusTone: StatusTone;
  rejectionReason?: string;
}

const ST_PENDING = 'بانتظار الاعتماد';
const ST_READY = 'جاهز للطباعة';
const ST_REJECTED = 'مرفوض';


/** استخراج الـ array من استجابات الـ API المختلفة */
function extractList(res: any): any[] {

  if (Array.isArray(res)) {
    return res;
  }

  if (Array.isArray(res?.data)) {
    return res.data;
  }

  if (Array.isArray(res?.data?.data)) {
    return res.data.data;
  }

  return [];
}


/** توحيد الكتابة العربية */
function norm(value: string | null | undefined): string {

  return (value ?? '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}


@Component({
  selector: 'app-printing-approved',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,

    SelectModule,
    InputTextModule,
    MultiSelectModule,

    DialogModule,
    ButtonModule,
    TextareaModule,
    TooltipModule,
    ToastModule,

    WorkflowStepLayoutComponent
  ],

  templateUrl: './printing-approved.component.html',
  styleUrl: './printing-approved.component.scss'
})
export default class PrintingApprovedComponent implements OnInit {

  private readonly lookupService = inject(Lookups);

  private readonly approvalService =
    inject(PrintingApprovalService);

  private readonly messageService =
    inject(MessageService);


  readonly essentials = [
    'البحث بالمحافظة',
    'البحث بالمادة',
    'اعتماد المادة للطباعة'
  ];


  // ==========================================
  // INIT
  // ==========================================

  ngOnInit(): void {

    this.loadLookups();

    this.loadBatches();
  }


  // ==========================================
  // LOOKUPS
  // ==========================================

  readonly governorates = signal<SelectOption[]>([
    { label: 'كل المحافظات', value: 'all' }
  ]);

  readonly subjects = signal<SelectOption[]>([
    { label: 'كل المواد', value: 'all' }
  ]);


  loadLookups(): void {

    forkJoin({
      governorates:
        this.lookupService.getLookupGovernorateData(),

      subjects:
        this.lookupService.getLookupSubjectData()

    }).subscribe({

      next: (res: any) => {

        const governoratesList =
          extractList(res.governorates);

        const subjectsList =
          extractList(res.subjects);


        /** إزالة التكرار من القوائم */
        const uniqueOptions = (
          list: any[]
        ): SelectOption[] => {

          const seen = new Set<string>();

          const result: SelectOption[] = [];

          for (const item of list) {

            const label = String(
              item.nameAr ?? item.name ?? ''
            ).trim();

            const key = norm(label);

            if (!label || seen.has(key)) {
              continue;
            }

            seen.add(key);

            result.push({
              label,
              value: item.id
            });
          }

          return result.sort(
            (a, b) => a.label.localeCompare(b.label, 'ar')
          );
        };


        this.governorates.set([
          { label: 'كل المحافظات', value: 'all' },
          ...uniqueOptions(governoratesList)
        ]);

        this.subjects.set([
          { label: 'كل المواد', value: 'all' },
          ...uniqueOptions(subjectsList)
        ]);

      },

      error: err => {

        console.error('Error loading lookups:', err);

        this.messageService.add({
          severity: 'error',
          summary: 'خطأ',
          life: 3000,
          detail:
            err.error?.message ||
            'فشل تحميل بيانات القوائم'
        });

      }

    });

  }


  // ==========================================
  // REVIEW USERS
  // ==========================================

  readonly reviewUsers: ReviewUser[] = [

    {
      id: 1,
      name: 'أحمد محمد',
      role: 'مراجع أول'
    },

    {
      id: 2,
      name: 'محمد علي',
      role: 'مراجع جودة'
    },

    {
      id: 3,
      name: 'سارة أحمد',
      role: 'مراجع محتوى'
    },

    {
      id: 4,
      name: 'محمود حسن',
      role: 'مراجع نهائي'
    }

  ];


  // ==========================================
  // DATA
  // GET api/PreQuality/pending
  // GET api/PreQuality/pending/{batchId}
  // ==========================================

  readonly rows = signal<ApprovalRow[]>([]);

  readonly loading = signal(false);

  readonly loadError = signal('');


  loadBatches(): void {

    this.loading.set(true);

    this.loadError.set('');

    const filters = {
      governorateId: this.searchGovernorate(),
      subjectId: this.searchSubject()
    };


    this.approvalService.getPendingBatches(filters)

      .pipe(

        switchMap(list => {

          if (!list.length) {
            return of([] as ApprovalRow[]);
          }

          return forkJoin(

            list.map(batch =>

              this.approvalService
                .getPendingBatch(batch.batchId)

                .pipe(

                  map(details =>
                    this.toRow(batch, details)
                  ),

                  catchError(err => {

                    console.error(
                      `Failed to load batch ${batch.batchId}:`,
                      err
                    );

                    return of(
                      this.toRow(batch, null)
                    );

                  })

                )

            )

          );

        })

      )

      .subscribe({

        next: result => {

          this.rows.set(
            result.map((row, index) => ({
              ...row,
              index: index + 1
            }))
          );

          this.loading.set(false);

        },

        error: err => {

          console.error(
            'Failed to load pending batches:',
            err
          );

          this.rows.set([]);

          this.loadError.set(
            err?.error?.message ||
            err?.message ||
            'تعذر تحميل قائمة المواد. حاول مرة أخرى.'
          );

          this.loading.set(false);

        }

      });

  }


  private toRow(
    summary: PendingBatchSummary,
    details: PendingBatchDetails | null
  ): ApprovalRow {

    const [
      labelGov = '',
      labelSub = ''
    ] = (summary.displayLabel ?? '')
      .split('+')
      .map(s => s.trim());


    return {

      index: 0,

      batchId: summary.batchId,

      displayLabel: summary.displayLabel,

      year:
        details?.year ??
        summary.year ??
        null,

      roundCode:
        details?.roundCode ??
        summary.roundCode ??
        '',

      roundName: (
        details?.roundName ??
        summary.roundName ??
        ''
      ).trim(),

      governorateName: (
        details?.governorateName ??
        labelGov
      ).trim(),

      subjectName: (
        details?.subjectName ??
        labelSub
      ).trim(),

      committeeCount:
        details?.committeeCount ?? null,

      requiredBookletTotal:
        details?.requiredBookletTotal ?? null,

      reserveBookletTotal:
        details?.reserveBookletTotal ?? null,

      expectedBoxCount:
        details?.expectedBoxCount ?? null,

      detailsFailed: !details,

      status: ST_PENDING,

      statusTone: 'warning'

    };

  }


  /** عرض الأرقام */
  fmt(value: number | null | undefined): string {

    return value === null || value === undefined
      ? '—'
      : value.toLocaleString('en');

  }


  // ==========================================
  // SERVER SIDE FILTERS
  // ==========================================

  readonly searchGovernorate =
    signal<string | number>('all');

  readonly searchSubject =
    signal<string | number>('all');


  /**
   * عند تغيير المحافظة:
   * 1- تحديث القيمة المختارة
   * 2- الرجوع لأول صفحة
   * 3- إرسال GovernorateId للـ API
   */
  setGovernorate(
    value: string | number
  ): void {

    const selectedValue = value ?? 'all';

    if (this.searchGovernorate() === selectedValue) {
      return;
    }

    this.searchGovernorate.set(selectedValue);

    this.resetPage();

    this.loadBatches();

  }


  /**
   * عند تغيير المادة:
   * 1- تحديث القيمة المختارة
   * 2- الرجوع لأول صفحة
   * 3- إرسال SubjectId للـ API
   */
  setSubject(
    value: string | number
  ): void {

    const selectedValue = value ?? 'all';

    if (this.searchSubject() === selectedValue) {
      return;
    }

    this.searchSubject.set(selectedValue);

    this.resetPage();

    this.loadBatches();

  }


  private labelOf(
    options: SelectOption[],
    value: string | number
  ): string | null {

    if (value === 'all') {
      return null;
    }

    return options.find(
      option => String(option.value) === String(value)
    )?.label ?? null;

  }


  /**
   * البيانات أصبحت مفلترة من الـ API
   * لذلك لا نحتاج فلترة محلية مرة أخرى.
   */
  readonly filteredRows = computed(() => {

    return this.rows();

  });


  // ==========================================
  // ACTIVE FILTERS
  // ==========================================

  readonly activeFilters = computed(() => {

    const list: {
      key: FilterKey;
      title: string;
      value: string;
    }[] = [];


    const governorate = this.labelOf(
      this.governorates(),
      this.searchGovernorate()
    );

    const subject = this.labelOf(
      this.subjects(),
      this.searchSubject()
    );


    if (governorate) {

      list.push({
        key: 'governorate',
        title: 'المحافظة',
        value: governorate
      });

    }


    if (subject) {

      list.push({
        key: 'subject',
        title: 'المادة',
        value: subject
      });

    }


    return list;

  });


  removeFilter(key: FilterKey): void {

    if (key === 'governorate') {
      this.searchGovernorate.set('all');
    }

    if (key === 'subject') {
      this.searchSubject.set('all');
    }

    this.resetPage();

    this.loadBatches();

  }


  clearFilters(): void {

    this.searchGovernorate.set('all');

    this.searchSubject.set('all');

    this.resetPage();

    this.loadBatches();

  }


  // ==========================================
  // QUICK STATS
  // ==========================================

  readonly stats = computed(() => {

    const all = this.rows();

    return {

      pending: all.filter(
        row => row.status === ST_PENDING
      ).length,

      ready: all.filter(
        row => row.status === ST_READY
      ).length,

      rejected: all.filter(
        row => row.status === ST_REJECTED
      ).length

    };

  });


  // ==========================================
  // PAGINATION
  // ==========================================

  readonly pageSize = signal(6);

  readonly currentPage = signal(1);


  readonly totalPages = computed(() =>

    Math.max(
      1,
      Math.ceil(
        this.filteredRows().length /
        this.pageSize()
      )
    )

  );


  readonly paginatedRows = computed(() => {

    const page = Math.min(
      this.currentPage(),
      this.totalPages()
    );

    const start =
      (page - 1) * this.pageSize();

    return this.filteredRows().slice(
      start,
      start + this.pageSize()
    );

  });


  readonly paginationStart = computed(() =>

    this.filteredRows().length === 0
      ? 0
      : (
          (this.currentPage() - 1) *
          this.pageSize()
        ) + 1

  );


  readonly paginationEnd = computed(() =>

    Math.min(
      this.currentPage() * this.pageSize(),
      this.filteredRows().length
    )

  );


  readonly paginationPages = computed<
    (number | 'dots')[]
  >(() => {

    const total = this.totalPages();

    const current = Math.min(
      this.currentPage(),
      total
    );

    const wanted = new Set<number>([
      1,
      total,
      current - 1,
      current,
      current + 1
    ]);

    const sorted = [...wanted]
      .filter(page =>
        page >= 1 && page <= total
      )
      .sort((a, b) => a - b);


    const pages: (number | 'dots')[] = [];

    sorted.forEach((page, index) => {

      if (
        index > 0 &&
        page - sorted[index - 1] > 1
      ) {
        pages.push('dots');
      }

      pages.push(page);

    });


    return pages;

  });


  private resetPage(): void {

    this.currentPage.set(1);

  }


  onPageSizeChange(): void {

    this.resetPage();

  }


  goToPage(page: number): void {

    if (
      page >= 1 &&
      page <= this.totalPages()
    ) {
      this.currentPage.set(page);
    }

  }


  previousPage(): void {

    this.goToPage(
      this.currentPage() - 1
    );

  }


  nextPage(): void {

    this.goToPage(
      this.currentPage() + 1
    );

  }


  // ==========================================
  // CARD HELPERS
  // ==========================================

  trackBatch = (
    _: number,
    row: ApprovalRow
  ) => row.batchId;


  trackerSteps(
    row: ApprovalRow
  ): { label: string; state: StepState }[] {

    switch (row.status) {

      case ST_READY:

        return [
          {
            label: ST_PENDING,
            state: 'done'
          },
          {
            label: ST_READY,
            state: 'current'
          }
        ];


      case ST_REJECTED:

        return [
          {
            label: ST_PENDING,
            state: 'done'
          },
          {
            label: ST_REJECTED,
            state: 'rejected'
          }
        ];


      default:

        return [
          {
            label: ST_PENDING,
            state: 'current'
          },
          {
            label: ST_READY,
            state: 'pending'
          }
        ];

    }

  }


  // ==========================================
  // APPROVE -> READY FOR PRINTING
  // ==========================================

  readyDialogVisible = false;

  readonly approveSubmitting = signal(false);

  selectedRow: ApprovalRow | null = null;


  markReady(row: ApprovalRow): void {

    if (
      row.status === ST_READY ||
      row.status === ST_REJECTED
    ) {
      return;
    }

    this.selectedRow = row;

    this.readyDialogVisible = true;

  }


  closeReadyDialog(): void {

    if (this.approveSubmitting()) {
      return;
    }

    this.readyDialogVisible = false;

    this.selectedRow = null;

  }


  confirmMarkReady(): void {

    const row = this.selectedRow;


    if (
      !row ||
      row.status === ST_READY ||
      row.status === ST_REJECTED ||
      this.approveSubmitting()
    ) {

      this.closeReadyDialog();

      return;

    }


    this.approveSubmitting.set(true);


    this.approvalService
      .approveBatch(row.batchId)

      .subscribe({

        next: (res: any) => {

          this.rows.update(rows =>

            rows.map(item =>

              item.batchId === row.batchId

                ? {
                    ...item,
                    status: ST_READY,
                    statusTone: 'success' as StatusTone,
                    rejectionReason: undefined
                  }

                : item

            )

          );


          this.approveSubmitting.set(false);

          this.readyDialogVisible = false;

          this.selectedRow = null;


          this.messageService.add({

            severity: 'success',

            summary: 'تم الاعتماد بنجاح',

            detail: res?.message || 'تم اعتماد المادة بنجاح',

            life: 3500

          });


          this.loadBatches();

        },


        error: err => {

          console.error(
            'Failed to approve batch:',
            err
          );

          this.approveSubmitting.set(false);


          this.messageService.add({

            severity: 'error',

            summary: 'تعذر الاعتماد',

            detail:
              err?.error?.message ||
              'حدث خطأ أثناء اعتماد المادة. حاول مرة أخرى.',

            life: 4000

          });

        }

      });

  }


  // ==========================================
  // REJECT DIALOG
  // TODO: اربطيها بالـ endpoint لما يتحدد
  // ==========================================

  rejectDialogVisible = false;

  rejectReason = '';

  selectedReviewers: ReviewUser[] = [];

  rejectSubmitting = false;


  openRejectDialog(row: ApprovalRow): void {

    this.selectedRow = row;

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


  get isRejectFormValid(): boolean {

    return (
      this.rejectReason.trim().length >= 10 &&
      this.selectedReviewers.length > 0
    );

  }


  submitRejection(): void {

    if (
      !this.selectedRow ||
      !this.isRejectFormValid
    ) {
      return;
    }


    this.rejectSubmitting = true;


    const rejectionData = {

      batchId: this.selectedRow.batchId,

      subject: this.selectedRow.subjectName,

      governorate: this.selectedRow.governorateName,

      reason: this.rejectReason.trim(),

      reviewerIds:
        this.selectedReviewers.map(user => user.id)

    };


    console.log(
      'Reject Request:',
      rejectionData
    );


    // TODO: API CALL WILL BE HERE

    setTimeout(() => {

      const batchId = this.selectedRow?.batchId;

      if (batchId === undefined) {

        this.rejectSubmitting = false;

        return;

      }


      const reason = this.rejectReason.trim();


      this.rows.update(rows =>

        rows.map(row =>

          row.batchId === batchId

            ? {
                ...row,
                status: ST_REJECTED,
                statusTone: 'danger' as StatusTone,
                rejectionReason: reason
              }

            : row

        )

      );


      this.rejectSubmitting = false;

      this.rejectDialogVisible = false;

      this.selectedRow = null;

      this.rejectReason = '';

      this.selectedReviewers = [];


      this.messageService.add({

        severity: 'success',

        summary: 'تمت العملية',

        life: 3000,

        detail: 'تم رفض المادة بنجاح'

      });

    }, 800);

  }


  // ==========================================
  // VIEW REJECTION REASON
  // ==========================================

  rejectionReasonDialogVisible = false;

  selectedRejectionReason = '';


  openRejectionReasonDialog(
    row: ApprovalRow
  ): void {

    if (row.status !== ST_REJECTED) {
      return;
    }

    this.selectedRow = row;

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
