import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { SelectOption } from '../../../core/models/committee.model';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { MultiSelectModule } from 'primeng/multiselect';

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
  WorkflowStepLayoutComponent
],

  templateUrl: './printing.component.html',
  styleUrl: './printing.component.scss'
})
export class PrintingComponent {

  readonly governorates: SelectOption[] = [
    { label: 'كل المحافظات', value: 'all' },
    { label: 'القاهرة', value: 'cairo' },
    { label: 'الجيزة', value: 'giza' },
    { label: 'المنوفية', value: 'monufia' }
  ];

  readonly subjects: SelectOption[] = [
    { label: 'كل المواد', value: 'all' },
    { label: 'اللغة العربية', value: 'arabic' },
    { label: 'الرياضيات', value: 'math' },
    { label: 'العلوم', value: 'science' }
  ];

  selectedGovernorate = 'all';
  selectedSubject = 'all';

  readonly essentials = [
    'البحث بالمحافظة',
    'البحث بالمادة',
    'تسجيل انتهاء الطباعة'
  ];

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
      status: 'قيد الطباعة',
      statusTone: 'info'
    }
  ]);

  // ==========================================
  // STATUS MENU
  // ==========================================

  selectedRow: WorkflowStatusRow | null = null;

    // ==========================================
// REJECT DIALOG
// ==========================================

rejectDialogVisible = false;

rejectReason = '';

selectedReviewers: any[] = [];

rejectSubmitting = false;

   readonly menuItems: MenuItem[] = [];

 readonly reviewUsers: any[] = [
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

openRejectDialog(): void {
  if (!this.selectedRow) {
    return;
  }

  this.rejectReason = '';
  this.selectedReviewers = [];
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
// VALIDATE REJECT FORM
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
  if (!this.selectedRow || !this.isRejectFormValid) {
    return;
  }

  this.rejectSubmitting = true;

  const rejectionData = {
    rowIndex: this.selectedRow.index,
    subject: this.selectedRow.subject,
    governorate: this.selectedRow.governorate,
    reason: this.rejectReason.trim(),
    reviewerIds: this.selectedReviewers.map(user => user.id)
  };

  console.log('Reject Request:', rejectionData);

  // هنا بعدين تحطي API call

  setTimeout(() => {

    this.rows.update(rows =>
      rows.map(row =>
        row.index === this.selectedRow?.index
          ? {
              ...row,
              status: 'مرفوض',
              statusTone: 'danger'
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
  // FINISH PRINTING
  // ==========================================

  finishSelectedPrinting(): void {
    if (!this.selectedRow) {
      return;
    }

    const rowIndex = this.selectedRow.index;

    this.rows.update(rows =>
      rows.map(row =>
        row.index === rowIndex
          ? {
              ...row,
              status: 'تم الانتهاء',
              statusTone: 'success'
            }
          : row
      )
    );

    console.info(
      `Printing finished for row ${rowIndex}`
    );

    this.selectedRow = null;
  }


 private buildMenuItems(row: WorkflowStatusRow): MenuItem[] {
  const items: MenuItem[] = [
    {
      label: 'تسجيل انتهاء الطباعة',
      icon: 'pi pi-refresh',
      command: () => {
        this.markSelectedRowReady();
      }
    }
  ];

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

 markSelectedRowReady(): void {
  if (!this.selectedRow) {
    return;
  }

  const rowIndex = this.selectedRow.index;

  this.rows.update(rows =>
    rows.map(row =>
      row.index === rowIndex
        ? {
            ...row,
            status: 'تم الانتهاء',
            statusTone: 'success'
          }
        : row
    )
  );

  this.selectedRow = null;
}
}