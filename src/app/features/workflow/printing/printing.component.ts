import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  startWith,
  switchMap,
  tap
} from 'rxjs';

import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';

import { SelectOption } from '../../../core/models/committee.model';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';
import { PrintingService } from './service/printing-service';
import { Lookups } from '../../../shared/services/lookups';

interface ReviewUser {
  id: number;
  name: string;
  role: string;
  avatar?: string;
}

@Component({
  selector: 'app-printing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,

    SelectModule,
    MultiSelectModule,
    TableModule,
    MenuModule,
    DialogModule,
    ButtonModule,
    TextareaModule,
    TooltipModule,
    InputTextModule,

    WorkflowStepLayoutComponent
  ],
  templateUrl: './printing.component.html',
  styleUrl: './printing.component.scss'
})
export default class PrintingComponent {
  private readonly service = inject(PrintingService);
  private readonly lookupsService = inject(Lookups);
  private readonly reload$ = new Subject<void>();
  private readonly committeeInput$ = new Subject<string>();
  readonly governorates = signal<SelectOption[]>([
  { label: 'كل المحافظات', value: '' }
]);

readonly subjects = signal<SelectOption[]>([
  { label: 'كل المواد', value: '' }
]);

readonly governoratesLoading = signal(false);
readonly subjectsLoading = signal(false);

  readonly pageSizeOptions = [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '20', value: 20 }
  ];

  // ==========================================
  // SEARCH
  // ==========================================

  selectedGovernorate = '';
  selectedSubject = '';
  selectedCommittee = '';

  // ==========================================
  // PAGE ESSENTIALS
  // ==========================================

  readonly essentials = [
    'البحث بالمحافظة',
    'البحث بالمادة',
    'البحث برقم اللجنة',
    'تسجيل انتهاء الطباعة'
  ];

  // ==========================================
  // TABLE DATA (SERVER SIDE)
  // ==========================================

  readonly rows = signal<WorkflowStatusRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);

  // ==========================================
  // PAGINATION
  // ==========================================

  readonly pageSize = signal(5);
  readonly currentPage = signal(1);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize()))
  );

  readonly paginationPages = computed<(number | 'dots')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 4) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 2) {
      return [1, 2, 3, 'dots', total];
    }
    if (current >= total - 1) {
      return [1, 'dots', total - 2, total - 1, total];
    }
    return [1, 'dots', current, 'dots', total];
  });

  readonly paginationStart = computed(() =>
    this.total() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1
  );

  readonly paginationEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.total())
  );

  constructor() {
    this.loadGovernorates();
this.loadSubjects();
    // تحميل الداتا (فوري) عند أول فتح وعند أي تغيير في الفلاتر/الصفحة
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => this.loading.set(true)),
        switchMap(() =>
          this.service
            .getList({
              governorate: this.selectedGovernorate,
              subject: this.selectedSubject,
              committeeNumber: this.selectedCommittee,
              page: this.currentPage(),
              pageSize: this.pageSize()
            })
            .pipe(catchError(() => of({ items: [], total: 0 })))
        ),
        takeUntilDestroyed()
      )
      .subscribe(res => {
        this.rows.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      });

    // البحث برقم اللجنة (بعد ما المستخدم يوقف كتابة)
    this.committeeInput$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.onFilterChange());
  }

  reload(): void {
    this.reload$.next();
  }

  /** أي تغيير في الفلاتر يرجّع لأول صفحة */
  onFilterChange(): void {
    this.currentPage.set(1);
    this.reload();
  }

  onCommitteeInput(value: string): void {
    this.selectedCommittee = value;
    this.committeeInput$.next(value.trim());
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.currentPage.set(page);
    this.reload();
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.onFilterChange();
  }


  private extractItems(response: any): any[] {
  if (Array.isArray(response)) {
    return response;
  }

  const possibleArrays = [
    response?.data,
    response?.data?.data,
    response?.result,
    response?.result?.data,
    response?.items
  ];

  return possibleArrays.find(Array.isArray) ?? [];
}

loadGovernorates(): void {
  this.governoratesLoading.set(true);

  this.lookupsService
    .getLookupGovernorateData()
    .pipe(
      catchError(error => {
        console.error('Error loading governorates:', error);
        return of([]);
      }),
      finalize(() => this.governoratesLoading.set(false)),
      takeUntilDestroyed()
    )
    .subscribe(response => {
      const items = this.extractItems(response);

      const options: SelectOption[] = items
        .map((item: any) => {
          const id =
            item.id ??
            item.governorateId ??
            item.governorateID;

          const name =
            item.name ??
            item.governorateName ??
            item.governorate;

          return {
            label: String(name ?? ''),
            value: String(id ?? '')
          };
        })
        .filter(item => item.label && item.value);

      this.governorates.set([
        { label: 'كل المحافظات', value: '' },
        ...options
      ]);
    });
}

