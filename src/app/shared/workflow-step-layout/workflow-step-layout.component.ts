import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkflowMiniNavComponent } from '../workflow-mini-nav/workflow-mini-nav.component';
import { WorkflowNavKey, WorkflowThemeColor } from '../../core/models/workflow.model';

@Component({
  selector: 'app-workflow-step-layout',
  standalone: true,
  imports: [CommonModule, WorkflowMiniNavComponent],
  templateUrl: './workflow-step-layout.component.html',
  styleUrl: './workflow-step-layout.component.scss'
})
export class WorkflowStepLayoutComponent {
  /** '01', '02', '03', '04', '05' */
  @Input() stepNumber = '01';
  /** English stage name shown next to the Arabic title, e.g. 'Planning' */
  @Input() englishLabel = '';
  /** e.g. 'مستخدم الإعداد' */
  @Input() arabicTitle = '';
  @Input() arabicSubtitle = '';
  @Input() theme: WorkflowThemeColor = 'blue';
  @Input() activeNavKey!: WorkflowNavKey;

  @Input() illustrationIcon = 'pi pi-desktop';
  @Input() illustrationTaglineTop = '';
  @Input() illustrationTaglineBottom = '';

  @Input() panelIcon = 'pi pi-cog';
  @Input() panelTitle = '';

  @Input() functionLabel = '';
  @Input() essentials: string[] = [];

  @Input() resultText = '';
  @Input() resultSubtext = '';
}
