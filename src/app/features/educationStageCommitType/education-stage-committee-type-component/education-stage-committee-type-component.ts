
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PaginatorModule } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { EduStageCommitteeTypesService, EduStageCommitteeType, CommitteeTypeLookup, EduStageCommitteeTypeRequest } from '../service/education-stage-commit-type';



@Component({
   selector: 'app-education-stage-committee-type-component',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    ButtonModule,
    DialogModule,
    PaginatorModule,
    SelectModule,
    InputNumberModule
  ],
 templateUrl: './education-stage-committee-type-component.html',
  styleUrl: './education-stage-committee-type-component.scss',
})
export default class EduStageCommitteeTypesComponent implements OnInit {

  private service = inject(EduStageCommitteeTypesService);
  private fb = inject(FormBuilder);

  // ==========================================
  // Data
  // ==========================================

  committeeTypesData: EduStageCommitteeType[] = [];
  committeeTypesLookup: CommitteeTypeLookup[] = [];

  loading = false;
  saving = false;
  loadingDetails = false;

  // ==========================================
  // Pagination
  // ==========================================

  pageNumber = 1;
  pageSize = 10;
  totalRecords = 0;

  // ==========================================
  // Filters
  // ==========================================

  searchTerm = '';
  filterEducationalStageId: number | null = null;
  filterCommitteeTypeId: number | null = null;
  filterIsActive: boolean | null = null;

  statusOptions = [
    { label: 'كل الحالات', value: null },
    { label: 'نشط', value: true },
    { label: 'غير نشط', value: false }
  ];

  // ==========================================
  // Dialog
  // ==========================================

  displayDialog = false;
  isEditMode = false;
  selectedId: number | null = null;

  committeeForm!: FormGroup;

  // ==========================================
  // Messages
  // ==========================================

  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    this.initializeForm();
    this.loadCommitteeTypesLookup();
    this.loadData();
  }

  // ==========================================
  // Initialize Form
  // ==========================================
get activeCount(): number {
  return this.committeeTypesData.filter(x => x.isActive).length;
}

