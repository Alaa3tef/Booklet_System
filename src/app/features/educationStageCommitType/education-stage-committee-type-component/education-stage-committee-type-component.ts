import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";

import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";

import { finalize, forkJoin } from "rxjs";

import { InputTextModule } from "primeng/inputtext";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { PaginatorModule } from "primeng/paginator";
import { SelectModule } from "primeng/select";
import { InputNumberModule } from "primeng/inputnumber";

import {
  EduStageCommitteeTypesService,
  EduStageCommitteeType,
  EduStageCommitteeTypeRequest,
  EducationalStageLookup,
  CommitteeTypeLookup,
} from "../service/education-stage-commit-type";

@Component({
  selector: "app-education-stage-committee-type-component",
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
    InputNumberModule,
  ],
  templateUrl: "./education-stage-committee-type-component.html",
  styleUrl: "./education-stage-committee-type-component.scss",
})
export default class EduStageCommitteeTypesComponent implements OnInit {
  editEducationalStageName = "";
  editCommitteeTypeName = "";
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

  searchTerm = "";

  filterEducationalStageId: number | null = null;
  filterCommitteeTypeId: number | null = null;
  filterIsActive: boolean | null = null;

  statusOptions = [
    { label: "كل الحالات", value: null },
    { label: "نشط", value: true },
    { label: "غير نشط", value: false },
  ];

  // ==========================================
  // Dialog
  // ==========================================

  displayDialog = false;
  isEditMode = false;
  selectedId: number | null = null;

  // IDs are stored separately for editing.
  // They are not form controls and are not sent during creation.
   editEducationalStageId: number | null = null;
   editCommitteeTypeId: number | null = null;

  committeeForm!: FormGroup;

  // ==========================================
  // Messages
  // ==========================================

  successMessage = "";
  errorMessage = "";

  // ==========================================
  // Lifecycle
  // ==========================================

  ngOnInit(): void {
    this.initializeForm();
    this.loadLookups();
    this.loadData();
  }

  // ==========================================
  // Initialize Form
  // ==========================================

  initializeForm(): void {
    this.committeeForm = this.fb.group({
      bonusType: [0, Validators.required],

      bonus: [0, [Validators.required, Validators.min(0)]],

      bookletsPerEnvelope: [1, [Validators.required, Validators.min(1)]],

      envelopesPerBox: [1, [Validators.required, Validators.min(1)]],
    });
  }

  // ==========================================
  // Load Dropdown Data
  // ==========================================

  loadLookups(): void {
    this.loadingLookups = true;

    forkJoin({
      stages: this.service.getEducationalStages(),
      types: this.service.getCommitteeTypes(),
    })
      .pipe(finalize(() => (this.loadingLookups = false)))
      .subscribe({
        next: (response) => {
          if (response.stages?.success && response.stages.data) {
            this.educationalStagesLookup = (
              response.stages.data.data || []
            ).filter((item) => item.isActive);
          }

          if (response.types?.success && response.types.data) {
            this.committeeTypesLookup = (response.types.data.data || []).filter(
              (item) => item.isActive,
            );
          }
        },

        error: (error) => {
          this.errorMessage =
            error?.error?.message || "حدث خطأ أثناء تحميل القوائم";

          console.error("Load Lookups Error:", error);
        },
      });
  }

  // ==========================================
  // Load Table Data
  // ==========================================

  loadData(): void {
    this.loading = true;
    this.errorMessage = "";

    this.service
      .getAll(this.pageNumber, this.pageSize, {
        educationalStageId: this.filterEducationalStageId,
        committeeTypeId: this.filterCommitteeTypeId,
        isActive: this.filterIsActive,
        searchTerm: this.searchTerm,
        ascending: true,
      })
      .pipe(finalize(() => (this.loading = false)))
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

            this.errorMessage = response?.message || "تعذر تحميل البيانات";
          }
        },

        error: (error) => {
          this.committeeTypesData = [];
          this.totalRecords = 0;

          this.errorMessage =
            error?.error?.message || "حدث خطأ أثناء تحميل بيانات ربط اللجان";

          console.error("Load Data Error:", error);
        },
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
    this.searchTerm = "";
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

    this.editEducationalStageId = null;
    this.editCommitteeTypeId = null;

    this.clearMessages();

    // Form contains ONLY the fields required for creation.
    this.committeeForm.reset({
      bonusType: 0,
      bonus: 0,
      bookletsPerEnvelope: 1,
      envelopesPerBox: 1,
    });

    this.editEducationalStageName = '';
