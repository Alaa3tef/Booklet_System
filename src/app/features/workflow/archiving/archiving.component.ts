import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { SelectOption } from '../../../core/models/committee.model';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';

@Component({
  selector: 'app-archiving',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, TableModule, WorkflowStepLayoutComponent],
  templateUrl: './archiving.component.html',
  styleUrl: './archiving.component.scss'
})
export default class ArchivingComponent {
  readonly zones: SelectOption[] = [{ label: 'المخزن الرئيسي', value: 'main' }];
  readonly shelves: SelectOption[] = [
    { label: 'A-01', value: 'A-01' },
    { label: 'B-02', value: 'B-02' }
  ];
  readonly slots: SelectOption[] = [
    { label: '01', value: '01' },
    { label: '02', value: '02' },
    { label: '03', value: '03' }
  ];

  selectedZone = this.zones[0].value;
  selectedShelf = this.shelves[0].value;
  selectedSlot = this.slots[0].value;

  readonly essentials = ['عمل تخزين للمادة', 'عمل Scan لل QR', 'تحديد مكان التخزين في المخزن'];

  readonly rows = signal<WorkflowStatusRow[]>([
    { index: 1, subject: 'اللغة العربية', committeeNumber: '101', location: 'A-01-01', status: 'تم التخزين', statusTone: 'success' },
    { index: 2, subject: 'اللغة العربية', committeeNumber: '102', location: 'A-01-02', status: 'تم التخزين', statusTone: 'success' },
    { index: 3, subject: 'اللغة العربية', committeeNumber: '103', location: 'B-02-03', status: 'تم التخزين', statusTone: 'success' }
  ]);

  confirmStorage(): void {
    // Hook up to the backend "confirm committee storage location" endpoint.
    console.info('Confirming storage location...');
  }
}
