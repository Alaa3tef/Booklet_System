import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../../../../shared/services/app-config.service';

export interface ApiResponse<T> {
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
  pageNumber?: number;
  pageSize?: number;
}

export interface PendingCommittee {
  committeeId: number;
  committeeNumber: string;
  schoolName: string;
  educationalAdministration: string;
  committeeType: string;
  educationalStageCommitteeTypeId: number;
  requiredBookletCount: number;
  bonusBookletCount: number;
  requiredEnvelopeCount: number;
  bonusEnvelopeCount: number;
  boxCount: number;
}

/**
 * شكل الدفعة كما يرجع من:
 * GET api/PreQuality/pending
 *
 * ملاحظة: لا توجد committees داخل كل batch في الاستجابة الحالية.
 */
export interface PendingBatch {
  batchId: number;
  displayLabel: string;
  year: number | null;
  roundCode: string;
  roundName: string;
  committeeCount: number;
  requiredBookletTotal: number;
  reserveBookletTotal: number;
  requiredEnvelopeTotal: number;
  reserveEnvelopeTotal: number;
}

export interface PendingBatchesData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  meta: unknown;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  messages: unknown[];
  succeeded: boolean;
  data: PendingBatch[];
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
   * Query Parameters:
   * PageNumber
   * PageSize
   * GovernorateId
   * SubjectId
   */
  getPendingBatches(
    filters?: PendingBatchFilters
  ): Observable<ApiResponse<PendingBatchesData>> {
    let params = new HttpParams()
      .set('PageNumber', String(filters?.pageNumber ?? 1))
      .set('PageSize', String(filters?.pageSize ?? 6));

    if (
      filters?.governorateId !== null &&
      filters?.governorateId !== undefined &&
      filters?.governorateId !== '' &&
      filters?.governorateId !== 'all'
    ) {
      params = params.set('GovernorateId', String(filters.governorateId));
    }

    if (
      filters?.subjectId !== null &&
      filters?.subjectId !== undefined &&
      filters?.subjectId !== '' &&
      filters?.subjectId !== 'all'
    ) {
      params = params.set('SubjectId', String(filters.subjectId));
    }

    return this.http.get<ApiResponse<PendingBatchesData>>(
      `${this.baseUrl}/pending`,
      { params }
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
