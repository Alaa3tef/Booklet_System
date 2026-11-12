import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import {
  ProductionReportsService,
  ProductionLookupItem,
  ProductionExportParams
} from '../../service/production-reports.service';
import {
  ManagerService,
  ManagerContext
} from '../../../../dashboard/service/manager-service';

interface SelectOption { label: string; value: any }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-management-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './management-reports.component.html',
  styleUrl: './management-reports.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class ManagementReportsComponent implements OnInit {

  private readonly productionSvc = inject(ProductionReportsService);
  private readonly managerSvc    = inject(ManagerService);

  // ─── Access State ───────────────────────────────────────────────────────────
  hasAccess      = signal<boolean>(true);
  accessMessage  = signal<string>('');

  // ─── Lookups Signals ────────────────────────────────────────────────────────
  readonly stages       = signal<ProductionLookupItem[]>([]);
  readonly allRounds    = signal<ProductionLookupItem[]>([]);
  readonly subjects     = signal<ProductionLookupItem[]>([]);
  readonly years        = signal<number[]>([]);
  readonly governorates = signal<{ id: number; name: string }[]>([]);

  lookupsLoading = signal(false);
  prodLoading    = signal(false);
  prodExporting  = signal(false);
  prodError      = signal('');
  prodSuccess    = signal('');

  // ─── Selected Filters (بدون اختيارات افتراضية بناءً على طلب المستخدم) ─────────
  prodYear    = signal<number | null>(null);
  prodStage   = signal<number | null>(null);
  prodRound   = signal<number | null>(null);
  prodGov     = signal<number | null>(null);
  prodSubject = signal<number | null>(null);

  // ─── Computed Options ───────────────────────────────────────────────────────
  readonly prodYearOpts = computed<SelectOption[]>(() => {
    const list = this.years();
    if (list.length) {
      return list.map(y => ({ label: y > 2000 ? `${y}` : `20${y}`, value: y }));
    }
    const currentY = new Date().getFullYear();
    return [currentY, currentY - 1, currentY + 1].map(y => ({ label: `${y}`, value: y % 100 }));
  });

  readonly prodStageOpts = computed<SelectOption[]>(() =>
    this.stages().map(s => ({ label: s.name, value: s.id }))
  );

  readonly prodRoundOpts = computed<SelectOption[]>(() => {
    const stageId = this.prodStage();
    return this.allRounds()
      .filter(r => !stageId || !r.educationalStageId || r.educationalStageId === stageId)
      .map(r => ({ label: r.name, value: r.id }));
  });

  readonly prodGovOpts = computed<SelectOption[]>(() => [
    { label: 'كل المحافظات', value: null },
    ...this.governorates().map(g => ({ label: g.name, value: g.id }))
  ]);

  readonly prodSubjectOpts = computed<SelectOption[]>(() => {
    const stageId = this.prodStage();
    return [
      { label: 'كل المواد', value: null },
      ...this.subjects()
        .filter(s => !stageId || !s.educationalStageId || s.educationalStageId === stageId)
        .map(s => ({ label: s.name, value: s.id }))
    ];
  });

  ngOnInit(): void {
    this.checkAccessAndLoadLookups();
  }

  private checkAccessAndLoadLookups(): void {
    this.lookupsLoading.set(true);

    // التحقق من الصلاحية أولاً عبر GET /api/ProductionReports/access
    this.productionSvc.getAccess().subscribe({
      next: (accessRes: any) => {
        if (accessRes && accessRes.success === false) {
          this.hasAccess.set(false);
          this.accessMessage.set(accessRes.message || 'لا تملك صلاحية الوصول إلى تقارير الإنتاج');
          this.lookupsLoading.set(false);
          return;
        }

        this.loadLookups();
      },
      error: () => {
        // في حال كان الـ access مضمناً أو لم يتطلب endpoint إضافي، نتابع تحميل البيانات
        this.loadLookups();
      }
    });
  }

  private loadLookups(): void {
    this.productionSvc.getLookups().subscribe({
      next: (res: any) => {
        const d = res.data ?? res ?? {};

        const years: number[] = d.years ?? [];
        const stages: ProductionLookupItem[] = (d.educationalStages ?? d.stages ?? []).filter((s: any) => s.isActive !== false);
        const rounds: ProductionLookupItem[] = (d.rounds ?? []).filter((r: any) => r.isActive !== false);
        const subjects: ProductionLookupItem[] = (d.subjects ?? []).filter((s: any) => s.isActive !== false);
        const govs: any[] = d.governorates ?? [];

        if (years.length) this.years.set(years);
        if (stages.length) this.stages.set(stages);
        if (rounds.length) this.allRounds.set(rounds);
        if (subjects.length) this.subjects.set(subjects);
        if (govs.length) {
          this.governorates.set(govs.map((g: any) => ({
            id: g.id ?? g.governorateId,
            name: g.name ?? g.governorateName
          })));
        }

        // إذا كان هناك أي قائمة غير مكتملة، نستكملها من Lookups العامة
        if (!years.length || !stages.length || !rounds.length || !subjects.length || !govs.length) {
          this.loadFallbackLookups();
        } else {
          this.lookupsLoading.set(false);
        }
      },
      error: () => {
        this.loadFallbackLookups();
      }
    });
  }

  private loadFallbackLookups(): void {
    forkJoin({
      stages:   this.managerSvc.lookupStages(),
      rounds:   this.managerSvc.lookupRounds(),
      subjects: this.managerSvc.lookupSubjects(),
      years:    this.managerSvc.lookupYears(),
    }).subscribe({
      next: ({ stages, rounds, subjects, years }) => {
        if (!this.stages().length) {
          this.stages.set((stages.data ?? []).filter((s: any) => s.isActive !== false));
        }
        if (!this.allRounds().length) {
          this.allRounds.set((rounds.data ?? []).filter((r: any) => r.isActive !== false));
        }
        if (!this.subjects().length) {
          this.subjects.set((subjects.data ?? []).filter((s: any) => s.isActive !== false));
        }
        if (!this.years().length) {
          const yearList = Array.isArray(years.data) ? years.data : [26, 27];
          this.years.set(yearList);
        }

        this.loadGovernorates();
        this.lookupsLoading.set(false);
      },
      error: () => {
        this.lookupsLoading.set(false);
        this.prodError.set('تعذّر تحميل البيانات الأساسية');
      }
    });
  }

  private loadGovernorates(): void {
    const year = this.prodYear() ?? 26;
    const stageId = this.prodStage() ?? 1;
    const roundId = this.prodRound() ?? 1;

    const ctx: ManagerContext = {
      year,
      educationalStageId: stageId,
      roundId
    };

    this.managerSvc.governorates(ctx, { pageNumber: 1, pageSize: 100 }).subscribe({
      next: (res: any) => {
        const list = res.data?.rows ?? res.data ?? [];
        if (Array.isArray(list) && !this.governorates().length) {
          this.governorates.set(list.map((g: any) => ({
            id: g.governorateId || g.id,
            name: g.governorateName || g.name
          })));
        }
      },
      error: () => { /* fallback */ }
    });
  }

  /**
   * تصدير تقرير متابعة الإنتاج عبر GET /api/ProductionReports/export
   */
  exportProduction(format: 'pdf' | 'excel'): void {
    this.prodError.set('');
    this.prodSuccess.set('');

    const year    = this.prodYear();
    const stageId = this.prodStage();
    const roundId = this.prodRound();

    // التحقق من الحقول الإلزامية
    if (!year || !stageId || !roundId) {
      this.prodError.set('يرجى اختيار العام والمرحلة والدور للمتابعة وتنزيل التقرير.');
      return;
    }

    this.prodExporting.set(true);

    const exportParams: ProductionExportParams = {
      Year: year,
      EducationalStageId: stageId,
      RoundId: roundId,
      GovernorateId: this.prodGov() ?? undefined,
      SubjectId: this.prodSubject() ?? undefined,
      format: format === 'excel' ? 'xlsx' : 'pdf'
    };

    this.productionSvc.exportReport(exportParams).subscribe({
      next: res => {
        const blob = res.body!;
        const disposition = res.headers.get('Content-Disposition') ?? '';
        const filenameMatch = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/);
        const serverFilename = filenameMatch ? decodeURIComponent(filenameMatch[2].trim()) : null;
        const extension = format === 'excel' ? 'xlsx' : 'pdf';
        const fallback = `تقرير-متابعة-الإنتاج-${year}-${todayISO()}.${extension}`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = serverFilename ?? fallback;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.prodExporting.set(false);
        this.prodSuccess.set(`تم تنزيل ملف ${format === 'excel' ? 'Excel' : 'PDF'} بنجاح.`);
      },
      error: (err: any) => {
        this.prodExporting.set(false);
        const errorMsg = err?.error?.message || 'تعذّر تنزيل ملف التقرير من الخادم.';
        this.prodError.set(errorMsg);
      }
    });
  }
}
