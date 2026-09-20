import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from '../../core/models/nav-item.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  readonly navItems = signal<NavItem[]>([
    { label: 'الرئيسية', icon: 'pi pi-home', route: '/dashboard' },
    {
      label: 'إدارة البيانات الأساسية',
      icon: 'pi pi-database',
      expanded: true,
      children: [
        { label: 'المحافظات', icon: 'pi pi-circle-fill', route: '/governorates' },
        { label: 'المواد', icon: 'pi pi-circle-fill', route: '/subjects' },
        { label: 'إدارة اللجان', icon: 'pi pi-circle-fill', route: '/committees/setup', active: true }
      ]
    },
    { label: 'الإعداد', icon: 'pi pi-sliders-h', route: '/workflow/planning' },
    { label: 'الطباعة', icon: 'pi pi-print', route: '/workflow/printing' },
    { label: 'الجودة', icon: 'pi pi-verified', route: '/workflow/quality' },
    { label: 'التغليف', icon: 'pi pi-box', route: '/workflow/packing' },
    { label: 'التخزين', icon: 'pi pi-database', route: '/workflow/archiving' },
    { label: 'إنتاج الملفات', icon: 'pi pi-file-export', route: '/production' },
    { label: 'المتابعة والتقارير', icon: 'pi pi-chart-bar', route: '/reports' },
    { label: 'إدارة المستخدمين', icon: 'pi pi-users', route: '/users' },
    { label: 'الإعدادات', icon: 'pi pi-cog', route: '/settings' }
  ]);

  toggle(item: NavItem): void {
    if (item.children) {
      item.expanded = !item.expanded;
    }
  }
}
