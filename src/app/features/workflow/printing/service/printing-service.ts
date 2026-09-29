// core/services/printing.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, of, tap } from 'rxjs';
import { WorkflowStatusRow } from '../../../../core/models/workflow.model';
import { AppConfigService } from '../../../../shared/services/app-config.service';
import { MOCK_ROWS } from '../printing.mock';



@Injectable({ providedIn: 'root' })
export class PrintingService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  /** true = القائمة من الـ mock | false = القائمة من الـ backend */
  private readonly useMockList = true;

  private mockRows: any[] = [...MOCK_ROWS];

  private get url(): string {
    return `${this.config.baseURL}/printing`;
  }

  // ==========================================
  // LIST
  // ==========================================

  getList(filters: any): Observable<any> {
    return this.useMockList ? this.getMockList(filters) : this.getRealList(filters);
  }

  private getRealList(filters: any): Observable<any> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);

    if (filters.governorate !== 'all') params = params.set('governorate', filters.governorate);
    if (filters.subject !== 'all') params = params.set('subject', filters.subject);

    const committee = filters.committeeNumber.trim();
    if (committee) params = params.set('committeeNumber', committee);

    return this.http.get<any>(this.url, { params });
  }

  private getMockList(f: any): Observable<any> {
    const committee = f.committeeNumber.trim();

    const filtered = this.mockRows.filter(
      r =>
        (f.governorate === 'all' || r.governorateCode === f.governorate) &&
        (f.subject === 'all' || r.subjectCode === f.subject) &&
        (!committee || r.committeeNumber.includes(committee))
    );

    const start = (f.page - 1) * f.pageSize;
    const items = filtered
      .slice(start, start + f.pageSize)
      .map((r, i) => ({ ...r, index: start + i + 1 }));

    return of({ items, total: filtered.length }).pipe(delay(300));
  }

  // ==========================================
  // ACTIONS (Backend حقيقي)
  // ==========================================

  finish(id: number): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/finish`, {}).pipe(
      tap(() =>
        this.patchMock(id, {
          status: 'تم الانتهاء',
          statusTone: 'success',
          rejectionReason: undefined
        })
      )
    );
  }

  reject(id: number, payload: any): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/reject`, payload).pipe(
      tap(() =>
        this.patchMock(id, {
          status: 'مرفوض',
          statusTone: 'danger',
          rejectionReason: payload.reason
        })
      )
    );
  }

  /** بيحدّث الـ mock بعد نجاح الـ endpoint عشان الجدول يعكس التغيير */
  private patchMock(id: number, patch: Partial<WorkflowStatusRow>): void {
    if (!this.useMockList) return;
    this.mockRows = this.mockRows.map(r => (r.id === id ? { ...r, ...patch } : r));
  }
}