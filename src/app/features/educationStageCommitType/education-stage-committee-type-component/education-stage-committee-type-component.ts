
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
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';

import {
  EduStageCommitteeTypesService,
  EduStageCommitteeType,
  EducationalStageLookup,
  CommitteeTypeLookup,
  EduStageCommitteeTypeRequest
} from '../service/education-stage-commit-type';

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
  styleUrl: './education-stage-committee-type-component.scss'
})
export default class EduStageCommitteeTypesComponent implements OnInit {

  private service = inject(EduStageCommitteeTypesService);
  private fb = inject(FormBuilder);

  // ==========================================
  // Data
  // ==========================================

  committeeTypesData: EduStageCommitteeType[] = [];

  educationalStagesLookup: EducationalStageLookup[] = [];
  committeeTypesLookup: CommitteeTypeLookup[] = [];

  loading = false;
  saving = false;
  loadingDetails = false;
  loadingLookups = false;

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

  // IDs محفوظة للتعديل فقط
  // Public حتى يمكن عرضها في HTML

  editEducationalStageId: number | null = null;
  editCommitteeTypeId: number | null = null;

  editEducationalStageName = '';
  editCommitteeTypeName = '';

  // ==========================================
  // Messages
  // ==========================================

  successMessage = '';
  errorMessage = '';

  // ==========================================
  // Init
  // ==========================================

  ngOnInit(): void {
    this.initializeForm();
    this.loadLookups();
    this.loadData();
  }

  // ==========================================
  // Form
  // ==========================================

