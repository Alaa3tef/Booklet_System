
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
  selector: 'app-printing',
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

  templateUrl: './printing.component.html',
  styleUrl: './printing.component.scss'
})
export default class PrintingComponent {


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
      label: 'المنوفية',
      value: 'monufia'
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
  // SEARCH
  // ==========================================

  selectedGovernorate = 'all';

  selectedSubject = 'all';


  // ==========================================
  // PAGE ESSENTIALS
  // ==========================================

  readonly essentials = [
    'البحث بالمحافظة',
    'البحث بالمادة',
    'تسجيل انتهاء الطباعة'
  ];


  // ==========================================
  // TABLE DATA
  // ==========================================

  readonly rows = signal<WorkflowStatusRow[]>([
    {
      index: 1,
      subject: 'اللغة العربية',
      governorate: 'القاهرة',
      status: 'تم الانتهاء',
      statusTone: 'success'
    },

    {
      index: 2,
      subject: 'الرياضيات',
      governorate: 'الجيزة',
      status: 'قيد الطباعة',
      statusTone: 'info'
    },

    {
      index: 3,
      subject: 'العلوم',
      governorate: 'المنوفية',
      status: 'مرفوض',
      statusTone: 'danger',

      rejectionReason:
        'يوجد خطأ في بعض صفحات المادة، كما أن ترتيب الأسئلة يحتاج إلى مراجعة قبل إعادة الطباعة.'
    },
    {
      index: 1,
      subject: 'اللغة العربية',
      governorate: 'القاهرة',
      status: 'تم الانتهاء',
      statusTone: 'success'
    },

    {
      index: 2,
      subject: 'الرياضيات',
      governorate: 'الجيزة',
      status: 'قيد الطباعة',
      statusTone: 'info'
    },

    {
      index: 3,
      subject: 'العلوم',
      governorate: 'المنوفية',
      status: 'مرفوض',
      statusTone: 'danger',

      rejectionReason:
        'يوجد خطأ في بعض صفحات المادة، كما أن ترتيب الأسئلة يحتاج إلى مراجعة قبل إعادة الطباعة.'
    },
    {
      index: 1,
      subject: 'اللغة العربية',
      governorate: 'القاهرة',
      status: 'تم الانتهاء',
      statusTone: 'success'
    },

    {
      index: 2,
      subject: 'الرياضيات',
      governorate: 'الجيزة',
      status: 'قيد الطباعة',
      statusTone: 'info'
    },

    {
      index: 3,
      subject: 'العلوم',
      governorate: 'المنوفية',
      status: 'مرفوض',
      statusTone: 'danger',

      rejectionReason:
        'يوجد خطأ في بعض صفحات المادة، كما أن ترتيب الأسئلة يحتاج إلى مراجعة قبل إعادة الطباعة.'
    }
  ]);

  // ==========================================
// PAGINATION
// ==========================================

readonly pageSize = signal(5);

readonly currentPage = signal(1);

readonly totalPages = computed(() => {
  return Math.max(
    1,
    Math.ceil(
      this.rows().length / this.pageSize()
    )
  );
});

readonly paginatedRows = computed(() => {

  const page = this.currentPage();
  const size = this.pageSize();

  const start = (page - 1) * size;
  const end = start + size;

  return this.rows().slice(start, end);
});

readonly paginationPages = computed(() => {

  const total = this.totalPages();
  const current = this.currentPage();

  // 4 صفحات أو أقل
  if (total <= 4) {
    return Array.from(
      { length: total },
      (_, index) => index + 1
    );
  }

  // أول الصفحات
  if (current <= 2) {
    return [1, 2, 3, 'dots', total];
  }

  // آخر الصفحات
  if (current >= total - 1) {
    return [
      1,
      'dots',
      total - 2,
      total - 1,
      total
    ];
  }

  // الصفحات الوسط
  return [
    1,
    'dots',
    current,
    'dots',
    total
  ];
});

readonly paginationStart = computed(() => {

  if (this.rows().length === 0) {
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
    this.rows().length
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
  // STATUS MENU
  // ==========================================

  selectedRow: WorkflowStatusRow | null = null;

  readonly menuItems: MenuItem[] = [];


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
  // REJECT DIALOG
  // ==========================================

  rejectDialogVisible = false;

  rejectReason = '';

  selectedReviewers: ReviewUser[] = [];

  rejectSubmitting = false;


  // ==========================================
  // VIEW REJECTION REASON DIALOG
  // ==========================================

  rejectionReasonDialogVisible = false;

  selectedRejectionReason = '';


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
  // BUILD MENU ITEMS
  // ==========================================

  private buildMenuItems(
    row: WorkflowStatusRow
  ): MenuItem[] {

    const items: MenuItem[] = [

      {
        label: 'تسجيل انتهاء الطباعة',

        icon: 'pi pi-check-circle',

        command: () => {

          this.finishSelectedPrinting();

        }
      }

    ];


    // ==========================================
    // REJECT
    // ==========================================

    if (
      row.status !== 'تم الانتهاء' &&
      row.status !== 'مرفوض'
    ) {

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
  // OPEN REJECTION REASON DIALOG
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
  // CLOSE REJECTION REASON DIALOG
  // ==========================================

  closeRejectionReasonDialog(): void {

    this.rejectionReasonDialogVisible = false;

    this.selectedRejectionReason = '';

    this.selectedRow = null;
  }


  // ==========================================
  // FINISH PRINTING
  // ==========================================

  finishSelectedPrinting(): void {

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

              status: 'تم الانتهاء',

              statusTone: 'success',

              rejectionReason: undefined
            }

          : row
      )
    );


    console.info(
      `Printing finished for row ${rowIndex}`
    );


    this.selectedRow = null;
  }


  // ==========================================
  // ALIAS
  // ==========================================

  markSelectedRowReady(): void {

    this.finishSelectedPrinting();

  }

}
