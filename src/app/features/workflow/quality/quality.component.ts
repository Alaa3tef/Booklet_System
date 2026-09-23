import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DialogModule } from 'primeng/dialog';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';

import { WorkflowStepLayoutComponent } from '../../../shared/workflow-step-layout/workflow-step-layout.component';
import { WorkflowStatusRow } from '../../../core/models/workflow.model';


// =====================================================
// QUALITY ROW
// =====================================================

interface QualityRow extends WorkflowStatusRow {
  committeeNumber: string;
  governorate: string;
  qrCode: string;
}


// =====================================================
// COMPONENT
// =====================================================

@Component({
  selector: 'app-quality',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    DialogModule,
    MultiSelectModule,
    ButtonModule,
    TextareaModule,
    WorkflowStepLayoutComponent
  ],

  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss'
})
export class QualityComponent {

  // =====================================================
  // ESSENTIALS
  // =====================================================

  readonly essentials = [
    'مسح QR اللجنة الخارجية',
    'مراجعة بيانات اللجنة',
    'تسجيل نتيجة المراجعة',
    'إرجاع المواد المرفوضة للمستخدمين المختصين'
  ];


  // =====================================================
  // SCAN STATE
  // =====================================================

  isScanning = false;

  scanMessage = '';

  private mockScanIndex = 0;


  // =====================================================
  // TABLE DATA
  // =====================================================

  readonly rows = signal<QualityRow[]>([
    {
      index: 1,
      subject: 'اللغة العربية',
      committeeNumber: '101',
      governorate: 'القاهرة',
      qrCode: 'QR-COMMITTEE-101',
      status: 'قيد المراجعة',
      statusTone: 'info'
    },

    {
      index: 2,
      subject: 'الرياضيات',
      committeeNumber: '102',
      governorate: 'الجيزة',
      qrCode: 'QR-COMMITTEE-102',
      status: 'تم المراجعة',
      statusTone: 'success'
    },

    {
      index: 3,
      subject: 'اللغة الإنجليزية',
      committeeNumber: '103',
      governorate: 'القاهرة',
      qrCode: 'QR-COMMITTEE-103',
      status: 'مرفوض',
      statusTone: 'danger'
    }
  ]);


  // =====================================================
  // SELECTED ROW
  // =====================================================

  selectedRow: QualityRow | null = null;


  // =====================================================
  // REJECT DIALOG
  // =====================================================

  rejectDialogVisible = false;

  rejectReason = '';

  selectedReviewers: any[] = [];

  rejectSubmitting = false;


  // =====================================================
  // REVIEW USERS
  // =====================================================

  readonly reviewUsers = [
    {
      id: 1,
      name: 'أحمد محمد',
      role: 'مراجع أول'
    },

    {
      id: 2,
      name: 'محمد علي',
      role: 'مراجع جودة'
    },

    {
      id: 3,
      name: 'سارة أحمد',
      role: 'مراجع محتوى'
    },

    {
      id: 4,
      name: 'محمود حسن',
      role: 'مراجع نهائي'
    }
  ];


  // =====================================================
  // START SCAN
  // =====================================================

  startScan(): void {

    if (this.isScanning) {
      return;
    }

    this.isScanning = true;

    this.scanMessage = 'جاري قراءة QR اللجنة...';

    /*
     * Mock Scanner
     *
     * لاحقًا هنا هنستبدل الـ setTimeout
     * باستدعاء الـ Scanner الحقيقي / API.
     */

    setTimeout(() => {

      const mockData = [
        {
          subject: 'الفيزياء',
          committeeNumber: '104',
          governorate: 'القاهرة',
          qrCode: 'QR-COMMITTEE-104'
        },

        {
          subject: 'الكيمياء',
          committeeNumber: '105',
          governorate: 'الجيزة',
          qrCode: 'QR-COMMITTEE-105'
        },

        {
          subject: 'الأحياء',
          committeeNumber: '106',
          governorate: 'المنوفية',
          qrCode: 'QR-COMMITTEE-106'
        }
      ];

      const data =
        mockData[this.mockScanIndex % mockData.length];

      this.mockScanIndex++;

      const newRow: QualityRow = {
        index: this.rows().length + 1,

        subject: data.subject,

        committeeNumber: data.committeeNumber,

        governorate: data.governorate,

        qrCode: data.qrCode,

        status: 'قيد المراجعة',

        statusTone: 'info'
      };

      this.rows.update(rows => [
        ...rows,
        newRow
      ]);

      this.isScanning = false;

      this.scanMessage =
        `تم قراءة QR اللجنة ${data.committeeNumber} بنجاح`;

    }, 1200);
  }


  // =====================================================
  // APPROVE / REVIEW
  // =====================================================

  approve(row: QualityRow): void {

    this.rows.update(rows =>
      rows.map(item =>
        item.index === row.index
          ? {
              ...item,
              status: 'تم المراجعة',
              statusTone: 'success'
            }
          : item
      )
    );

    this.scanMessage =
      `تم تسجيل مراجعة اللجنة ${row.committeeNumber} بنجاح`;
  }


  // =====================================================
  // OPEN REJECT DIALOG
  // =====================================================

  openRejectDialog(row: QualityRow): void {

    /*
     * لا نسمح بفتح الرفض لو المادة
     * تم مراجعتها بالفعل.
     */

    if (row.status === 'تم المراجعة') {
      return;
    }

    this.selectedRow = row;

    this.rejectReason = '';

    this.selectedReviewers = [];

    this.rejectDialogVisible = true;
  }


  // =====================================================
  // CLOSE REJECT DIALOG
  // =====================================================

  closeRejectDialog(): void {

    if (this.rejectSubmitting) {
      return;
    }

    this.rejectDialogVisible = false;

    this.rejectReason = '';

    this.selectedReviewers = [];

    this.selectedRow = null;
  }


  // =====================================================
  // VALIDATE REJECTION
  // =====================================================

  get isRejectFormValid(): boolean {

    return (
      this.rejectReason.trim().length >= 10 &&
      this.selectedReviewers.length > 0
    );
  }


  // =====================================================
  // SUBMIT REJECTION
  // =====================================================

  submitRejection(): void {

    if (
      !this.selectedRow ||
      !this.isRejectFormValid
    ) {
      return;
    }

    this.rejectSubmitting = true;

    const row = this.selectedRow;

    const rejectionData = {

      rowIndex: row.index,

      subject: row.subject,

      committeeNumber: row.committeeNumber,

      governorate: row.governorate,

      qrCode: row.qrCode,

      reason: this.rejectReason.trim(),

      reviewerIds:
        this.selectedReviewers.map(
          user => user.id
        )
    };


    console.log(
      'Quality Reject Request:',
      rejectionData
    );


    /*
     * Mock API
     *
     * هنا لاحقًا هنضع API الحقيقي.
     */

    setTimeout(() => {

      this.rows.update(rows =>
        rows.map(item =>
          item.index === row.index
            ? {
                ...item,
                status: 'مرفوض',
                statusTone: 'danger'
              }
            : item
        )
      );


      this.rejectSubmitting = false;

      this.rejectDialogVisible = false;

      this.scanMessage =
        `تم رفض اللجنة ${row.committeeNumber} وإرسالها للمراجعة`;


      this.selectedRow = null;

      this.rejectReason = '';

      this.selectedReviewers = [];

    }, 800);
  }


  // =====================================================
  // CHECK IF ACTIONS SHOULD APPEAR
  // =====================================================

  hasActions(row: QualityRow): boolean {

    return row.status !== 'تم المراجعة'
      && row.status !== 'مرفوض';
  }
}