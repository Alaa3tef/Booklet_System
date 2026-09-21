import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CheckboxModule } from 'primeng/checkbox';
import { BadgeModule } from 'primeng/badge';
import { ProgressBarModule } from 'primeng/progressbar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { AccordionModule } from 'primeng/accordion';
import { MenuItem } from 'primeng/api';

interface Permission {
  id: number;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  icon?: string;
}

interface PermissionModule {
  id: number;
  name: string;
  icon: string;
  route?: string;
  description?: string;
  expanded?: boolean;
  group?: boolean;
  children?: PermissionModule[];
  permissions: Permission[];
}

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  avatar?: string;
  status: 'Active' | 'Inactive';
}

@Component({
  selector: 'app-user-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    CheckboxModule,
    BadgeModule,
    ProgressBarModule,
    BreadcrumbModule,
    AccordionModule
  ],
  templateUrl: './user-permissions.html',
  styleUrl: './user-permissions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserPermissionsComponent {

  /* =========================================================
     Breadcrumb
  ========================================================= */

  breadcrumbItems: MenuItem[] = [
    {
      label: 'الإعدادات'
    },
    {
      label: 'الصلاحيات'
    }
  ];

  breadcrumbHome: MenuItem = {
    icon: 'pi pi-home',
    routerLink: '/'
  };


  /* =========================================================
     Users
  ========================================================= */

  users = signal<User[]>([
    {
      id: 1,
      name: 'محمود علي',
      username: 'mahmoud.ali',
      email: 'mahmoud@example.com',
      role: 'مدير إدارة',
      status: 'Active'
    },
    {
      id: 2,
      name: 'أحمد محمد',
      username: 'ahmed.mohamed',
      email: 'ahmed@example.com',
      role: 'موظف',
      status: 'Active'
    },
    {
      id: 3,
      name: 'محمد السيد',
      username: 'mohamed.elsayed',
      email: 'mohamed@example.com',
      role: 'جامعة',
      status: 'Active'
    },
    {
      id: 4,
      name: 'سارة أحمد',
      username: 'sara.ahmed',
      email: 'sara@example.com',
      role: 'كلية',
      status: 'Inactive'
    }
  ]);

  selectedUserId = signal<number>(1);

  userSearch = signal<string>('');


  selectedUser = computed(() =>
    this.users().find(
      user => user.id === this.selectedUserId()
    ) ?? null
  );


  filteredUsers = computed(() => {

    const search = this.userSearch()
      .trim()
      .toLowerCase();

    if (!search) {
      return this.users();
    }

    return this.users().filter(user =>
      user.name.toLowerCase().includes(search) ||
      user.username.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      user.role.toLowerCase().includes(search)
    );
  });


  /* =========================================================
     Permissions
  ========================================================= */

  modules = signal<PermissionModule[]>([

    /* =========================
       Dashboard
    ========================= */

    {
      id: 1,
      name: 'الرئيسية',
      icon: 'pi pi-home',
      route: '/dashboard',
      description: 'الصفحة الرئيسية ولوحة المعلومات',
      permissions: [
        {
          id: 101,
          key: 'dashboard.view',
          name: 'عرض الصفحة الرئيسية',
          description: 'السماح للمستخدم بالدخول إلى لوحة المعلومات',
          icon: 'pi pi-eye',
          enabled: true
        }
      ]
    },


    /* =========================
       Basic Data
    ========================= */

    {
      id: 2,
      name: 'إدارة البيانات الأساسية',
      icon: 'pi pi-database',
      description: 'إدارة المحافظات والمواد واللجان',
      group: true,
      permissions: [],
      children: [

        {
          id: 21,
          name: 'المحافظات',
          icon: 'pi pi-map',
          route: '/governorates',
          description: 'إدارة المحافظات',
          permissions: [
            {
              id: 2101,
              key: 'governorates.view',
              name: 'عرض المحافظات',
              icon: 'pi pi-eye',
              enabled: true
            },
            {
              id: 2102,
              key: 'governorates.create',
              name: 'إضافة محافظة',
              icon: 'pi pi-plus',
              enabled: false
            },
            {
              id: 2103,
              key: 'governorates.edit',
              name: 'تعديل المحافظة',
              icon: 'pi pi-pencil',
              enabled: false
            },
            {
              id: 2104,
              key: 'governorates.delete',
              name: 'حذف المحافظة',
              icon: 'pi pi-trash',
              enabled: false
            }
          ]
        },

        {
          id: 22,
          name: 'المواد',
          icon: 'pi pi-box',
          route: '/materials',
          description: 'إدارة المواد والخامات',
          permissions: [
            {
              id: 2201,
              key: 'materials.view',
              name: 'عرض المواد',
              icon: 'pi pi-eye',
              enabled: true
            },
            {
              id: 2202,
              key: 'materials.create',
              name: 'إضافة مادة',
              icon: 'pi pi-plus',
              enabled: false
            },
            {
              id: 2203,
              key: 'materials.edit',
              name: 'تعديل المادة',
              icon: 'pi pi-pencil',
              enabled: false
            },
            {
              id: 2204,
              key: 'materials.delete',
              name: 'حذف المادة',
              icon: 'pi pi-trash',
              enabled: false
            }
          ]
        },

        {
          id: 23,
          name: 'إدارة اللجان',
          icon: 'pi pi-users',
          route: '/committees/setup',
          description: 'إعداد وإدارة اللجان',
          permissions: [
            {
              id: 2301,
              key: 'committees.view',
              name: 'عرض اللجان',
              icon: 'pi pi-eye',
              enabled: true
            },
            {
              id: 2302,
              key: 'committees.create',
              name: 'إضافة لجنة',
              icon: 'pi pi-plus',
              enabled: false
            },
            {
              id: 2303,
              key: 'committees.edit',
              name: 'تعديل اللجنة',
              icon: 'pi pi-pencil',
              enabled: false
            },
            {
              id: 2304,
              key: 'committees.delete',
              name: 'حذف اللجنة',
              icon: 'pi pi-trash',
              enabled: false
            }
          ]
        }
      ]
    },


    /* =========================
       Planning
    ========================= */

    {
      id: 3,
      name: 'الإعداد',
      icon: 'pi pi-sliders-h',
      route: '/workflow/planning',
      description: 'إعداد ومتابعة مراحل العمل',
      permissions: [
        {
          id: 301,
          key: 'planning.view',
          name: 'عرض الإعداد',
          icon: 'pi pi-eye',
          enabled: true
        },
        {
          id: 302,
          key: 'planning.create',
          name: 'إضافة إعداد',
          icon: 'pi pi-plus',
          enabled: false
        },
        {
          id: 303,
          key: 'planning.edit',
          name: 'تعديل الإعداد',
          icon: 'pi pi-pencil',
          enabled: false
        },
        {
          id: 304,
          key: 'planning.execute',
          name: 'تنفيذ العمليات',
          icon: 'pi pi-play',
          enabled: false
        }
      ]
    },


    /* =========================
       Printing
    ========================= */

    {
      id: 4,
      name: 'الطباعة',
      icon: 'pi pi-print',
      route: '/workflow/printing',
      description: 'إدارة ومتابعة عمليات الطباعة',
      permissions: [
        {
          id: 401,
          key: 'printing.view',
          name: 'عرض الطباعة',
          icon: 'pi pi-eye',
          enabled: true
        },
        {
          id: 402,
          key: 'printing.print',
          name: 'تنفيذ الطباعة',
          icon: 'pi pi-print',
          enabled: false
        },
        {
          id: 403,
          key: 'printing.updateStatus',
          name: 'تغيير حالة الطباعة',
          icon: 'pi pi-sync',
          enabled: false
        }
      ]
    },


    /* =========================
       Quality
    ========================= */

    {
      id: 5,
      name: 'الجودة',
      icon: 'pi pi-verified',
      route: '/workflow/quality',
      description: 'مراجعة واعتماد الجودة',
      permissions: [
        {
          id: 501,
          key: 'quality.view',
          name: 'عرض الجودة',
          icon: 'pi pi-eye',
          enabled: true
        },
        {
          id: 502,
          key: 'quality.review',
          name: 'مراجعة الجودة',
          icon: 'pi pi-search',
          enabled: false
        },
        {
          id: 503,
          key: 'quality.approve',
          name: 'اعتماد الجودة',
          icon: 'pi pi-check',
          enabled: false
        },
        {
          id: 504,
          key: 'quality.reject',
          name: 'رفض الجودة',
          icon: 'pi pi-times',
          enabled: false
        }
      ]
    },


    /* =========================
       Packing
    ========================= */

    {
      id: 6,
      name: 'التغليف',
      icon: 'pi pi-box',
      route: '/workflow/packing',
      description: 'إدارة عمليات التغليف',
      permissions: [
        {
          id: 601,
          key: 'packing.view',
          name: 'عرض التغليف',
          icon: 'pi pi-eye',
          enabled: true
        },
        {
          id: 602,
          key: 'packing.update',
          name: 'تحديث حالة التغليف',
          icon: 'pi pi-sync',
          enabled: false
        },
        {
          id: 603,
          key: 'packing.complete',
          name: 'إنهاء التغليف',
          icon: 'pi pi-check',
          enabled: false
        }
      ]
    },


    /* =========================
       Archiving
    ========================= */

    {
      id: 7,
      name: 'التخزين',
      icon: 'pi pi-database',
      route: '/workflow/archiving',
      description: 'إدارة التخزين والأرشفة',
      permissions: [
        {
          id: 701,
          key: 'archiving.view',
          name: 'عرض التخزين',
          icon: 'pi pi-eye',
          enabled: true
        },
        {
          id: 702,
          key: 'archiving.update',
          name: 'تحديث التخزين',
          icon: 'pi pi-pencil',
          enabled: false
        },
        {
          id: 703,
          key: 'archiving.archive',
          name: 'أرشفة الملفات',
          icon: 'pi pi-folder',
          enabled: false
        }
      ]
    },


    /* =========================
       Production
    ========================= */

    {
      id: 8,
      name: 'إنتاج الملفات',
      icon: 'pi pi-file-export',
      route: '/production',
      description: 'إنتاج وتجهيز الملفات',
      permissions: [
        {
          id: 801,
          key: 'production.view',
          name: 'عرض إنتاج الملفات',
          icon: 'pi pi-eye',
          enabled: true
        },
        {
          id: 802,
          key: 'production.generate',
          name: 'إنتاج الملفات',
          icon: 'pi pi-file-export',
          enabled: false
        },
        {
          id: 803,
          key: 'production.download',
          name: 'تحميل الملفات',
          icon: 'pi pi-download',
          enabled: false
        }
      ]
    },


    /* =========================
       Reports
    ========================= */

    {
      id: 9,
      name: 'المتابعة والتقارير',
      icon: 'pi pi-chart-bar',
      route: '/reports',
      description: 'عرض ومتابعة التقارير والإحصائيات',
      permissions: [
        {
          id: 901,
          key: 'reports.view',
          name: 'عرض التقارير',
          icon: 'pi pi-eye',
          enabled: true
        },
        {
          id: 902,
          key: 'reports.export',
          name: 'تصدير التقارير',
          icon: 'pi pi-download',
          enabled: false
        },
        {
          id: 903,
          key: 'reports.print',
          name: 'طباعة التقارير',
          icon: 'pi pi-print',
          enabled: false
        }
      ]
    },


    /* =========================
       Users
    ========================= */

    {
      id: 10,
      name: 'إدارة المستخدمين',
      icon: 'pi pi-users',
      route: '/users',
      description: 'إدارة المستخدمين والصلاحيات',
      permissions: [
        {
          id: 1001,
          key: 'users.view',
          name: 'عرض المستخدمين',
          icon: 'pi pi-eye',
          enabled: true
        },
        {
          id: 1002,
          key: 'users.create',
          name: 'إضافة مستخدم',
          icon: 'pi pi-user-plus',
          enabled: false
        },
        {
          id: 1003,
          key: 'users.edit',
          name: 'تعديل المستخدمين',
          icon: 'pi pi-pencil',
          enabled: false
        },
        {
          id: 1004,
          key: 'users.delete',
          name: 'حذف المستخدمين',
          icon: 'pi pi-trash',
          enabled: false
        },
        {
          id: 1005,
          key: 'users.permissions',
          name: 'إدارة الصلاحيات',
          icon: 'pi pi-shield',
          enabled: false
        }
      ]
    },


    /* =========================
       Settings
    ========================= */

    {
      id: 11,
      name: 'الإعدادات',
      icon: 'pi pi-cog',
      route: '/settings',
      description: 'إعدادات النظام',
      permissions: [
        {
          id: 1101,
          key: 'settings.view',
          name: 'عرض الإعدادات',
          icon: 'pi pi-eye',
          enabled: true
        },
        {
          id: 1102,
          key: 'settings.edit',
          name: 'تعديل الإعدادات',
          icon: 'pi pi-pencil',
          enabled: false
        },
        {
          id: 1103,
          key: 'settings.roles',
          name: 'إدارة الأدوار',
          icon: 'pi pi-shield',
          enabled: false
        }
      ]
    }

  ]);


  /* =========================================================
     Permission Calculations
  ========================================================= */

  private getAllPermissions(
    modules: PermissionModule[] = this.modules()
  ): Permission[] {

    return modules.flatMap(module => [
      ...module.permissions,
      ...(module.children
        ? this.getAllPermissions(module.children)
        : [])
    ]);
  }


  totalPermissions = computed(() =>
    this.getAllPermissions().length
  );


  enabledPermissions = computed(() =>
    this.getAllPermissions()
      .filter(permission => permission.enabled)
      .length
  );


  permissionPercentage = computed(() => {

    const total = this.totalPermissions();

    if (!total) {
      return 0;
    }

    return Math.round(
      (this.enabledPermissions() / total) * 100
    );
  });


  /* =========================================================
     User
  ========================================================= */

  selectUser(user: User): void {

    this.selectedUserId.set(user.id);

    // هنا بعدين تقدر تجيب صلاحيات اليوزر من الـ API
    // this.helper.loadUserPermissions(user.id);
  }


  getInitials(name: string): string {

    if (!name) {
      return '';
    }

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  }


  /* =========================================================
     Module Helpers
  ========================================================= */

  getModulePermissions(module: PermissionModule): Permission[] {

    const ownPermissions = module.permissions ?? [];

    const childPermissions =
      module.children?.flatMap(child =>
        this.getModulePermissions(child)
      ) ?? [];

    return [
      ...ownPermissions,
      ...childPermissions
    ];
  }


  getEnabledPermissionsCount(
    module: PermissionModule
  ): number {

    return this.getModulePermissions(module)
      .filter(permission => permission.enabled)
      .length;
  }


  getTotalModulePermissions(
    module: PermissionModule
  ): number {

    return this.getModulePermissions(module).length;
  }


  getModulePercentage(
    module: PermissionModule
  ): number {

    const total = this.getTotalModulePermissions(module);

    if (!total) {
      return 0;
    }

    return Math.round(
      (this.getEnabledPermissionsCount(module) / total) * 100
    );
  }


  isModuleFullySelected(
    module: PermissionModule
  ): boolean {

    const permissions = this.getModulePermissions(module);

    return (
      permissions.length > 0 &&
      permissions.every(permission => permission.enabled)
    );
  }


  isModulePartiallySelected(
    module: PermissionModule
  ): boolean {

    const permissions = this.getModulePermissions(module);

    const enabled = permissions.filter(
      permission => permission.enabled
    ).length;

    return (
      enabled > 0 &&
      enabled < permissions.length
    );
  }


  /* =========================================================
     Toggle Module
  ========================================================= */

  toggleModulePermissions(
    moduleId: number
  ): void {

    this.modules.update(modules =>
      modules.map(module => {

        if (module.id === moduleId) {

          const permissions =
            this.getModulePermissions(module);

          const enable =
            !this.isModuleFullySelected(module);

          return this.updateModulePermissions(
            module,
            permissions.map(permission => ({
              ...permission,
              enabled: enable
            }))
          );
        }

        return {
          ...module,
          children: module.children?.map(child =>
            this.updateChildModule(
              child,
              moduleId
            )
          )
        };
      })
    );
  }


  private updateChildModule(
    module: PermissionModule,
    targetId: number
  ): PermissionModule {

    if (module.id === targetId) {

      const enable =
        !this.isModuleFullySelected(module);

      return {
        ...module,
        permissions: module.permissions.map(permission => ({
          ...permission,
          enabled: enable
        }))
      };
    }

    return {
      ...module,
      children: module.children?.map(child =>
        this.updateChildModule(child, targetId)
      )
    };
  }


  private updateModulePermissions(
    module: PermissionModule,
    permissions: Permission[]
  ): PermissionModule {

    const permissionMap = new Map(
      permissions.map(permission => [
        permission.id,
        permission.enabled
      ])
    );

    return {
      ...module,

      permissions: module.permissions.map(permission => ({
        ...permission,
        enabled:
          permissionMap.get(permission.id)
          ?? permission.enabled
      })),

      children: module.children?.map(child =>
        this.updateModulePermissions(
          child,
          permissions
        )
      )
    };
  }


  /* =========================================================
     Single Permission
  ========================================================= */

  togglePermission(
    moduleId: number,
    permissionId: number
  ): void {

    this.modules.update(modules =>
      modules.map(module =>
        this.togglePermissionInModule(
          module,
          moduleId,
          permissionId
        )
      )
    );
  }


  private togglePermissionInModule(
    module: PermissionModule,
    moduleId: number,
    permissionId: number
  ): PermissionModule {

    if (module.id === moduleId) {

      return {
        ...module,

        permissions: module.permissions.map(permission =>
          permission.id === permissionId
            ? {
                ...permission,
                enabled: !permission.enabled
              }
            : permission
        )
      };
    }

    return {
      ...module,

      children: module.children?.map(child =>
        this.togglePermissionInModule(
          child,
          moduleId,
          permissionId
        )
      )
    };
  }


  /* =========================================================
     All Permissions
  ========================================================= */

  areAllPermissionsSelected(): boolean {

    const permissions =
      this.getAllPermissions();

    return (
      permissions.length > 0 &&
      permissions.every(permission => permission.enabled)
    );
  }


  toggleAllPermissions(): void {

    const enable =
      !this.areAllPermissionsSelected();

    this.modules.update(modules =>
      modules.map(module =>
        this.setModulePermissions(
          module,
          enable
        )
      )
    );
  }


  private setModulePermissions(
    module: PermissionModule,
    enabled: boolean
  ): PermissionModule {

    return {
      ...module,

      permissions: module.permissions.map(permission => ({
        ...permission,
        enabled
      })),

      children: module.children?.map(child =>
        this.setModulePermissions(
          child,
          enabled
        )
      )
    };
  }


  /* =========================================================
     Reset
  ========================================================= */

  resetPermissions(): void {

    this.modules.update(modules =>
      modules.map(module =>
        this.setModulePermissions(
          module,
          false
        )
      )
    );
  }


  /* =========================================================
     Save
  ========================================================= */

  savePermissions(): void {

    const userId =
      this.selectedUserId();

    const permissions =
      this.getAllPermissions()
        .filter(permission => permission.enabled)
        .map(permission => ({
          permissionId: permission.id,
          key: permission.key
        }));

    const payload = {
      userId,
      permissions
    };

    console.log(
      'Permissions Payload:',
      payload
    );

    // بعدين:
    // this.helper.saveUserPermissions(payload);
  }


  /* =========================================================
     Track
  ========================================================= */

  trackByUser(
    index: number,
    user: User
  ): number {

    return user.id;
  }


  trackByModule(
    index: number,
    module: PermissionModule
  ): number {

    return module.id;
  }


  trackByPermission(
    index: number,
    permission: Permission
  ): number {

    return permission.id;
  }
}