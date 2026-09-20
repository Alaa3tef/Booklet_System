import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { WORKFLOW_MINI_NAV, WorkflowNavKey, WorkflowThemeColor } from '../../core/models/workflow.model';

@Component({
  selector: 'app-workflow-mini-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './workflow-mini-nav.component.html',
  styleUrl: './workflow-mini-nav.component.scss'
})
export class WorkflowMiniNavComponent {
  @Input() activeKey!: WorkflowNavKey;
  @Input() theme: WorkflowThemeColor = 'blue';

  readonly items = WORKFLOW_MINI_NAV;
}
