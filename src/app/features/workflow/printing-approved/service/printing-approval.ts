import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// عدّلي المسار حسب مكان AppConfigService عندك
import { AppConfigService } from '../../../../shared/services/app-config.service';

interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  statusCode: number;
  errors: unknown;
  count: number;
}

/** GET api/PreQuality/pending */
export interface PendingBatchSummary {
  batchId: number;
  displayLabel: string;
  year: number | null;
  roundCode: string;
  roundName: string;
}

/** GET api/PreQuality/pending/{batchId} */
export interface PendingBatchDetails {
  batchId: number;
  year: number | null;
  roundCode: string;
  roundName: string;
  governorateName: string;
  subjectName: string;
  committeeCount: number;
  requiredBookletTotal: number;
  reserveBookletTotal: number;
  expectedBoxCount: number;
  [key: string]: unknown; // أي حقول زيادة راجعة من الـ API
}

@Injectable({ providedIn: 'root' })
export class PrintingApprovalService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly baseUrl = `${this.appConfig.baseURL}api/PreQuality`;

  getPendingBatches(): Observable<PendingBatchSummary[]> {
    return this.http
      .get<ApiResponse<PendingBatchSummary[]>>(`${this.baseUrl}/pending`)
      .pipe(map(res => res?.data ?? []));
  }

  getPendingBatch(batchId: number): Observable<PendingBatchDetails> {
    return this.http
      .get<ApiResponse<PendingBatchDetails>>(`${this.baseUrl}/pending/${batchId}`)
      .pipe(map(res => res.data));
  }

  approveBatch(batchId: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/pending/${batchId}/approve`, {});
  }
}