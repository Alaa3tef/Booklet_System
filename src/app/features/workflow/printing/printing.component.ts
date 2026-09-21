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

@Component({
  selector: 'app-printing',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    TableModule,
    MenuModule,
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

  readonly menuItems: MenuItem[] = [
    {
      label: 'تسجيل انتهاء الطباعة',
      icon: 'pi pi-check',
      command: () => this.finishSelectedPrinting()
    }
  ];

  // ==========================================
  // OPEN STATUS MENU
  // ==========================================

  openStatusMenu(
    row: WorkflowStatusRow,
    menu: any,
    event: Event
  ): void {
    this.selectedRow = row;
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
}