this.editCommitteeTypeName = '';
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

    this.service
      .getById(item.id)
      .pipe(finalize(() => (this.loadingDetails = false)))
      .subscribe({
        next: (response) => {
          if (response?.success && response.data) {
            const data = response.data;

            // Keep IDs separately for the update request.
            this.editEducationalStageId = data.educationalStageId;
            this.editCommitteeTypeId = data.committeeTypeId;

            // The form itself contains only editable numeric settings.
            this.committeeForm.patchValue({
              bonusType: data.bonusType,
              bonus: data.bonus,
              bookletsPerEnvelope: data.bookletsPerEnvelope,
              envelopesPerBox: data.envelopesPerBox,
            });
            this.editEducationalStageName = data.educationalStageName;
            this.editCommitteeTypeName = data.committeeTypeName;
            this.displayDialog = true;
          } else {
            this.errorMessage = response?.message || "تعذر تحميل تفاصيل الربط";
          }
        },

        error: (error) => {
          this.errorMessage =
            error?.error?.message || "حدث خطأ أثناء تحميل تفاصيل الربط";

          console.error("Get By ID Error:", error);
        },
      });
  }

  // ==========================================
  // Save - POST
  // ==========================================

  save(): void {
    if (this.committeeForm.invalid) {
      this.committeeForm.markAllAsTouched();
      return;
    }

    if (
      this.isEditMode &&
      (this.selectedId == null ||
        this.editEducationalStageId == null ||
        this.editCommitteeTypeId == null)
    ) {
      this.errorMessage = "بيانات الربط غير مكتملة، برجاء إعادة تحميل السجل";

      return;
    }

    const value = this.committeeForm.getRawValue();

    // Base request: no IDs.
    const request: any = {
      bonusType: Number(value.bonusType),
      bonus: Number(value.bonus),
      bookletsPerEnvelope: Number(value.bookletsPerEnvelope),
      envelopesPerBox: Number(value.envelopesPerBox),
    };

    // Add IDs ONLY when editing.
    if (this.isEditMode) {
      request.educationalStageId = this.editEducationalStageId!;
      request.committeeTypeId = this.editCommitteeTypeId!;
    }

    this.saving = true;
    this.clearMessages();

    const wasEditMode = this.isEditMode;

    this.service
      .save(request)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (response) => {
          if (response?.success) {
            this.displayDialog = false;

            this.successMessage = wasEditMode
              ? "تم تعديل بيانات الربط بنجاح"
              : "تم إضافة الربط بنجاح";

            this.selectedId = null;
            this.editEducationalStageId = null;
            this.editCommitteeTypeId = null;

            this.pageNumber = 1;
            this.loadData();
          } else {
            this.errorMessage = response?.message || "لم يتم حفظ البيانات";

            if (response?.errors?.length) {
              this.errorMessage += " - " + response.errors.join("، ");
            }
          }
        },

        error: (error) => {
          this.errorMessage =
            error?.error?.message ||
            error?.error?.errors?.join("، ") ||
            "حدث خطأ أثناء حفظ البيانات";

          console.error("Save Error:", error);
        },
      });
  }

  // ==========================================
  // Close Dialog
  // ==========================================

  closeDialog(): void {
    if (this.saving || this.loadingDetails) {
      return;
    }

    this.displayDialog = false;

    this.committeeForm.reset({
      bonusType: 0,
      bonus: 0,
      bookletsPerEnvelope: 1,
      envelopesPerBox: 1,
    });

    this.isEditMode = false;
    this.selectedId = null;

    this.editEducationalStageId = null;
    this.editCommitteeTypeId = null;
    this.editEducationalStageName = '';
this.editCommitteeTypeName = '';
    this.clearMessages();
  }

  // ==========================================
  // Messages
  // ==========================================

  clearMessages(): void {
    this.successMessage = "";
    this.errorMessage = "";
  }

  // ==========================================
  // Statistics
  // ==========================================

  get activeCount(): number {
    return this.committeeTypesData.filter((item) => item.isActive).length;
  }

  get closedCount(): number {
    return this.committeeTypesData.filter((item) => item.bonusType === 0)
      .length;
  }

  // ==========================================
  // Form Controls
  // ==========================================

  get bonusControl() {
    return this.committeeForm.get("bonus");
  }

  get bookletsPerEnvelopeControl() {
    return this.committeeForm.get("bookletsPerEnvelope");
  }

  get envelopesPerBoxControl() {
    return this.committeeForm.get("envelopesPerBox");
  }

  get bonusTypeControl() {
    return this.committeeForm.get("bonusType");
  }

  // ==========================================
  // Track By
  // ==========================================

  trackById(index: number, item: EduStageCommitteeType): number {
    return item.id;
  }
}
