import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';

import { SelectOption } from '../../../core/models/committee.model';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';

interface ReviewUser {
  id: number;
  name: string;
  role: string;
  avatar?: string;
}

@Component({
  selector: 'app-planning',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,

    SelectModule,
    MultiSelectModule,
    TableModule,
    MenuModule,
    DialogModule,
    ButtonModule,
    TextareaModule,
    TooltipModule,

    WorkflowStepLayoutComponent
  ],

  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss'
})
export default class PlanningComponent {
  // ==========================================
// PAGINATION
// ==========================================

readonly pageSize = signal(5);

readonly currentPage = signal(1);

readonly totalPages = computed(() => {
  return Math.max(
    1,
    Math.ceil(this.filteredRows().length / this.pageSize())
  );
});

readonly paginatedRows = computed(() => {
  const page = this.currentPage();
  const size = this.pageSize();

  const start = (page - 1) * size;
  const end = start + size;

  return this.filteredRows().slice(start, end);
});

readonly paginationPages = computed(() => {

  const total = this.totalPages();
  const current = this.currentPage();

  // 4 صفحات أو أقل → اعرضهم كلهم
  if (total <= 4) {
    return Array.from(
      { length: total },
      (_, index) => index + 1
    );
  }

  // أكثر من 4 صفحات
  if (current <= 2) {
    return [1, 2, 3, 'dots', total];
  }

  if (current >= total - 1) {
    return [1, 'dots', total - 2, total - 1, total];
  }

  return [1, 'dots', current, 'dots', total];
});

readonly paginationStart = computed(() => {

  if (this.filteredRows().length === 0) {
    return 0;
  }

  return (
    (this.currentPage() - 1) *
      this.pageSize() +
    1
  );
});

readonly paginationEnd = computed(() => {

  return Math.min(
    this.currentPage() * this.pageSize(),
    this.filteredRows().length
  );
});


goToPage(page: number): void {

  if (
    page < 1 ||
    page > this.totalPages() ||
    page === this.currentPage()
  ) {
    return;
  }

  this.currentPage.set(page);
}


previousPage(): void {
  this.goToPage(this.currentPage() - 1);
}


nextPage(): void {
  this.goToPage(this.currentPage() + 1);
}


onPageSizeChange(): void {
  this.currentPage.set(1);
}
  // ==========================================
  // FILTER OPTIONS
  // ==========================================

  readonly governorates: SelectOption[] = [
    {
      label: 'كل المحافظات',
      value: 'all'
    },
    {
      label: 'القاهرة',
      value: 'cairo'
    },
    {
      label: 'الجيزة',
      value: 'giza'
    },
    {
      label: 'الإسكندرية',
      value: 'alexandria'
    }
  ];

  readonly subjects: SelectOption[] = [
    {
      label: 'كل المواد',
      value: 'all'
    },
    {
      label: 'اللغة العربية',
      value: 'arabic'
    },
    {
      label: 'الرياضيات',
      value: 'math'
    },
    {
      label: 'العلوم',
      value: 'science'
    }
  ];


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
  // SEARCH
  // ==========================================

  selectedGovernorate = 'all';

  selectedSubject = 'all';

  readonly searchGovernorate = signal('all');

  readonly searchSubject = signal('all');


  // ==========================================
  // ESSENTIALS
  // ==========================================

  readonly essentials = [
    'البحث بالمحافظة',
    'البحث بالمادة',
    'تغيير حالة المادة'
  ];


  // ==========================================
  // TABLE DATA
  // ==========================================

  readonly rows = signal<WorkflowStatusRow[]>([
    {
      index: 1,
      subject: 'اللغة العربية',
      governorate: 'القاهرة',
      status: 'جاهز للطباعة',
      statusTone: 'success'
    },

    {
      index: 2,
      subject: 'الرياضيات',
      governorate: 'الجيزة',
      status: 'قيد الإعداد',
      statusTone: 'warning'
    },

    {
      index: 3,
      subject: 'العلوم',
      governorate: 'الإسكندرية',
      status: 'مرفوض',
      statusTone: 'danger',

      rejectionReason:
        'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الخطة.'
    },
    {
      index: 1,
      subject: 'اللغة العربية',
      governorate: 'القاهرة',
      status: 'جاهز للطباعة',
      statusTone: 'success'
    },

    {
      index: 2,
      subject: 'الرياضيات',
      governorate: 'الجيزة',
      status: 'قيد الإعداد',
      statusTone: 'warning'
    },

    {
      index: 3,
      subject: 'العلوم',
      governorate: 'الإسكندرية',
      status: 'مرفوض',
      statusTone: 'danger',

      rejectionReason:
        'يوجد بعض الأخطاء في محتوى المادة، كما أن بعض الأسئلة تحتاج إلى مراجعة قبل اعتماد الخطة.'
    },
  ]);


  // ==========================================
  // FILTERED ROWS
  // ==========================================

  readonly filteredRows = computed(() => {

    const governorate = this.searchGovernorate();

    const subject = this.searchSubject();

    return this.rows().filter(row => {

      const governorateMatch =
        governorate === 'all' ||
        this.getGovernorateValue(row.governorate) === governorate;

      const subjectMatch =
        subject === 'all' ||
        this.getSubjectValue(row.subject) === subject;

      return governorateMatch && subjectMatch;
    });
  });


  // ==========================================
  // MENU
  // ==========================================

  selectedRow: WorkflowStatusRow | null = null;

  readonly menuItems: MenuItem[] = [];