get closedCount(): number {
  return this.committeeTypesData.filter(x => x.bonusType === 0).length;
}
  initializeForm(): void {

    this.committeeForm = this.fb.group({

      educationalStageId: [
        null,
        [
          Validators.required,
          Validators.min(1)
        ]
      ],

      committeeTypeId: [
        null,
        [
          Validators.required,
          Validators.min(1)
        ]
      ],

      bonusType: [
        0,
        Validators.required
      ],

      bonus: [
        0,
        [
          Validators.required,
          Validators.min(0)
        ]
      ],

      bookletsPerEnvelope: [
        0,
        [
          Validators.required,
          Validators.min(1)
        ]
      ],

      envelopesPerBox: [
        0,
        [
          Validators.required,
          Validators.min(1)
        ]
      ]

    });
  }

  // ==========================================
  // Load Committee Types Lookup
  // ==========================================

  loadCommitteeTypesLookup(): void {

    this.service.getCommitteeTypes().subscribe({

      next: (response) => {

        if (response?.success && response.data) {

          this.committeeTypesLookup =
            (response.data.data || []).filter(item => item.isActive);

        }
      },

      error: (error) => {
        console.error('Committee Types Lookup Error:', error);
      }

    });
  }

  // ==========================================
  // Load Table Data
  // ==========================================

  loadData(): void {

    this.loading = true;
    this.errorMessage = '';

    this.service.getAll(
      this.pageNumber,
      this.pageSize,
      {
        educationalStageId: this.filterEducationalStageId,
        committeeTypeId: this.filterCommitteeTypeId,
        isActive: this.filterIsActive,
        searchTerm: this.searchTerm,
        ascending: true
      }
    )
    .pipe(
      finalize(() => this.loading = false)
    )
    .subscribe({

      next: (response) => {

        if (response?.success && response.data) {

          const result = response.data;

          this.committeeTypesData = result.data || [];
          this.totalRecords = result.totalCount || 0;
          this.pageNumber = result.currentPage || this.pageNumber;
          this.pageSize = result.pageSize || this.pageSize;

        } else {

          this.committeeTypesData = [];
          this.totalRecords = 0;

          this.errorMessage =
            response?.message || 'تعذر تحميل البيانات';
        }

      },

      error: (error) => {

        this.committeeTypesData = [];
        this.totalRecords = 0;

        this.errorMessage =
          error?.error?.message ||
          'حدث خطأ أثناء تحميل بيانات ربط اللجان بالمراحل التعليمية';

        console.error('Load Data Error:', error);

      }

    });

  }

  // ==========================================
  // Search
  // ==========================================

  search(): void {
    this.pageNumber = 1;
    this.loadData();
  }

  resetFilters(): void {

    this.searchTerm = '';
    this.filterEducationalStageId = null;
    this.filterCommitteeTypeId = null;
    this.filterIsActive = null;

    this.pageNumber = 1;

    this.loadData();
  }

  // ==========================================
  // Pagination
  // ==========================================

  onPageChange(event: any): void {

    this.pageNumber = event.page + 1;
    this.pageSize = event.rows;

    this.loadData();
  }

  // ==========================================
  // Open Add Dialog
  // ==========================================

  openAddDialog(): void {

    this.isEditMode = false;
    this.selectedId = null;

    this.clearMessages();

    this.committeeForm.reset({
      educationalStageId: null,
      committeeTypeId: null,
      bonusType: 0,
      bonus: 0,
      bookletsPerEnvelope: 1,
      envelopesPerBox: 1
    });

    this.displayDialog = true;
  }

  // ==========================================
  // Open Edit Dialog
  // ==========================================

  openEditDialog(item: EduStageCommitteeType): void {

    this.clearMessages();

    this.isEditMode = true;
    this.selectedId = item.id;
    this.loadingDetails = true;

    this.service.getById(item.id)
      .pipe(
        finalize(() => this.loadingDetails = false)
      )
      .subscribe({

        next: (response) => {

          if (response?.success && response.data) {

            const data = response.data;

            this.committeeForm.patchValue({

              educationalStageId: data.educationalStageId,
              committeeTypeId: data.committeeTypeId,
              bonusType: data.bonusType,
              bonus: data.bonus,
              bookletsPerEnvelope: data.bookletsPerEnvelope,
              envelopesPerBox: data.envelopesPerBox

            });

            this.displayDialog = true;

          } else {

            this.errorMessage =
              response?.message || 'تعذر تحميل تفاصيل الربط';

          }

        },

        error: (error) => {

          this.errorMessage =
            error?.error?.message ||
            'حدث خطأ أثناء تحميل تفاصيل الربط';

          console.error('Get By ID Error:', error);

        }

      });

  }

  // ==========================================
  // Save (POST)
  // ==========================================

  save(): void {

    if (this.committeeForm.invalid) {

      this.committeeForm.markAllAsTouched();
      return;

    }

    const value = this.committeeForm.getRawValue();

    const request: EduStageCommitteeTypeRequest = {

      educationalStageId: Number(value.educationalStageId),
      committeeTypeId: Number(value.committeeTypeId),
      bonusType: Number(value.bonusType),
      bonus: Number(value.bonus),
      bookletsPerEnvelope: Number(value.bookletsPerEnvelope),
      envelopesPerBox: Number(value.envelopesPerBox)

    };

    if (
      request.educationalStageId <= 0 ||
      request.committeeTypeId <= 0
    ) {
      this.errorMessage = 'يجب إدخال المرحلة التعليمية ونوع اللجنة';
      return;
    }

    this.saving = true;
    this.clearMessages();

    // الـ Backend يستقبل POST في الإضافة والتعديل
    this.service.save(request)
      .pipe(
        finalize(() => this.saving = false)
      )
      .subscribe({

        next: (response) => {

          if (response?.success) {

            this.displayDialog = false;

            this.successMessage = this.isEditMode
              ? 'تم تعديل بيانات الربط بنجاح'
              : 'تم إضافة الربط بنجاح';

            this.loadData();

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

          console.error('Save Error:', error);

        }

      });

  }

  // ==========================================
  // Close Dialog
  // ==========================================

  closeDialog(): void {

    if (this.saving) {
      return;
    }

    this.displayDialog = false;

    this.committeeForm.reset({
      educationalStageId: null,
      committeeTypeId: null,
      bonusType: 0,
      bonus: 0,
      bookletsPerEnvelope: 1,
      envelopesPerBox: 1
    });

  }

  // ==========================================
  // Messages
  // ==========================================

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  // ==========================================
  // Helpers
  // ==========================================

  get educationalStageIdControl() {
    return this.committeeForm.get('educationalStageId');
  }

  get committeeTypeIdControl() {
    return this.committeeForm.get('committeeTypeId');
  }

  get bonusControl() {
    return this.committeeForm.get('bonus');
  }

  get bookletsPerEnvelopeControl() {
    return this.committeeForm.get('bookletsPerEnvelope');
  }

  get envelopesPerBoxControl() {
    return this.committeeForm.get('envelopesPerBox');
  }

  get bonusTypeControl() {
    return this.committeeForm.get('bonusType');
  }

  trackById(index: number, item: EduStageCommitteeType): number {
    return item.id;
  }

}
