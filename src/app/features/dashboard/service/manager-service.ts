import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';

/** كل رد: { success, message, data, statusCode, errors } */
export interface ManagerResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
  errors: string[] | null;
}

/** السياق: بيتحدد مرة واحدة وبيتبعت مع كل طلب محتاجه */
export interface ManagerContext { year: number; roundId: number; educationalStageId: number; }

export interface ManagerQuery {
  subjectId?: number | null;
  governorateId?: number | null;
  batchId?: number | null;
  status?: string;
  searchTerm?: string;
  pageNumber?: number;
  pageSize?: number;
  ascending?: boolean;
  sortBy?: string;
}

export const STAGE_KEYS = ['Printing', 'Quality', 'Packing', 'Storage'] as const;
export type StageKey = typeof STAGE_KEYS[number];

/** عناصر القوائم المرجعية */
export interface StageLookup { id: number; code: string; name: string; scope: string; isActive: boolean; }
export interface RoundLookup { id: number; educationalStageId: number; code: string; name: string; isActive: boolean; }
export interface SubjectLookup { id: number; educationalStageId: number; code: string; name: string; isActive: boolean; }

@Injectable({ providedIn: 'root' })
export class ManagerService {
  private http = inject(HttpClient);
  private appConfig = inject(AppConfigService);

  private get api(): string { return `${this.appConfig.baseURL}api`; }
  private get url(): string { return `${this.api}/Manager`; }

  /** مفيش قيمة فاضية ولا 0 بتتبعت (الباك بيرجّع 400 "قيمة المعرف غير صالحة") */
  private params(ctx: ManagerContext | null, q: ManagerQuery = {}): HttpParams {
    let p = new HttpParams();
    const set = (k: string, v: unknown) => {
      if (v === null || v === undefined || v === '' || v === 0 || (typeof v === 'number' && Number.isNaN(v))) return;
      p = p.set(k, String(v));
    };
    if (ctx) { set('Year', ctx.year); set('RoundId', ctx.roundId); set('EducationalStageId', ctx.educationalStageId); }
    set('SubjectId', q.subjectId); set('GovernorateId', q.governorateId); set('BatchId', q.batchId);
    set('Status', q.status); set('SearchTerm', q.searchTerm?.trim());
    set('PageNumber', q.pageNumber); set('PageSize', q.pageSize); set('SortBy', q.sortBy);
    if (q.pageNumber || q.pageSize) p = p.set('IsPaged', 'true');
    if (q.ascending !== undefined) p = p.set('Ascending', String(q.ascending));
    return p;
  }

  private get<T = any>(path: string, ctx: ManagerContext | null, q?: ManagerQuery): Observable<ManagerResponse<T>> {
    return this.http.get<ManagerResponse<T>>(`${this.url}/${path}`, { params: this.params(ctx, q) });
  }

  // ------------------------------------------------ Manager: A. لوحات التقدم
  subjects(ctx: ManagerContext, q?: ManagerQuery) { return this.get('subjects', ctx, q); }
  governorates(ctx: ManagerContext, q?: ManagerQuery) { return this.get('governorates', ctx, q); }
  batches(ctx: ManagerContext, q?: ManagerQuery) { return this.get('batches', ctx, q); }

  // ------------------------------------------------ Manager: B. التفاصيل
  batchCommittees(batchId: number, q?: ManagerQuery) { return this.get(`batches/${batchId}/committees`, null, q); }
  committees(ctx: ManagerContext, q?: ManagerQuery) { return this.get('committees', ctx, q); }
  committeeBoxes(committeeId: number, q?: ManagerQuery) { return this.get(`committees/${committeeId}/boxes`, null, q); }

  // ------------------------------------------------ Manager: C. نظرة عامة
  departments(ctx: ManagerContext, q?: ManagerQuery) { return this.get('departments', ctx, q); }
  delivery(ctx: ManagerContext, q?: ManagerQuery) { return this.get('delivery', ctx, q); }

  // ------------------------------------------------ قوائم الفلاتر (من غير pagination)
  private lookup<T>(path: string): Observable<ManagerResponse<any>> {
    return this.http.get<ManagerResponse<any>>(`${this.api}/${path}`, { params: new HttpParams().set('IsPaged', 'false') });
  }
  lookupStages() { return this.lookup<StageLookup>('EducationalStages'); }
  lookupRounds() { return this.lookup<RoundLookup>('Rounds'); }
  lookupSubjects() { return this.lookup<SubjectLookup>('Subjects'); }
  /** السنوات المتاحة: [26, 27, ...] */
  lookupYears() { return this.http.get<ManagerResponse<number[]>>(`${this.api}/Lookups/years`); }
}
