
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AppConfigService } from '../../../../shared/services/app-config.service';

interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  statusCode: number;
  errors: unknown;
  count: number;
}

export interface PendingBatchFilters {
  governorateId?: number | string | null;
  subjectId?: number | string | null;
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
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class PrintingApprovalService {

  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  private readonly baseUrl = `${this.appConfig.baseURL}api/PreQuality`;

  /**
   * GET api/PreQuality/pending
   *
   * Optional query parameters:
   * GovernorateId
   * SubjectId
   */
  getPendingBatches(
    filters?: PendingBatchFilters
  ): Observable<PendingBatchSummary[]> {

    let params = new HttpParams();

    if (
      filters?.governorateId !== null &&
      filters?.governorateId !== undefined &&
      filters?.governorateId !== '' &&
      filters?.governorateId !== 'all'
    ) {
      params = params.set(
        'GovernorateId',
        String(filters.governorateId)
      );
    }

    if (
      filters?.subjectId !== null &&
      filters?.subjectId !== undefined &&
      filters?.subjectId !== '' &&
      filters?.subjectId !== 'all'
    ) {
      params = params.set(
        'SubjectId',
        String(filters.subjectId)
      );
    }

    return this.http
      .get<ApiResponse<PendingBatchSummary[]>>(
        `${this.baseUrl}/pending`,
        { params }
      )
      .pipe(
        map(res => res?.data ?? [])
      );
  }

  /**
   * GET api/PreQuality/pending/{batchId}
   */
  getPendingBatch(
    batchId: number
  ): Observable<PendingBatchDetails> {

    return this.http
      .get<ApiResponse<PendingBatchDetails>>(
        `${this.baseUrl}/pending/${batchId}`
      )
      .pipe(
        map(res => res.data)
      );
  }

  /**
   * POST api/PreQuality/pending/{batchId}/approve
   */
  approveBatch(batchId: number): Observable<unknown> {

    return this.http.post(
      `${this.baseUrl}/pending/${batchId}/approve`,
      {}
    );
  }
}
