import { Component, computed, signal } from '@angular/core';
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
  selector: 'app-planning',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    TableModule,
    MenuModule,
    WorkflowStepLayoutComponent
  ],

  templateUrl: './planning.component.html',
  styleUrl: './planning.component.scss'
})
export class PlanningComponent {

  readonly governorates: SelectOption[] = [
    { label: 'كل المحافظات', value: 'all' },
    { label: 'القاهرة', value: 'cairo' },
    { label: 'الجيزة', value: 'giza' },
    { label: 'الإسكندرية', value: 'alexandria' }
  ];

  readonly subjects: SelectOption[] = [
    { label: 'كل المواد', value: 'all' },
    { label: 'اللغة العربية', value: 'arabic' },
    { label: 'الرياضيات', value: 'math' },
    { label: 'العلوم', value: 'science' }
  ];

  selectedGovernorate = 'all';
  selectedSubject = 'all';

  readonly searchGovernorate = signal('all');
  readonly searchSubject = signal('all');

  readonly essentials = [
    'البحث بالمحافظة',
    'البحث بالمادة',
    'تغيير حالة المادة'
  ];

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
      status: 'قيد الإعداد',
      statusTone: 'warning'
    }
  ]);

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

  readonly menuItems: MenuItem[] = [
    {
      label: 'تحويل إلى جاهز للطباعة',
      icon: 'pi pi-refresh',
      command: () => this.markSelectedRowReady()
    }
  ];

  // ==========================================
  // SEARCH
  // ==========================================

  search(): void {
    this.searchGovernorate.set(this.selectedGovernorate);
    this.searchSubject.set(this.selectedSubject);
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
    menu.toggle(event);
  }

  // ==========================================
  // CHANGE STATUS
  // ==========================================

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
              status: 'جاهز للطباعة',
              statusTone: 'success'
            }
          : row
      )
    );

    this.selectedRow = null;
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private getGovernorateValue(governorate: any): string {
    const map: Record<string, string> = {
      'القاهرة': 'cairo',
      'الجيزة': 'giza',
      'الإسكندرية': 'alexandria'
    };

    return map[governorate] ?? '';
  }

  private getSubjectValue(subject: string): string {
    const map: Record<string, string> = {
      'اللغة العربية': 'arabic',
      'الرياضيات': 'math',
      'العلوم': 'science'
    };

    return map[subject] ?? '';
  }
}