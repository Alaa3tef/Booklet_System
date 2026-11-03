import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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

/**
 * {
 *   success, message,
 *   data: { currentPage, totalPages, totalCount, pageSize, ..., data: [...] }
 * }
 */
interface PagedData<T> {
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  data?: T[];
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

/** نتيجة paginated موحّدة */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// ==========================================
// Query models
// ==========================================

export interface PrintingBatchFilters {
  governorateId?: number | null;
  subjectId?: number | null;
  roundId?: number | null;
  year?: number | null;
  search?: string | null;
  pageNumber?: number;
  pageSize?: number;
}

export interface PrintingCommitteeQuery {
  pageNumber?: number;
  pageSize?: number;
  /** رقم اللجنة */
  searchTerm?: string | null;
}

// ==========================================
// Print Request
// ==========================================

export interface PrintBatchRequest {
  committeeIds: number[];
}

// طلب JSON صراحةً
const JSON_HEADERS = new HttpHeaders({ Accept: 'application/json' });

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
  ): Observable<PagedResult<PrintingBatch>> {

    const pageNumber = filters.pageNumber ?? 1;
    const pageSize = filters.pageSize ?? 6;

    let params = new HttpParams()
      .set('PageNumber', pageNumber.toString())
      .set('PageSize', pageSize.toString());

    // المحافظة
    if (filters.governorateId != null) {
      params = params.set('GovernorateId', filters.governorateId.toString());
    }

    // المادة
    if (filters.subjectId != null) {
      params = params.set('SubjectId', filters.subjectId.toString());
    }

    // الدور (اختياري)
    if (filters.roundId != null) {
      params = params.set('RoundId', filters.roundId.toString());
    }

    // السنة (اختياري)
    if (filters.year != null) {
      params = params.set('Year', filters.year.toString());
    }

    // البحث النصي (اختياري)
    if (filters.search?.trim()) {
      params = params.set('Search', filters.search.trim());
    }

    return this.http
      .get<ApiResponse<PagedData<BatchDto> | BatchDto[]>>(
        `${this.url}/batches`,
        { params, headers: JSON_HEADERS }
      )
      .pipe(
        map(res => this.toPaged<BatchDto>(res, pageNumber, pageSize)),

        map(result => ({
          ...result,
          items: result.items.map(
            (b): PrintingBatch => ({
              id: b.batchId,
              label: (b.label ?? '').trim(),
              governorate: (b.governorateName ?? '').trim(),
              subject: (b.subjectName ?? '').trim(),
              year: b.year ?? null,
              round: (b.roundName ?? '').trim(),
              status: b.status ?? '',
              pendingCommittees: b.pendingCommitteeCount ?? 0
            })
          )
        }))
      );
  }

  // ==========================================
  // GET /api/Printing/batches/{batchId}/committees
  // ==========================================

  getCommittees(
    batchId: number,
    query: PrintingCommitteeQuery = {}
  ): Observable<PagedResult<PrintingCommittee>> {

    const pageNumber = query.pageNumber ?? 1;
    const pageSize = query.pageSize ?? 12;

    let params = new HttpParams()
      .set('PageNumber', pageNumber.toString())
      .set('PageSize', pageSize.toString());

    // البحث برقم اللجنة
    if (query.searchTerm?.trim()) {
      params = params.set('SearchTerm', query.searchTerm.trim());
    }

    return this.http
      .get<ApiResponse<PagedData<CommitteeDto> | CommitteeDto[]>>(
        `${this.url}/batches/${batchId}/committees`,
        { params, headers: JSON_HEADERS }
      )
      .pipe(
        map(res => this.toPaged<CommitteeDto>(res, pageNumber, pageSize)),

        map(result => ({
          ...result,
          items: result.items.map(
            (c): PrintingCommittee => ({
              id: c.committeeId,
              committeeNumber: String(c.committeeNumber ?? c.committeeId),
              requiredBooklets: c.requiredBookletCount ?? 0,
              bonusBooklets: c.bonusBookletCount ?? 0,
              requiredEnvelopes: c.requiredEnvelopeCount ?? 0,
              bonusEnvelopes: c.bonusEnvelopeCount ?? 0,
              boxCount: c.boxCount ?? 0
            })
          )
        }))
      );
  }

  // ==========================================
  // PUT /api/Printing/batches/{batchId}/print
  // ==========================================

  printCommittees(
    batchId: number,
    committeeIds: number[]
  ): Observable<void> {

    const body: PrintBatchRequest = { committeeIds };

    return this.http
      .put<ApiResponse<unknown>>(
        `${this.url}/batches/${batchId}/print`,
        body,
        { headers: JSON_HEADERS }
      )
      .pipe(
        map(res => {
          this.unwrap(res);
          return void 0;
        })
      );
  }

  // ==========================================
  // Helpers
  // ==========================================

  /**
   * بيحوّل الرد إلى PagedResult سواء كان:
   *  - data = { currentPage, totalPages, totalCount, data: [...] }
   *  - data = [...]  (لو السيرفر رجّع array مباشرة)
   */
  private toPaged<T>(
    res: ApiResponse<PagedData<T> | T[]>,
    pageNumber: number,
    pageSize: number
  ): PagedResult<T> {

    const data = this.unwrap(res);

    if (Array.isArray(data)) {
      return {
        items: data,
        totalCount: data.length,
        totalPages: Math.max(1, Math.ceil(data.length / pageSize)),
        currentPage: pageNumber,
        pageSize
      };
    }

    const items = data?.data ?? [];
    const totalCount = data?.totalCount ?? items.length;

    return {
      items,
      totalCount,
      totalPages:
        data?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize)),
      currentPage: data?.currentPage ?? pageNumber,
      pageSize: data?.pageSize ?? pageSize
    };
  }

  private unwrap<T>(res: ApiResponse<T>): T {

    if (res && res.success === false) {
      throw new Error(res.message || 'حدث خطأ غير متوقع');
    }

    return res?.data;
  }
}