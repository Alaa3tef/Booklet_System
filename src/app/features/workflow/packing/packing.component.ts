import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';

@Component({
  selector: 'app-packing',
  standalone: true,
  imports: [CommonModule, TableModule, WorkflowStepLayoutComponent],
  templateUrl: './packing.component.html',
  styleUrl: './packing.component.scss'
})
export default class PackingComponent {
  readonly essentials = [
    'تغليف الأظرف الصغيرة للجنة في ظرف كبير',
    'عمل Scan لل QR الخارجي للجنة بالكامل'
  ];

  readonly rows = signal<WorkflowStatusRow[]>([
    { index: 1, subject: 'اللغة العربية', committeeNumber: '101', status: 'تم التغليف', statusTone: 'success' },
    { index: 2, subject: 'اللغة العربية', committeeNumber: '102', status: 'قيد التغليف', statusTone: 'warning' },
    { index: 3, subject: 'اللغة العربية', committeeNumber: '103', status: 'قيد التغليف', statusTone: 'warning' }
  ]);

  confirmPacking(): void {
    // Hook up to the backend "confirm committee packing" endpoint.
    console.info('Confirming packing...');
  }
}
