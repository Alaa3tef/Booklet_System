import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { CommitteeRow, SelectOption, StepItem } from '../../core/models/committee.model';

@Component({
  selector: 'app-committee-setup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SelectModule,
    TableModule,
    TagModule,
    TooltipModule
  ],
  templateUrl: './committee-setup.component.html',
  styleUrl: './committee-setup.component.scss'
})
export class CommitteeSetupComponent {
  // ---- Steps (displayed right-to-left: 4 → 1, matching the RTL wizard) ----
  readonly steps = signal<StepItem[]>([
    { order: 4, label: 'إنشاء الملفات', state: 'pending' },
    { order: 3, label: 'مراجعة البيانات', state: 'pending' },
    { order: 2, label: 'رفع ملف اللجان', state: 'pending' },
    { order: 1, label: 'اختيار المحافظة والمادة', state: 'active' }
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
  readonly uploadedFile = signal<{ name: string; sizeKb: number } | null>({
    name: 'اللجان_القاهرة_لغة_عربية.xlsx',
    sizeKb: 125
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.uploadedFile.set({ name: file.name, sizeKb: Math.round(file.size / 1024) });
    }
  }

  downloadTemplate(): void {
    // Hook up to a real template URL / API endpoint.
    console.info('Downloading committees Excel template...');
  }

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

  readonly filesGenerated = signal(true);

  cancel(): void {
    this.uploadedFile.set(null);
    this.rows.set([]);
  }

  createFiles(): void {
    // Hook up to the backend "generate booklet files" endpoint.
    this.filesGenerated.set(true);
  }
}