  // ==========================================
  // REJECT DIALOG
  // ==========================================

  rejectDialogVisible = false;

  rejectReason = '';

  selectedReviewers: ReviewUser[] = [];

  rejectSubmitting = false;


  // ==========================================
  // REJECTION REASON VIEW DIALOG
  // ==========================================

  rejectionReasonDialogVisible = false;

  selectedRejectionReason = '';


  // ==========================================
  // SEARCH
  // ==========================================

search(): void {

  this.searchGovernorate.set(
    this.selectedGovernorate
  );

  this.searchSubject.set(
    this.selectedSubject
  );

  // Reset pagination after filtering
  this.currentPage.set(1);
}


  // ==========================================
  // BUILD STATUS MENU
  // ==========================================

  private buildMenuItems(
    row: WorkflowStatusRow
  ): MenuItem[] {

    const items: MenuItem[] = [

      {
        label: 'تحويل إلى جاهز للطباعة',

        icon: 'pi pi-refresh',

        command: () => {
          this.markSelectedRowReady();
        }
      }
    ];


    // ==========================================
    // REJECT OPTION
    // ==========================================

    if (row.status !== 'جاهز للطباعة') {

      items.push(

        {
          separator: true
        },

        {
          label: 'رفض المادة',

          icon: 'pi pi-times-circle',

          styleClass: 'reject-menu-item',

          command: () => {
            this.openRejectDialog();
          }
        }
      );
    }


    return items;
  }


  // ==========================================
  // OPEN STATUS MENU
  // ==========================================

  openStatusMenu(
    row: WorkflowStatusRow,
    menu: any,
    event: Event
  ): void {

    this.selectedRow = row;

    this.menuItems.length = 0;

    this.menuItems.push(
      ...this.buildMenuItems(row)
    );

    menu.toggle(event);
  }


  // ==========================================
  // OPEN REJECT DIALOG
  // ==========================================

  openRejectDialog(): void {

    if (!this.selectedRow) {
      return;
    }

    this.rejectReason = '';

    this.selectedReviewers = [];

    this.rejectSubmitting = false;

    this.rejectDialogVisible = true;
  }


  // ==========================================
  // CLOSE REJECT DIALOG
  // ==========================================

  closeRejectDialog(): void {

    if (this.rejectSubmitting) {
      return;
    }

    this.rejectDialogVisible = false;

    this.rejectReason = '';

    this.selectedReviewers = [];
  }


  // ==========================================
  // REJECT FORM VALIDATION
  // ==========================================

  get isRejectFormValid(): boolean {

    return (
      this.rejectReason.trim().length >= 10 &&
      this.selectedReviewers.length > 0
    );
  }


  // ==========================================
  // SUBMIT REJECTION
  // ==========================================

  submitRejection(): void {

    if (
      !this.selectedRow ||
      !this.isRejectFormValid
    ) {
      return;
    }


    this.rejectSubmitting = true;


    const rejectionData = {

      rowIndex: this.selectedRow.index,

      subject: this.selectedRow.subject,

      governorate: this.selectedRow.governorate,

      reason: this.rejectReason.trim(),

      reviewerIds:
        this.selectedReviewers.map(
          user => user.id
        )
    };


    console.log(
      'Reject Request:',
      rejectionData
    );


    // ==========================================
    // API CALL WILL BE HERE
    // ==========================================

    setTimeout(() => {

      const rowIndex =
        this.selectedRow?.index;


      if (!rowIndex) {
        this.rejectSubmitting = false;
        return;
      }


      const reason =
        this.rejectReason.trim();


      this.rows.update(rows =>

        rows.map(row =>

          row.index === rowIndex

            ? {
                ...row,

                status: 'مرفوض',

                statusTone: 'danger',

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

    }, 800);
  }


  // ==========================================
  // OPEN REJECTION REASON
  // ==========================================

  openRejectionReasonDialog(
    row: WorkflowStatusRow
  ): void {

    if (row.status !== 'مرفوض') {
      return;
    }


    this.selectedRow = row;


    this.selectedRejectionReason =
      row.rejectionReason?.trim() ||
      'لم يتم تسجيل سبب الرفض.';


    this.rejectionReasonDialogVisible = true;
  }


  // ==========================================
  // CLOSE REJECTION REASON
  // ==========================================

  closeRejectionReasonDialog(): void {

    this.rejectionReasonDialogVisible = false;

    this.selectedRejectionReason = '';

    this.selectedRow = null;
  }


  // ==========================================
  // CHANGE STATUS TO READY
  // ==========================================

  markSelectedRowReady(): void {

    if (!this.selectedRow) {
      return;
    }


    const rowIndex =
      this.selectedRow.index;


    this.rows.update(rows =>

      rows.map(row =>

        row.index === rowIndex

          ? {
              ...row,

              status: 'جاهز للطباعة',

              statusTone: 'success',

              rejectionReason: undefined
            }

          : row
      )
    );


    this.selectedRow = null;
  }


  // ==========================================
  // HELPERS
  // ==========================================

  private getGovernorateValue(
    governorate: any
  ): string {

    const map: Record<string, string> = {

      'القاهرة': 'cairo',

      'الجيزة': 'giza',

      'الإسكندرية': 'alexandria'
    };


    return map[governorate] ?? '';
  }


  private getSubjectValue(
    subject: string
  ): string {

    const map: Record<string, string> = {

      'اللغة العربية': 'arabic',

      'الرياضيات': 'math',

      'العلوم': 'science'
    };


    return map[subject] ?? '';
  }
}