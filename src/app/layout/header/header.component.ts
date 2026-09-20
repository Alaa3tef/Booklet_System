import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface Breadcrumb {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Input() breadcrumbs: Breadcrumb[] = [
    { label: 'الرئيسية', route: '/dashboard' },
    { label: 'إدارة البيانات الأساسية' },
    { label: 'إعداد اللجان' }
  ];

  @Input() userName = 'أحمد محمد';
  @Input() userRole = 'مستخدم IT';
}
