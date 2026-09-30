import {
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { AppUser } from './interfaces/useManagement';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { UserManagement } from './service/user-management';
import { AppRole } from './interfaces/role';
import { AppUserResponse } from './interfaces/useManagementResponse';
import { UserForm } from './interfaces/UserForm';
import { MenuModule, Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';


@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, SelectModule, DialogModule, FloatLabelModule, MessageModule , MenuModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})

export default class UserManagementComponent {


  private readonly userManagement = inject(UserManagement);

  // ---------- STATE ----------
  searchQuery    = signal('');
  selectedRole   = signal('all');
  selectedStatus = signal('all');

  editingId = signal<number | null>(null);
  editLoading = signal(false);
  readonly isEdit = computed(() => this.editingId() !== null);
  menuItems = signal<MenuItem[]>([]);

  showAddModal    = signal(false);
  showDeleteModal = signal(false);
  deleteTarget    = signal<AppUser | null>(null);

  user    = signal<AppUser[]>([]);
  roles   = signal<AppRole[]>([]);
  loading = signal(false);

  totalRecords = signal(0);
  pageSize     = signal(10);
  currentPage  = signal(1);

  // Stats (each one comes from its own count request)
  activeUsersCount   = signal(0);
  inactiveUsersCount = signal(0);
  managementUsersCount     = signal(0);
  allUsersCount      = signal(0);

  form = signal<UserForm>(this.emptyForm());
  formError = signal('');

  ngOnInit(): void {
    this.loadRoles();
    this.loadUsers();
    //this.loadStats();
  }

  private emptyForm(): UserForm {
    return { fullName: '', email: '', password: '', roleKey: '', status: 'active' };
  }

  // ---------- LOAD ----------
  loadUsers(): void {
    this.loading.set(true);

    const roleId   = this.selectedRole() === 'all' ? undefined : Number(this.selectedRole());
    const isActive = this.selectedStatus() === 'all' ? undefined : this.selectedStatus() === 'active';

    this.userManagement
      .getUsers(this.searchQuery().trim(), roleId, isActive, this.currentPage(), this.pageSize())
      .subscribe({
        next: (res: AppUserResponse) => {
          // this.user.set(res.data?.data ?? []);
          // this.totalRecords.set(res.data?.totalCount ?? 0);
          // this.loading.set(false);
           const d = res.data;
  this.user.set(d?.data ?? []);
  this.totalRecords.set(d?.totalCount ?? 0);
  this.activeUsersCount.set(d?.activeUsersCount ?? 0);
  this.inactiveUsersCount.set(d?.inactiveUsersCount ?? 0);
  this.managementUsersCount.set(d?.managementUsersCount ?? 0);
  this.loading.set(false);
        },
        error: (err) => {
          console.error('Error loading users:', err);
          this.user.set([]);
          this.totalRecords.set(0);
          this.loading.set(false);
        }
      });
  }

  loadRoles(): void {
    this.userManagement.getRoles().subscribe({
      next: res => this.roles.set(res.data ?? []),
      error: err => {
        console.error('Error loading roles:', err);
        this.roles.set([]);
      }
    });
  }

  // ---------- DERIVED ----------
  readonly roleOptions = computed(() => [
    { value: 'all', label: 'جميع الأدوار' },
    ...this.roles().map(r => ({ value: String(r.id), label: r.name }))
  ]);

  readonly formRoleOptions = computed(() => this.roleOptions().slice(1));

  readonly filtered = computed(() => this.user());
  readonly paged    = computed(() => this.user());

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalRecords() / this.pageSize()))
  );

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur   = this.currentPage();
    const pages: (number | '...')[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cur > 3) pages.push('...');
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
      if (cur < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

readonly stats = computed(() => ({
  total:      this.totalRecords(),
  active:     this.activeUsersCount(),
  inactive:   this.inactiveUsersCount(),
  management: this.managementUsersCount()
}));

  readonly statusOptions = [
    { value: 'all',      label: 'جميع الحالات' },
    { value: 'active',   label: 'نشط' },
    { value: 'inactive', label: 'معطل' }
  ];
  readonly formStatusOptions = this.statusOptions.slice(1);

  // Keyed by roleName returned from the API
  readonly toneForRole: Record<string, string> = {
    SuperAdmin:       'navy',
    IT:               'blue',
    ProjectManagment: 'teal',
    Printing:         'green',
    Quality:          'orange',
    WareHouse:        'purple',
    Archive:          'navy',
    Packing:          'purple',
    TopManagment:     'navy'
  };

  // ---------- FILTERS / PAGING ----------
  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
    this.loadUsers();
  }

  onRoleChange(value: string | null): void {
    this.selectedRole.set(value ?? 'all');
    this.currentPage.set(1);
    this.loadUsers();
  }

  onStatusChange(value: string | null): void {
    this.selectedStatus.set(value ?? 'all');
    this.currentPage.set(1);
    this.loadUsers();
  }

  openMenu(event: Event, u: AppUser, menu: Menu): void {
  this.menuItems.set([
    {
      label: 'تعديل',
      icon: 'pi pi-pencil',
      command: () => this.openEditModal(u)
    },
    {
      label: u.isActive ? 'تعطيل المستخدم' : 'تفعيل المستخدم',
      icon: u.isActive ? 'pi pi-ban' : 'pi pi-check',
      command: () => this.toggleStatus(u)
    },
    { separator: true },
    {
      label: 'حذف',
      icon: 'pi pi-trash',
      styleClass: 'menu-danger',
      command: () => this.confirmDelete(u)
    }
  ]);
  menu.toggle(event);
}
  goToPage(page: number | '...'): void {
    if (typeof page === 'number') {
      this.currentPage.set(page);
      this.loadUsers();
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.loadUsers();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.loadUsers();
    }
  }

  // ---------- ADD ----------
  updateForm<K extends keyof UserForm>(key: K, value: UserForm[K] | null): void {
    this.form.update(f => ({ ...f, [key]: value ?? '' }));
  }

 openAddModal(): void {
  this.editingId.set(null);
  this.form.set(this.emptyForm());
  this.formError.set('');
  this.showAddModal.set(true);
}

