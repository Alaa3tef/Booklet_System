
import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { finalize } from 'rxjs/operators';

import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PaginatorModule } from 'primeng/paginator';
import { CommitteeTypesService, CommitteeType, CommitteeTypeRequest } from '../service/commit-type';



@Component({
 selector: 'app-commit-type-component',  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,FormsModule,
    ButtonModule,
    DialogModule,
    PaginatorModule
  ],
   templateUrl: './commit-type-component.html',
  styleUrl: './commit-type-component.scss',
})
export default class CommitteeTypesComponent implements OnInit {

  private service = inject(CommitteeTypesService);
  private fb = inject(FormBuilder);

  // ================================
  // Data
  // ================================

  committeeTypes: CommitteeType[] = [];

  loading = false;
  saving = false;

  // ================================
  // Pagination
  // ================================

  pageNumber = 1;
  pageSize = 10;
  totalRecords = 0;

  // ================================
  // Search
  // ================================

  searchTerm = '';

  // ================================
  // Dialog
  // ================================

  displayDialog = false;
  isEditMode = false;
  selectedId: number | null = null;

  committeeTypeForm!: FormGroup;

  // ================================
  // Messages
  // ================================

  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    this.initializeForm();
    this.loadCommitteeTypes();
  }

  // ================================
  // Initialize Form
  // ================================

  initializeForm(): void {
    this.committeeTypeForm = this.fb.group({
      code: ['', [
        Validators.required,
        Validators.maxLength(50)
      ]],

      name: ['', [
        Validators.required,
        Validators.maxLength(200)
      ]],

      isActive: [true]
    });
  }

  // ================================
  // Load Committee Types
  // ================================

  loadCommitteeTypes(): void {

    this.loading = true;
    this.clearMessages();

    this.service.getAll(
      this.pageNumber,
      this.pageSize,
      this.searchTerm,
      true
    )
    .pipe(
      finalize(() => this.loading = false)
    )
    .subscribe({
      next: (response) => {

        if (response?.success && response.data) {

          const result = response.data;

          this.committeeTypes = result.data ?? [];
          this.totalRecords = result.totalCount ?? 0;

          this.pageNumber = result.currentPage || this.pageNumber;
          this.pageSize = result.pageSize || this.pageSize;

        } else {

          this.committeeTypes = [];
          this.totalRecords = 0;

          this.errorMessage =
            response?.message || 'حدث خطأ أثناء تحميل البيانات';
        }
      },

      error: (error) => {

        this.committeeTypes = [];
        this.totalRecords = 0;

        this.errorMessage =
          error?.error?.message ||
          'تعذر الاتصال بالخادم أثناء تحميل أنواع اللجان';

        console.error('Load Committee Types Error:', error);
      }
    });
  }

  // ================================
  // Search
  // ================================

  onSearch(): void {
    this.pageNumber = 1;
    this.loadCommitteeTypes();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.pageNumber = 1;
    this.loadCommitteeTypes();
  }

  // ================================
  // Pagination
  // ================================

  onPageChange(event: any): void {

    this.pageNumber = event.page + 1;
    this.pageSize = event.rows;

    this.loadCommitteeTypes();
  }

  // ================================
  // Open Add Dialog
  // ================================

  openAddDialog(): void {

    this.isEditMode = false;
    this.selectedId = null;

    this.committeeTypeForm.reset({
      code: '',
      name: '',
      isActive: true
    });

    this.clearMessages();

    this.displayDialog = true;
  }

  // ================================
  // Open Edit Dialog
  // ================================

  openEditDialog(item: CommitteeType): void {

    this.clearMessages();

    this.isEditMode = true;
    this.selectedId = item.id;

    this.loading = true;

    this.service.getById(item.id)
      .pipe(
        finalize(() => this.loading = false)
      )
      .subscribe({

        next: (response) => {

          if (response?.success && response.data) {

            const committeeType = response.data;

            this.committeeTypeForm.patchValue({
              code: committeeType.code,
              name: committeeType.name,
              isActive: committeeType.isActive
            });

            this.displayDialog = true;

          } else {

            this.errorMessage =
              response?.message || 'تعذر تحميل بيانات نوع اللجنة';
          }
        },

        error: (error) => {

          this.errorMessage =
            error?.error?.message ||
            'حدث خطأ أثناء تحميل بيانات نوع اللجنة';

          console.error('Get Committee Type Error:', error);
        }
      });
  }

  // ================================
  // Save (Create / Update)
  // ================================

  saveCommitteeType(): void {

    if (this.committeeTypeForm.invalid) {
      this.committeeTypeForm.markAllAsTouched();
      return;
    }

    const request: CommitteeTypeRequest = {
      code: this.committeeTypeForm.value.code.trim(),
      name: this.committeeTypeForm.value.name.trim(),
      isActive: this.committeeTypeForm.value.isActive
    };

    if (!request.code || !request.name) {
      return;
    }

    this.saving = true;
    this.clearMessages();

    const request$ = this.isEditMode && this.selectedId !== null
      ? this.service.update(this.selectedId, request)
      : this.service.create(request);

    request$
      .pipe(
        finalize(() => this.saving = false)
      )
      .subscribe({

        next: (response) => {

          if (response?.success) {

            this.displayDialog = false;

            this.successMessage = this.isEditMode
              ? 'تم تعديل نوع اللجنة بنجاح'
              : 'تم إضافة نوع اللجنة بنجاح';

            this.loadCommitteeTypes();

          } else {

            this.errorMessage =
              response?.message || 'لم يتم حفظ البيانات';

            if (response?.errors?.length) {
              this.errorMessage +=
                ' - ' + response.errors.join('، ');
            }
          }
        },

        error: (error) => {

          this.errorMessage =
            error?.error?.message ||
            error?.error?.errors?.join('، ') ||
            'حدث خطأ أثناء حفظ البيانات';

          console.error('Save Committee Type Error:', error);
        }
      });
  }

  // ================================
  // Close Dialog
  // ================================

  closeDialog(): void {
    this.displayDialog = false;
    this.committeeTypeForm.reset({
      code: '',
      name: '',
      isActive: true
    });
  }

  // ================================
  // Helpers
  // ================================

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  get codeControl() {
    return this.committeeTypeForm.get('code');
  }

  get nameControl() {
    return this.committeeTypeForm.get('name');
  }

  trackById(index: number, item: CommitteeType): number {
    return item.id;
  }
}
