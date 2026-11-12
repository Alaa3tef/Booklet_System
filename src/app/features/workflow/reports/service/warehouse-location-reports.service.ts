import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../../shared/services/app-config.service';

export interface WarehouseLocationQuery {
  BatchId?: number | null;
  GovernorateId?: number | null;
  SubjectId?: number | null;
  Status?: string | null;
  PageNumber?: number | null;
  PageSize?: number | null;
}

export interface WarehouseLocationExportParams extends WarehouseLocationQuery {
  format: 'pdf' | 'xlsx' | string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string | null;
  data: T;
  statusCode: number;
  errors: string[] | null;
  count?: number;
}

@Injectable({ providedIn: 'root' })
export class WarehouseLocationReportsService {

  private readonly http   = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.baseURL}api/WarehouseLocationReports`;
  }

  private buildParams(q: WarehouseLocationQuery & { format?: string }): HttpParams {
    let p = new HttpParams();
    const set = (k: string, v: unknown) => {
      if (v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) return;
      p = p.set(k, String(v));
    };

    set('BatchId', q.BatchId);
    set('GovernorateId', q.GovernorateId);
    set('SubjectId', q.SubjectId);
    set('Status', q.Status);
    set('PageNumber', q.PageNumber);
    set('PageSize', q.PageSize);
    if (q.format) set('format', q.format);

    return p;
  }

  /**
   * GET /api/WarehouseLocationReports
   * جلب تقرير مواقع الصناديق في المخزن
   */
  getReports(query: WarehouseLocationQuery = {}): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(this.base, {
      params: this.buildParams(query)
    });
  }

  /**
   * GET /api/WarehouseLocationReports/export
   * تنزيل تقرير مواقع الصناديق في ملف PDF أو Excel
   */
  exportReport(params: WarehouseLocationExportParams): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/export`, {
      params: this.buildParams(params),
      responseType: 'blob',
      observe: 'response'
    });
  }
}