  initializeForm(): void {

    this.committeeForm = this.fb.group({

      // موجودة في الإضافة فقط
      educationalStageId: [null],

      // موجودة في الإضافة فقط
      committeeTypeId: [null],

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
        1,
        [
          Validators.required,
          Validators.min(1)
        ]
      ],

      envelopesPerBox: [
        1,
        [
          Validators.required,
          Validators.min(1)
        ]
      ]

    });

  }

  // ==========================================
  // Load Lookups
  // ==========================================

  loadLookups(): void {

    this.loadingLookups = true;

    let completed = 0;

    const finishLoading = () => {
      completed++;

      if (completed === 2) {
        this.loadingLookups = false;
      }
    };

    this.service.getEducationalStages()
      .pipe(finalize(finishLoading))
      .subscribe({

        next: (response) => {

          if (response?.success && response.data) {

            this.educationalStagesLookup =
              (response.data.data || [])
                .filter(item => item.isActive);

          } else {

            this.errorMessage =
              response?.message || 'تعذر تحميل المراحل التعليمية';

          }

        },

        error: (error) => {

          this.errorMessage =
            error?.error?.message ||
            'حدث خطأ أثناء تحميل المراحل التعليمية';

          console.error('Educational Stages Error:', error);

        }

      });

    this.service.getCommitteeTypes()
      .pipe(finalize(finishLoading))
      .subscribe({

        next: (response) => {

          if (response?.success && response.data) {

            this.committeeTypesLookup =
              (response.data.data || [])
                .filter(item => item.isActive);

          } else {

            this.errorMessage =
              response?.message || 'تعذر تحميل أنواع اللجان';

          }

        },

        error: (error) => {

          this.errorMessage =
            error?.error?.message ||
            'حدث خطأ أثناء تحميل أنواع اللجان';

          console.error('Committee Types Error:', error);

        }

      });

  }

  // ==========================================
  // Load Table
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
          'حدث خطأ أثناء تحميل بيانات الربط';

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
  // ADD
  // ==========================================

  openAddDialog(): void {

    this.clearMessages();

    this.isEditMode = false;
    this.selectedId = null;

    this.editEducationalStageId = null;
    this.editCommitteeTypeId = null;

    this.editEducationalStageName = '';
    this.editCommitteeTypeName = '';

    this.committeeForm.reset({

      educationalStageId: null,
      committeeTypeId: null,

      bonusType: 0,
      bonus: 0,
      bookletsPerEnvelope: 1,
      envelopesPerBox: 1

    });

    // مطلوبان في الإضافة فقط
    this.educationalStageIdControl?.setValidators([
      Validators.required,
      Validators.min(1)
    ]);

    this.committeeTypeIdControl?.setValidators([
      Validators.required,
      Validators.min(1)
    ]);

    this.educationalStageIdControl?.updateValueAndValidity();
    this.committeeTypeIdControl?.updateValueAndValidity();

    this.displayDialog = true;

  }

  // ==========================================
  // EDIT
  // ==========================================

  openEditDialog(item: EduStageCommitteeType): void {

    this.clearMessages();

    this.isEditMode = true;
    this.selectedId = item.id;

    this.loadingDetails = true;
    this.displayDialog = true;

    this.service.getById(item.id)
      .pipe(
        finalize(() => this.loadingDetails = false)
      )
      .subscribe({

        next: (response) => {

          if (response?.success && response.data) {

            const data = response.data;

            // حفظ IDs الأصلية وعدم السماح بتعديلها
            this.editEducationalStageId = data.educationalStageId;
            this.editCommitteeTypeId = data.committeeTypeId;

            this.editEducationalStageName =
              data.educationalStageName;

            this.editCommitteeTypeName =
              data.committeeTypeName;

            // إلغاء Validators الخاصة بالـ IDs
            this.educationalStageIdControl?.clearValidators();
            this.committeeTypeIdControl?.clearValidators();

            this.educationalStageIdControl?.updateValueAndValidity();
            this.committeeTypeIdControl?.updateValueAndValidity();

            this.committeeForm.reset({

              educationalStageId: null,
              committeeTypeId: null,

              bonusType: data.bonusType,
              bonus: data.bonus,
              bookletsPerEnvelope: data.bookletsPerEnvelope,
              envelopesPerBox: data.envelopesPerBox

            });

          } else {

            this.displayDialog = false;

            this.errorMessage =
              response?.message || 'تعذر تحميل تفاصيل الربط';

          }

        },

        error: (error) => {

          this.displayDialog = false;

          this.errorMessage =
            error?.error?.message ||
            'حدث خطأ أثناء تحميل تفاصيل الربط';

          console.error('Get By ID Error:', error);

        }

      });

  }

  // ==========================================
  // SAVE
  // ==========================================

  save(): void {

    if (this.committeeForm.invalid) {

      this.committeeForm.markAllAsTouched();
      return;

    }

    const value = this.committeeForm.getRawValue();

    let educationalStageId: number;
    let committeeTypeId: number;

    if (this.isEditMode) {

      // في التعديل نستخدم IDs الأصلية فقط
      if (
        !this.editEducationalStageId ||
        !this.editCommitteeTypeId
      ) {

        this.errorMessage =
          'تعذر تحديد المرحلة التعليمية أو نوع اللجنة';

        return;

      }

      educationalStageId = this.editEducationalStageId;
      committeeTypeId = this.editCommitteeTypeId;

    } else {

      // في الإضافة نستخدم اختيارات المستخدم
      educationalStageId = Number(value.educationalStageId);
      committeeTypeId = Number(value.committeeTypeId);

      if (!educationalStageId || !committeeTypeId) {

        this.errorMessage =
          'يجب اختيار المرحلة التعليمية ونوع اللجنة';

        this.committeeForm.markAllAsTouched();
        return;

      }

    }

    const request: EduStageCommitteeTypeRequest = {

      educationalStageId,
      committeeTypeId,

      bonusType: Number(value.bonusType),
      bonus: Number(value.bonus),
      bookletsPerEnvelope: Number(value.bookletsPerEnvelope),
      envelopesPerBox: Number(value.envelopesPerBox)

    };

    this.saving = true;
    this.clearMessages();

    const wasEditMode = this.isEditMode;

    this.service.save(request)
      .pipe(
        finalize(() => this.saving = false)
      )
      .subscribe({

        next: (response) => {

          if (response?.success) {

            this.displayDialog = false;

            this.successMessage = wasEditMode
              ? 'تم تعديل بيانات الربط بنجاح'
              : 'تم إضافة الربط بنجاح';

            this.pageNumber = 1;
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
  // CLOSE
  // ==========================================

  closeDialog(): void {

    if (this.saving) {
      return;
    }

    this.displayDialog = false;

    this.committeeForm.reset();

    this.isEditMode = false;
    this.selectedId = null;

    this.editEducationalStageId = null;
    this.editCommitteeTypeId = null;

    this.editEducationalStageName = '';
    this.editCommitteeTypeName = '';

  }

  // ==========================================
  // Messages
  // ==========================================

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  // ==========================================
  // Statistics
  // ==========================================

  get activeCount(): number {
    return this.committeeTypesData.filter(x => x.isActive).length;
  }

  get closedCount(): number {
    return this.committeeTypesData.filter(x => x.bonusType === 0).length;
  }

  // ==========================================
  // Form Controls
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

  trackById(
    index: number,
    item: EduStageCommitteeType
  ): number {
    return item.id;
  }

}
