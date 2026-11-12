import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../../shared/services/app-config.service';

export interface ProductionLookupItem {
  id: number;
  name: string;
  code?: string;
  educationalStageId?: number;
  isActive?: boolean;
}

export interface ProductionReportsLookupsData {
  years?: number[];
  stages?: ProductionLookupItem[];
  educationalStages?: ProductionLookupItem[];
  rounds?: ProductionLookupItem[];
  governorates?: ProductionLookupItem[];
  subjects?: ProductionLookupItem[];
}

export interface ProductionExportParams {
  Year: number;
  RoundId: number;
  EducationalStageId: number;
  GovernorateId?: number | null;
  SubjectId?: number | null;
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
export class ProductionReportsService {

  private readonly http   = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.baseURL}api/ProductionReports`;
  }

  /**
   * GET /api/ProductionReports/access
   * التحقق من صلاحية الوصول لتقارير الإنتاج
   */
  getAccess(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.base}/access`);
  }

  /**
   * GET /api/ProductionReports/lookups
   * القوائم الأساسية للسنوات والمراحل والأدوار والمحافظات والمواد
   */
  getLookups(): Observable<ApiResponse<ProductionReportsLookupsData>> {
    return this.http.get<ApiResponse<ProductionReportsLookupsData>>(`${this.base}/lookups`);
  }

  /**
   * GET /api/ProductionReports/export
   * تنزيل ملف تقرير متابعة الإنتاج (PDF / Excel)
   */
  exportReport(params: ProductionExportParams): Observable<HttpResponse<Blob>> {
    let httpParams = new HttpParams()
      .set('Year', String(params.Year))
      .set('RoundId', String(params.RoundId))
      .set('EducationalStageId', String(params.EducationalStageId))
      .set('format', params.format);

    if (params.GovernorateId != null && params.GovernorateId !== 0) {
      httpParams = httpParams.set('GovernorateId', String(params.GovernorateId));
    }
    if (params.SubjectId != null && params.SubjectId !== 0) {
      httpParams = httpParams.set('SubjectId', String(params.SubjectId));
    }

    return this.http.get(`${this.base}/export`, {
      params: httpParams,
      responseType: 'blob',
      observe: 'response'
    });
  }
}
