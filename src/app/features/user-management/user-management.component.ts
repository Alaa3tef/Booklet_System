import {
  Component,
  computed,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { AppUser } from './interface/useManagement';


// ==================================================
// MODEL
// ==================================================




@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, SelectModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export default class UserManagementComponent {

  // ==================================================
  // STATE
  // ==================================================

  searchQuery = signal('');
  selectedRole = signal('all');
  selectedStatus = signal('all');

  showAddModal = signal(false);
  showDeleteModal = signal(false);
  deleteTarget = signal<AppUser | null>(null);

  /** Form model for Add / Edit */
  form = signal({
    // name: '',
    username: '',
    email: '',
    roleKey: 'it',
    phone: '',
    status: 'active' as 'active' | 'inactive'
  });

  formError = signal('');

  /** Pagination */
  pageSize = signal(8);
  currentPage = signal(1);


  // ==================================================
  // SEED DATA
  // ==================================================

  private nextId = signal(13);

  readonly allUsers = signal<AppUser[]>([
    { id: 1,        username: 'ahmed.ali',      email: 'ahmed.ali@moe.gov.eg',      role: 'مدير النظام',    roleKey: 'admin',     status: 'active',   createdAt: '2025-01-10', avatarInitials: 'أح', avatarTone: 'navy' },
    { id: 2,              username: 'fatma.hassan',   email: 'fatma.hassan@moe.gov.eg',   role: 'مستخدم IT',      roleKey: 'it',        status: 'active',   createdAt: '2025-02-14', avatarInitials: 'فح', avatarTone: 'blue' },
    { id: 3,          username: 'mohamed.ibr',    email: 'mohamed.ibr@moe.gov.eg',    role: 'مستخدم الإعداد', roleKey: 'planning',  status: 'active',   createdAt: '2025-03-01', avatarInitials: 'مإ', avatarTone: 'teal' },
    { id: 4,              username: 'sara.khaled',    email: 'sara.khaled@moe.gov.eg',    role: 'مستخدم الطباعة', roleKey: 'printing',  status: 'active',   createdAt: '2025-03-12', avatarInitials: 'سخ', avatarTone: 'green' },
    { id: 5,               username: 'omar.youssef',   email: 'omar.youssef@moe.gov.eg',   role: 'مستخدم الجودة',  roleKey: 'quality',   status: 'inactive', createdAt: '2025-04-05', avatarInitials: 'عي', avatarTone: 'orange' },
    { id: 6,             username: 'noura.said',     email: 'noura.said@moe.gov.eg',     role: 'مستخدم التغليف', roleKey: 'packing',   status: 'active',   createdAt: '2025-04-20', avatarInitials: 'نس', avatarTone: 'purple' },
    { id: 7,           username: 'khaled.abd',     email: 'khaled.abd@moe.gov.eg',     role: 'مستخدم التخزين', roleKey: 'archiving', status: 'active',   createdAt: '2025-05-03', avatarInitials: 'خع', avatarTone: 'navy' },
    { id: 8,           username: 'mona.ahmed',     email: 'mona.ahmed@moe.gov.eg',     role: 'مستخدم IT',      roleKey: 'it',        status: 'inactive', createdAt: '2025-05-18', avatarInitials: 'مأ', avatarTone: 'blue' },
    { id: 9,         username: 'youssef.shafi',  email: 'youssef.shafi@moe.gov.eg',  role: 'مستخدم الإعداد', roleKey: 'planning',  status: 'active',   createdAt: '2025-06-01', avatarInitials: 'يش', avatarTone: 'teal' },
    { id: 10,          username: 'hanaa.ramadan',  email: 'hanaa.ramadan@moe.gov.eg',  role: 'مدير النظام',    roleKey: 'admin',     status: 'active',   createdAt: '2025-06-15', avatarInitials: 'هر', avatarTone: 'navy' },
    { id: 11,            username: 'tarek.mostafa',  email: 'tarek.mostafa@moe.gov.eg',  role: 'مستخدم الطباعة', roleKey: 'printing',  status: 'active',   createdAt: '2025-07-02', avatarInitials: 'طم', avatarTone: 'green' },
    { id: 12,            username: 'reem.sayed',     email: 'reem.sayed@moe.gov.eg',     role: 'مستخدم الجودة',  roleKey: 'quality',   status: 'inactive', createdAt: '2025-07-14', avatarInitials: 'رس', avatarTone: 'orange' },
  ]);


  // ==================================================
  // DERIVED (computed)
  // ==================================================

  readonly filtered = computed(() => {
    const q    = this.searchQuery().trim().toLowerCase();
    const role = this.selectedRole();
    const stat = this.selectedStatus();

    return this.allUsers().filter(u => {
      const matchQ    = !q || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = role === 'all' || u.roleKey === role;
      const matchStat = stat === 'all' || u.status === stat;
      return matchQ && matchRole && matchStat;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize()))
  );

  readonly paged = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur   = this.currentPage();
    const pages: (number | '...')[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cur > 3) pages.push('...');
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
        pages.push(i);
      }
      if (cur < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  readonly stats = computed(() => {
    const users = this.allUsers();
    return {
      total:    users.length,
      active:   users.filter(u => u.status === 'active').length,
      inactive: users.filter(u => u.status === 'inactive').length,
      admins:   users.filter(u => u.roleKey === 'admin').length
    };
  });


  // ==================================================
  // ROLE OPTIONS
  // ==================================================

  readonly roleOptions = [
    { value: 'all',      label: 'جميع الأدوار' },
    { value: 'admin',    label: 'مدير النظام' },
    { value: 'it',       label: 'مستخدم IT' },
    { value: 'planning', label: 'مستخدم الإعداد' },
    { value: 'printing', label: 'مستخدم الطباعة' },
    { value: 'quality',  label: 'مستخدم الجودة' },
    { value: 'packing',  label: 'مستخدم التغليف' },
    { value: 'archiving',label: 'مستخدم التخزين' }
  ];

  readonly formRoleOptions = this.roleOptions.slice(1); // exclude 'all' in form

  readonly statusOptions = [
    { value: 'all', label: 'جميع الحالات' },
    { value: 'active', label: 'نشط' },
    { value: 'inactive', label: 'معطل' }
  ];

  readonly formStatusOptions = this.statusOptions.slice(1);

  readonly roleLabels: Record<string, string> = {
    admin:    'مدير النظام',
    it:       'مستخدم IT',
    planning: 'مستخدم الإعداد',
    printing: 'مستخدم الطباعة',
    quality:  'مستخدم الجودة',
    packing:  'مستخدم التغليف',
    archiving:'مستخدم التخزين'
  };

  readonly toneForRole: Record<string, string> = {
    admin:    'navy',
    it:       'blue',
    planning: 'teal',
    printing: 'green',
    quality:  'orange',
    packing:  'purple',
    archiving:'navy'
  };


  // ==================================================
  // NAVIGATION
  // ==================================================

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  onRoleChange(value: string): void {
    this.selectedRole.set(value);
    this.currentPage.set(1);
  }

  onStatusChange(value: string): void {
    this.selectedStatus.set(value);
    this.currentPage.set(1);
  }

  goToPage(page: number | '...'): void {
    if (typeof page === 'number') {
      this.currentPage.set(page);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }


  // ==================================================
  // ADD MODAL
  // ==================================================

  openAddModal(): void {
    this.form.set({  username: '', email: '', roleKey: '', phone: ''  , status: 'active' });
    this.formError.set('');
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  submitAdd(): void {
    const f = this.form();

    if (!f.username.trim() || !f.email.trim()) {
      this.formError.set('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(f.email)) {
      this.formError.set('صيغة البريد الإلكتروني غير صحيحة');
      return;
    }

    const phoneRegex = /^\d{11}$/;
    if (f.phone && !phoneRegex.test(f.phone)) {
      this.formError.set('رقم الهاتف يجب أن يكون مكونًا من 11 رقمًا');
      return;
    }

    const newUser: AppUser = {
      id: this.nextId(),
      // name: f.name.trim(),
      username: f.username.trim(),
      email: f.email.trim(),
      role: this.roleLabels[f.roleKey],
      roleKey: f.roleKey,
      phone: f.phone,
      status: f.status ,
      createdAt: new Date().toISOString().split('T')[0],
      avatarInitials: this.buildInitials(f.username),
      avatarTone: this.toneForRole[f.roleKey] ?? 'blue'
    };

    this.allUsers.update(users => [...users, newUser]);
    this.nextId.update(n => n + 1);
    this.formError.set('');
    this.showAddModal.set(false);
  }


  // ==================================================
  // TOGGLE STATUS
  // ==================================================

  toggleStatus(user: AppUser): void {
    this.allUsers.update(users =>
      users.map(u =>
        u.id === user.id
          ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' }
          : u
      )
    );
  }


  // ==================================================
  // DELETE
  // ==================================================

  confirmDelete(user: AppUser): void {
    this.deleteTarget.set(user);
    this.showDeleteModal.set(true);
  }

  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.deleteTarget.set(null);
  }

  executeDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.allUsers.update(users => users.filter(u => u.id !== target.id));

    // adjust page if needed
    if (this.currentPage() > this.totalPages()) {
      this.currentPage.set(this.totalPages());
    }

    this.showDeleteModal.set(false);
    this.deleteTarget.set(null);
  }


  // ==================================================
  // HELPERS
  // ==================================================

  private buildInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return (parts[0] || 'م').slice(0, 2);
  }

  isNumber(v: number | '...'): boolean {
    return typeof v === 'number';
  }
// updateForm(key: string, value: any): void {
//     if (key === 'phone') {
//         value = String(value ?? '')
//             .replace(/\D/g, '')
//             .slice(0, 11);
//     }

//     this.form.update(current => ({
//         ...current,
//         [key]: value
//     }));
// }
  updateForm(field: string, value: string): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }
 }