loadSubjects(): void {
  this.subjectsLoading.set(true);

  this.lookupsService
    .getLookupSubjectData()
    .pipe(
      catchError(error => {
        console.error('Error loading subjects:', error);
        return of([]);
      }),
      finalize(() => this.subjectsLoading.set(false)),
      takeUntilDestroyed()
    )
    .subscribe(response => {
      const items = this.extractItems(response);

      const options: SelectOption[] = items
        .map((item: any) => {
          const id =
            item.id ??
            item.subjectId ??
            item.subjectID;

          const name =
            item.name ??
            item.subjectName ??
            item.subject;

          return {
            label: String(name ?? ''),
            value: String(id ?? '')
          };
        })
        .filter(item => item.label && item.value);

      this.subjects.set([
        { label: 'كل المواد', value: '' },
        ...options
      ]);
    });
}

  // ==========================================
  // STATUS MENU
  // ==========================================

  selectedRow: any | null = null;

  readonly menuItems: MenuItem[] = [];

  openStatusMenu(row: WorkflowStatusRow, menu: any, event: Event): void {
    this.selectedRow = row;

    this.menuItems.length = 0;
    this.menuItems.push(...this.buildMenuItems(row));

    menu.toggle(event);
  }

  private buildMenuItems(row: WorkflowStatusRow): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: 'تسجيل انتهاء الطباعة',
        icon: 'pi pi-check-circle',
        command: () => this.finishSelectedPrinting()
      }
    ];

    if (row.status !== 'تم الانتهاء' && row.status !== 'مرفوض') {
      items.push(
        { separator: true },
        {
          label: 'رفض المادة',
          icon: 'pi pi-times-circle',
          styleClass: 'reject-menu-item',
          command: () => this.openRejectDialog()
        }
      );
    }

    return items;
  }

  // ==========================================
  // REVIEW USERS
  // ==========================================

  readonly reviewUsers: ReviewUser[] = [
    { id: 1, name: 'أحمد محمد', role: 'مراجع أول' },
    { id: 2, name: 'محمد علي', role: 'مراجع جودة' },
    { id: 3, name: 'سارة أحمد', role: 'مراجع محتوى' },
    { id: 4, name: 'محمود حسن', role: 'مراجع نهائي' }
  ];

  // ==========================================
  // REJECT DIALOG
  // ==========================================

  rejectDialogVisible = false;
  rejectReason = '';
  selectedReviewers: ReviewUser[] = [];
  rejectSubmitting = false;

  get isRejectFormValid(): boolean {
    return this.rejectReason.trim().length >= 10 && this.selectedReviewers.length > 0;
  }

  openRejectDialog(): void {
    if (!this.selectedRow) {
      return;
    }
    this.rejectReason = '';
    this.selectedReviewers = [];
    this.rejectSubmitting = false;
    this.rejectDialogVisible = true;
  }

  closeRejectDialog(): void {
    if (this.rejectSubmitting) {
      return;
    }
    this.rejectDialogVisible = false;
    this.rejectReason = '';
    this.selectedReviewers = [];
  }

  submitRejection(): void {
    if (!this.selectedRow || !this.isRejectFormValid) {
      return;
    }

    this.rejectSubmitting = true;

    this.service
      .reject(this.selectedRow.id, {
        reason: this.rejectReason.trim(),
        reviewerIds: this.selectedReviewers.map(u => u.id)
      })
      .pipe(finalize(() => (this.rejectSubmitting = false)))
      .subscribe({
        next: () => {
          this.rejectDialogVisible = false;
          this.selectedRow = null;
          this.rejectReason = '';
          this.selectedReviewers = [];
          this.reload();
        }
      });
  }

  // ==========================================
  // VIEW REJECTION REASON DIALOG
  // ==========================================

  rejectionReasonDialogVisible = false;
  selectedRejectionReason = '';

  openRejectionReasonDialog(row: WorkflowStatusRow): void {
    if (row.status !== 'مرفوض') {
      return;
    }
    this.selectedRow = row;
    this.selectedRejectionReason =
      row.rejectionReason?.trim() || 'لم يتم تسجيل سبب الرفض.';
    this.rejectionReasonDialogVisible = true;
  }

  closeRejectionReasonDialog(): void {
    this.rejectionReasonDialogVisible = false;
    this.selectedRejectionReason = '';
    this.selectedRow = null;
  }

  // ==========================================
  // FINISH PRINTING
  // ==========================================

  finishSelectedPrinting(): void {
    if (!this.selectedRow) {
      return;
    }

    this.service.finish(this.selectedRow.id).subscribe({
      next: () => {
        this.selectedRow = null;
        this.reload();
      }
    });
  }

  markSelectedRowReady(): void {
    this.finishSelectedPrinting();
  }
}