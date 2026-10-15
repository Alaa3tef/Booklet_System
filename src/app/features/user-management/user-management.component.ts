import {
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { MenuModule, Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

import { AppUser } from './interfaces/useManagement';
import { UserManagement } from './service/user-management';
import { AppRole } from './interfaces/role';
import { AppUserResponse } from './interfaces/useManagementResponse';
import { UserForm } from './interfaces/UserForm';
import { AuthService } from '../../core/services/auth.service';
import { TableModule } from 'primeng/table';
import { ToastService } from '../../core/services/toast.service';


/** Validator: newPassword must equal confirmNewPassword */
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pass    = group.get('newPassword')?.value;
  const confirm = group.get('confirmNewPassword')?.value;
  return pass && confirm && pass !== confirm ? { mismatch: true } : null;
}
// letters (any language) + spaces + combining marks (Arabic diacritics)
const NAME_REGEX  = /^[\p{L}\p{M}]+(?:\s[\p{L}\p{M}]+)*$/u;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DialogModule,
    FloatLabelModule,
    MessageModule,
    MenuModule,
    PasswordModule,
    TableModule
],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})

export default class UserManagementComponent {
  private readonly toast = inject(ToastService);
  private readonly userManagement = inject(UserManagement);
  private readonly authService = inject(AuthService);

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

  // ---------- SET PASSWORD STATE ----------
  showPasswordModal = signal(false);
  passwordSaving    = signal(false);
  passwordError     = signal('');
  passwordTarget    = signal<AppUser | null>(null);

  passwordForm = new FormGroup(
    {
      email: new FormControl({ value: '', disabled: true }, { nonNullable: true }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)]
      }),
      confirmNewPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      })
    },
    { validators: passwordsMatch }
  );

  get pf() { return this.passwordForm.controls; }

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

  readonly rangeFrom = computed(() =>
  this.totalRecords() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1
);

readonly rangeTo = computed(() =>
  Math.min(this.currentPage() * this.pageSize(), this.totalRecords())
);
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
  touched = signal<Partial<Record<keyof UserForm, boolean>>>({});



readonly fieldErrors = computed(() => {
  const f = this.form();
  const editing = this.isEdit();
  const name  = f.fullName.trim();
  const email = f.email.trim();
  const e: Partial<Record<keyof UserForm, string>> = {};

  if (!name)                          e.fullName = 'الاسم مطلوب';
  else if (!NAME_REGEX.test(name))    e.fullName = 'الاسم يجب أن يحتوي على حروف فقط (بدون أرقام أو رموز)';
  else if (name.length < 2)           e.fullName = 'الاسم قصير جدًا';

  if (!email)                                     e.email = 'البريد الإلكتروني مطلوب';
  else if (!EMAIL_REGEX.test(email))              e.email = 'صيغة البريد الإلكتروني غير صحيحة';
  else if (/^\d+$/.test(email.split('@')[0]))     e.email = 'لا يمكن أن يتكوّن البريد من أرقام فقط قبل @';

  if (!f.roleKey) e.roleKey = 'يرجى اختيار الدور';

  if (!editing) {
    if (!f.password)                 e.password = 'كلمة المرور مطلوبة';
    else if (f.password.length < 6)  e.password = 'كلمة المرور يجب ألا تقل عن 6 أحرف';
  }
  return e;
});
// First visible validation error, in field order
readonly liveError = computed(() => {
  const order: (keyof UserForm)[] = ['fullName', 'email', 'roleKey', 'password'];
  for (const key of order) {
    const msg = this.showError(key);
    if (msg) return msg;
  }
  return '';
});
readonly formValid = computed(() => Object.keys(this.fieldErrors()).length === 0);

// Show the error once the user typed something or left the field
showError(key: keyof UserForm): string | null {
  const msg = this.fieldErrors()[key];
  if (!msg) return null;
  return (this.touched()[key] || this.form()[key] !== '') ? msg : null;
}

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

  clearFilters(): void {
  this.searchQuery.set('');
  this.selectedRole.set('all');
  this.selectedStatus.set('all');
  this.currentPage.set(1);
  this.loadUsers();
}
onFullNameInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value.replace(/\s{2,}/g, ' ');
  this.updateForm('fullName', value);
}
  openMenu(event: Event, u: AppUser, menu: Menu): void {
    this.menuItems.set([
      {
        label: 'تعديل',
        icon: 'pi pi-pencil',
        command: () => this.openEditModal(u)
      },
      {
        label: 'تعيين كلمة المرور',
        icon: 'pi pi-key',
        command: () => this.openPasswordModal(u)
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

  // ---------- ADD / EDIT ----------
 updateForm<K extends keyof UserForm>(key: K, value: UserForm[K] | null): void {
  this.form.update(f => ({ ...f, [key]: value ?? '' }));
  this.formError.set('');
}

  openAddModal(): void {
    this.editingId.set(null);
    this.touched.set({});
    this.form.set(this.emptyForm());
    this.formError.set('');
    this.showAddModal.set(true);
  }

  openEditModal(u: AppUser): void {
    this.editingId.set(u.id);
    this.touched.set({});
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
    this.touched.set({});
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
if (!this.formValid()) {
  this.touched.set({ fullName: true, email: true, roleKey: true, password: true });
  return;
}

    const body = {
      fullName: f.fullName.trim(),
      email:    f.email.trim(),
      roleId:   Number(f.roleKey),
      //isActive: f.status === 'active'
    };

    const request$ = editing
      ? this.userManagement.updateUser(this.editingId()!, body)
      : this.userManagement.createUser({ ...body, password: f.password });

    request$.subscribe({
      next: (res) => {
        this.formError.set('');
        this.closeAddModal();
        this.loadUsers();
        this.toast.success(
          res.message ?? (editing ? 'تم تعديل المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح'),
          editing ? 'تعديل مستخدم' : 'إضافة مستخدم'
        );
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

  // ---------- SET PASSWORD ----------
  openPasswordModal(u: AppUser): void {
    this.passwordTarget.set(u);
    this.passwordError.set('');
    this.passwordSaving.set(false);
    this.passwordForm.reset();
    this.passwordForm.patchValue({ email: u.email });   // patch email
    this.showPasswordModal.set(true);
  }

  closePasswordModal(): void {
    this.showPasswordModal.set(false);
    this.passwordTarget.set(null);
    this.passwordForm.reset();
    this.passwordSaving.set(false);
  }

  submitPassword(): void {
    if (this.passwordSaving()) return;

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    // getRawValue because the email control is disabled (not included in .value)
    const body: any = this.passwordForm.getRawValue();

    this.passwordSaving.set(true);
    this.passwordError.set('');

    this.authService.ChangePassword(body).subscribe({
      next: () => this.closePasswordModal(),
      error: err => {
        console.error('Change password error:', err);
        this.passwordSaving.set(false);
        this.passwordError.set(err?.error?.message ?? 'حدث خطأ أثناء تعيين كلمة المرور');
      }
    });
  }

  // ---------- TOGGLE STATUS ----------
  toggleStatus(u: AppUser): void {
    this.userManagement.changeStatus(u.id, !u.isActive).subscribe({
      next: (res) => {
        this.loadUsers();
        this.toast.success(
         res.message ?? (u.isActive ? 'تم تعطيل المستخدم بنجاح' : 'تم تفعيل المستخدم بنجاح'),
         u.isActive ? 'تعطيل مستخدم' : 'تفعيل مستخدم'
        );
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
