import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { SelectOption } from '../../../core/models/committee.model';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';

@Component({
  selector: 'app-printing',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, TableModule, WorkflowStepLayoutComponent],
  templateUrl: './printing.component.html',
  styleUrl: './printing.component.scss'
})
export class PrintingComponent {
  readonly governorates: SelectOption[] = [
    { label: 'القاهرة', value: 'cairo' },
    { label: 'الجيزة', value: 'giza' },
    { label: 'المنوفية', value: 'monufia' }
  ];
  readonly subjects: SelectOption[] = [
    { label: 'اللغة العربية', value: 'arabic' },
    { label: 'الرياضيات', value: 'math' },
    { label: 'العلوم', value: 'science' }
  ];

  selectedGovernorate = this.governorates[0].value;
  selectedSubject = this.subjects[0].value;

  readonly essentials = ['اختيار المحافظة', 'اختيار المادة', 'تسجيل انتهاء الطباعة'];

  readonly rows = signal<WorkflowStatusRow[]>([
    { index: 1, subject: 'اللغة العربية', governorate: 'القاهرة', status: 'تم الانتهاء', statusTone: 'success' },
    { index: 2, subject: 'الرياضيات', governorate: 'الجيزة', status: 'قيد الطباعة', statusTone: 'info' },
    { index: 3, subject: 'العلوم', governorate: 'المنوفية', status: 'قيد الطباعة', statusTone: 'info' }
  ]);

  finishPrinting(): void {
    // Hook up to the backend "mark subject printing finished" endpoint.
    console.info('Marking printing as finished...');
  }
}