openEditModal(u: AppUser): void {
  this.editingId.set(u.id);
  this.formError.set('');
  this.form.set(this.emptyForm());
  this.editLoading.set(true);
  this.showAddModal.set(true);

  this.userManagement.getUserById(u.id).subscribe({
    next: res => {
      const d = res.data;
      this.form.set({
        fullName: d.fullName,
        email:    d.email,
        password: '',
        roleKey:  String(d.roleId),
        status:   d.isActive ? 'active' : 'inactive'
      });
      this.editLoading.set(false);
    },
    error: err => {
      console.error('Get user error:', err);
      this.editLoading.set(false);
      this.formError.set(err?.error?.message ?? 'تعذّر تحميل بيانات المستخدم');
    }
  });
}

closeAddModal(): void {
  this.showAddModal.set(false);
  this.editingId.set(null);
  this.editLoading.set(false);
}

submitForm(): void {
  if (this.editLoading()) return;
  const f = this.form();
  const editing = this.isEdit();

  if (!f.fullName.trim() || !f.email.trim() || !f.roleKey || (!editing && !f.password)) {
    this.formError.set('يرجى ملء جميع الحقول المطلوبة');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
    this.formError.set('صيغة البريد الإلكتروني غير صحيحة');
    return;
  }
  if (!editing && f.password.length < 6) {
    this.formError.set('كلمة المرور يجب ألا تقل عن 6 أحرف');
    return;
  }

  const body = {
    fullName: f.fullName.trim(),
    email:    f.email.trim(),
    roleId:   Number(f.roleKey),
    isActive: f.status === 'active'
  };

  const request$ = editing
    ? this.userManagement.updateUser(this.editingId()!, body)
    : this.userManagement.createUser({ ...body, password: f.password });

  request$.subscribe({
    next: () => {
      this.formError.set('');
      this.closeAddModal();
      this.loadUsers();
    },
    error: err => {
      console.error('Save user error:', err);
      this.formError.set(
        err?.error?.message ??
        (editing ? 'حدث خطأ أثناء تعديل المستخدم' : 'حدث خطأ أثناء إضافة المستخدم')
      );
    }
  });
}

  // ---------- TOGGLE STATUS (PUT) ----------
  toggleStatus(u: AppUser): void {
    this.userManagement.updateUser(u.id, {
      fullName: u.fullName,
      email:    u.email,
      roleId:   u.roleId,
      isActive: !u.isActive
    }).subscribe({
      next: () => {
        this.loadUsers();
        //this.loadStats();
      },
      error: err => console.error('Update user error:', err)
    });
  }

  // ---------- DELETE ----------
  confirmDelete(u: AppUser): void {
    this.deleteTarget.set(u);
    this.showDeleteModal.set(true);
  }

  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.deleteTarget.set(null);
  }

  executeDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;

    this.userManagement.deleteUser(target.id).subscribe({
      next: () => {
        this.showDeleteModal.set(false);
        this.deleteTarget.set(null);

        // If the last row of the last page was deleted, go back one page
        if (this.user().length === 1 && this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
        }
        this.loadUsers();
        //this.loadStats();
      },
      error: err => console.error('Delete user error:', err)
    });
  }

  // ---------- HELPERS ----------
  initials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/);
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return (parts[0] || 'م').slice(0, 2);
  }

  isNumber(v: number | '...'): boolean {
    return typeof v === 'number';
  }
  toneFor(roleName: string): string {
  return this.toneForRole[roleName] ?? 'navy';
}
 }
