
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { AppConfigService } from '../../../../shared/services/app-config.service';

// ==========================================
// API Response
// ==========================================

interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  statusCode: number;
  errors: unknown;
  count?: number;
}

// ==========================================
// Raw DTOs
// ==========================================

interface BatchDto {
  batchId: number;
  label: string;
  governorateName: string;
  subjectName: string;
  year: number;
  roundName: string;
  status: string;
  pendingCommitteeCount: number;
}

interface CommitteeDto {
  committeeId: number;
  committeeNumber: string;
  requiredBookletCount: number;
  bonusBookletCount: number;
  requiredEnvelopeCount: number;
  bonusEnvelopeCount: number;
  boxCount: number;
}

// ==========================================
// Models
// ==========================================

export interface PrintingBatch {
  id: number;
  label: string;
  governorate: string;
  subject: string;
  year: number | null;
  round: string;
  status: string;
  pendingCommittees: number;
}

export interface PrintingCommittee {
  id: number;
  committeeNumber: string;
  requiredBooklets: number;
  bonusBooklets: number;
  requiredEnvelopes: number;
  bonusEnvelopes: number;
  boxCount: number;
}

// ==========================================
// GET Batches Filters
// ==========================================

export interface PrintingBatchFilters {
  governorateId?: number | null;
  subjectId?: number | null;
  roundId?: number | null;
  year?: number | null;
  search?: string | null;
}

// ==========================================
// Print Request
// ==========================================

export interface PrintBatchRequest {
  committeeIds: number[];
}

// ==========================================
// Service
// ==========================================

@Injectable({
  providedIn: 'root'
})
export class PrintingService {

  private readonly http = inject(HttpClient);

  private readonly config = inject(AppConfigService);

  private get url(): string {
    return `${this.config.baseURL}api/Printing`;
  }

  // ==========================================
  // GET /api/Printing/batches
  // ==========================================

  getBatches(
    filters: PrintingBatchFilters = {}
  ): Observable<PrintingBatch[]> {

    let params = new HttpParams();

    // المحافظة
    if (filters.governorateId != null) {
      params = params.set(
        'GovernorateId',
        filters.governorateId.toString()
      );
    }

    // المادة
    if (filters.subjectId != null) {
      params = params.set(
        'SubjectId',
        filters.subjectId.toString()
      );
    }

    // الدور (اختياري)
    if (filters.roundId != null) {
      params = params.set(
        'RoundId',
        filters.roundId.toString()
      );
    }

    // السنة (اختياري)
    if (filters.year != null) {
      params = params.set(
        'Year',
        filters.year.toString()
      );
    }

    // البحث النصي (اختياري)
    if (filters.search?.trim()) {
      params = params.set(
        'Search',
        filters.search.trim()
      );
    }

    return this.http
      .get<ApiResponse<BatchDto[]>>(
        `${this.url}/batches`,
        { params }
      )
      .pipe(

        map(res => this.unwrap(res) ?? []),

        map(list =>
          list.map(
            (b): PrintingBatch => ({

              id: b.batchId,

              label: (b.label ?? '').trim(),

              governorate: (
                b.governorateName ?? ''
              ).trim(),

              subject: (
                b.subjectName ?? ''
              ).trim(),

              year: b.year ?? null,

              round: (
                b.roundName ?? ''
              ).trim(),

              status: b.status ?? '',

              pendingCommittees:
                b.pendingCommitteeCount ?? 0

            })
          )
        )
      );
  }

  // ==========================================
  // GET /api/Printing/batches/{batchId}/committees
  // ==========================================

  getCommittees(
    batchId: number
  ): Observable<PrintingCommittee[]> {

    return this.http
      .get<ApiResponse<CommitteeDto[]>>(
        `${this.url}/batches/${batchId}/committees`
      )
      .pipe(

        map(res => this.unwrap(res) ?? []),

        map(list =>
          list.map(
            (c): PrintingCommittee => ({

              id: c.committeeId,

              committeeNumber: String(
                c.committeeNumber ?? c.committeeId
              ),

              requiredBooklets:
                c.requiredBookletCount ?? 0,

              bonusBooklets:
                c.bonusBookletCount ?? 0,

              requiredEnvelopes:
                c.requiredEnvelopeCount ?? 0,

              bonusEnvelopes:
                c.bonusEnvelopeCount ?? 0,

              boxCount: c.boxCount ?? 0

            })
          )
        )
      );
  }

  // ==========================================
  // PUT /api/Printing/batches/{batchId}/print
  // ==========================================

  printCommittees(
    batchId: number,
    committeeIds: number[]
  ): Observable<void> {

    const body: PrintBatchRequest = {
      committeeIds
    };

    return this.http
      .put<ApiResponse<unknown>>(
        `${this.url}/batches/${batchId}/print`,
        body
      )
      .pipe(
        map(res => {
          this.unwrap(res);
          return void 0;
        })
      );
  }

  // ==========================================
  // Unwrap API Response
  // ==========================================

  private unwrap<T>(
    res: ApiResponse<T>
  ): T {

    if (res && res.success === false) {
      throw new Error(
        res.message || 'حدث خطأ غير متوقع'
      );
    }

    return res?.data;
  }
}
