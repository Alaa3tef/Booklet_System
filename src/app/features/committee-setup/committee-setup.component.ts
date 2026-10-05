import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { CommitteeRow, SelectOption, StepItem } from '../../core/models/committee.model';
import { MessageService } from 'primeng/api';
import { CommitteeService } from './service/committee-service';

@Component({
  selector: 'app-committee-setup',
  standalone: true,
imports: [
  CommonModule,
  FormsModule,
  CardModule,
  SelectModule,
  TableModule,
  ButtonModule,
  DividerModule,
  TagModule,
  TooltipModule
],
  templateUrl: './committee-setup.component.html',
  styleUrl: './committee-setup.component.scss'
})
export default class CommitteeSetupComponent {
  // ---- Steps (displayed right-to-left: 4 → 1, matching the RTL wizard) ----


  readonly steps = signal<StepItem[]>([
      {
      order: 1,
      label: 'اختيار المحافظة والمادة',
      state: 'active'
    },
    {
      order: 2,
      label: 'رفع ملف اللجان',
      state: 'pending'
    },
    {
      order: 3,
      label: 'مراجعة البيانات',
      state: 'pending'
    },
    {
      order: 4,
      label: 'إنشاء الملفات',
      state: 'pending'
    }
  ]);

  // ---- Filters ----
  readonly rounds: SelectOption[] = [
    { label: 'الدور الأول 2026', value: 'round1-2026' },
    { label: 'الدور الثاني 2026', value: 'round2-2026' }
  ];
  readonly subjects: SelectOption[] = [
    { label: 'اللغة العربية', value: 'arabic' },
    { label: 'اللغة الإنجليزية', value: 'english' },
    { label: 'الرياضيات', value: 'math' },
    { label: 'العلوم', value: 'science' }
  ];
  readonly governorates: SelectOption[] = [
    { label: 'القاهرة', value: 'cairo' },
    { label: 'الجيزة', value: 'giza' },
    { label: 'الإسكندرية', value: 'alexandria' },
    { label: 'الدقهلية', value: 'dakahlia' }
  ];

  selectedRound = this.rounds[0].value;
  selectedSubject = this.subjects[0].value;
  selectedGovernorate = this.governorates[0].value;

  // ---- File upload state ----




  // ---- Preview table ----
  readonly rows = signal<CommitteeRow[]>([
    { index: 1, committeeNumber: '101', schoolName: 'مدرسة مصطفى كامل', educationalAdministration: 'شرق القاهرة', bookletCount: 20, status: 'valid' },
    { index: 2, committeeNumber: '102', schoolName: 'مدرسة روض الفرج', educationalAdministration: 'روض الفرج', bookletCount: 20, status: 'valid' },
    { index: 3, committeeNumber: '103', schoolName: 'مدرسة العباسية', educationalAdministration: 'غرب القاهرة', bookletCount: 20, status: 'valid' },
    { index: 4, committeeNumber: '104', schoolName: 'مدرسة شبرا الثانوية', educationalAdministration: 'شبرا', bookletCount: 20, status: 'valid' },
    { index: 5, committeeNumber: '105', schoolName: 'مدرسة الحلمية', educationalAdministration: 'مصر الجديدة', bookletCount: 20, status: 'valid' }
  ]);

  readonly totalCommittees = computed(() => this.rows().length);
  readonly totalBooklets = computed(() =>
    this.rows().reduce((sum, row) => sum + row.bookletCount, 0)
  );


 private readonly committeeService = inject(CommitteeService);
private readonly toast = inject(MessageService);

private selectedFile: File | null = null;

readonly uploadedFile  = signal<{ name: string; sizeKb: number } | null>(null);  // كان فيه ملف وهمي
readonly saving        = signal(false);
readonly filesGenerated = signal(false);                                          // كانت true
readonly saveError     = signal('');

onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  this.selectedFile = file;
  this.uploadedFile.set({ name: file.name, sizeKb: Math.round(file.size / 1024) });
  this.filesGenerated.set(false);
  this.saveError.set('');

  input.value = '';   // يسمح باختيار نفس الملف تاني
}

cancel(): void {
  this.selectedFile = null;
  this.uploadedFile.set(null);
  this.rows.set([]);
  this.filesGenerated.set(false);
  this.saveError.set('');
}

createFiles(): void {
  if (!this.selectedFile || this.saving()) return;

  this.saving.set(true);
  this.saveError.set('');

  this.committeeService
    .uploadCommittees(
      this.selectedFile,
      this.selectedGovernorate,
      this.selectedSubject,
      this.selectedRound
    )
    .subscribe({
      next: () => {
        this.saving.set(false);
        this.filesGenerated.set(true);
        this.toast.add({
          severity: 'success',
          summary: 'تمت العملية',
          detail: 'تم إنشاء الملفات بنجاح',
          life: 3500
        });
      },
      error: err => {
        console.error('Upload error:', err);
        this.saving.set(false);
        this.filesGenerated.set(false);
        this.saveError.set(err?.error?.message ?? 'تعذّر حفظ الملف. حاول مرة أخرى.');
      }
    });
}
}
