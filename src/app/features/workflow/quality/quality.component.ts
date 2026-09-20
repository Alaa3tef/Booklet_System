import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [CommonModule, TableModule, WorkflowStepLayoutComponent],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss'
})
export class QualityComponent {
  readonly essentials = [
    'تغليف البوكليت في أظرف صغيرة لكل لجنة',
    'عمل Scan لل QR الخارجي للجنة بالكامل'
  ];

  readonly rows = signal<WorkflowStatusRow[]>([
    { index: 1, subject: 'اللغة العربية', committeeNumber: '101', status: 'تم المراجعة', statusTone: 'success' },
    { index: 2, subject: 'اللغة العربية', committeeNumber: '102', status: 'تم المراجعة', statusTone: 'success' },
    { index: 3, subject: 'اللغة العربية', committeeNumber: '103', status: 'مرفوض', statusTone: 'danger' }
  ]);

  approve(): void {
    // Hook up to the backend "approve committee quality review" endpoint.
    console.info('Approving committee review...');
  }

  reject(): void {
    // Hook up to the backend "reject committee quality review" endpoint.
    console.info('Rejecting committee review...');
  }
}
