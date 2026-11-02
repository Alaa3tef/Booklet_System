// core/services/quality.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { AppConfigService } from '../../../../shared/services/app-config.service';

// ==========================================
// API wrappers
// ==========================================

interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  statusCode: number;
  errors: unknown;
  count?: number;
}

/** شكل الـ pagination اللي راجع من الباك داخل data */
interface PagedDto<T> {
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  data?: T[];
}

// ==========================================
// Raw DTOs
// ==========================================

interface BatchDto {
  id: number;
  year?: number | null;
  subjectCode?: string | null;
  subjectName?: string | null;
  governorateCode?: string | null;
  governorateName?: string | null;
  roundName?: string | null;
  educationalStageName?: string | null;
  totalCommittees?: number | null;
  numberOfBooklets?: number | null;
  status?: string | null;
}

interface CommitteeDto {
  committeeId: number;
  committeeNumber: string;
  schoolName: string;
  batchId: number;
  year: number;
  governorateName: string;
  roundName: string;
  subjectName: string;
  requiredBookletCount: number;
  bonusBookletCount: number;
  requiredEnvelopeCount: number;
  bonusEnvelopeCount: number;
  boxCount: number;
}

/** GET /api/Committees/{id}/envelopes */
interface CommitteeEnvelopesDto {
  committeeId: number;
  committeeNumber: string;
  requiredEnvelopes: string[];
  bonusEnvelopes: string[];
}

interface CompleteQualityDto {
  committeeId: number;
  committeeNumber: string;
  status: string;
}

// ==========================================
// Models
// ==========================================

export interface PageQuery {
  pageNumber: number;
  pageSize: number;
  searchTerm?: string | null;
}

export interface BatchesQuery extends PageQuery {
  /** هيتبعتوا بس لما يتحددوا */
  governorateCode?: string | null;
  subjectCode?: string | null;
  ascending?: boolean | null;
}

export interface PagedResult<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

export interface QualityBatch {
  id: number;
  year: number | null;
  subjectCode: string;
  subject: string;
  governorateCode: string;
  governorate: string;
  round: string;
  stage: string;
  totalCommittees: number;
  booklets: number;
  status: string;
}

export interface QualityCommittee {
  id: number;
  committeeNumber: string;
  schoolName: string;
  batchId: number;
  year: number | null;
  governorate: string;
  round: string;
  subject: string;
  requiredBooklets: number;
  bonusBooklets: number;
  requiredEnvelopeCount: number;
  bonusEnvelopeCount: number;
  boxCount: number;
}

export interface CommitteeEnvelopes {
  committeeId: number;
  committeeNumber: string;
  requiredEnvelopes: string[];
  bonusEnvelopes: string[];
}

@Injectable({ providedIn: 'root' })
export class QualityService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  /** لو baseURL مش بيحتوي على /api ضيفيها هنا */
  private get url(): string {
    return `${this.config.baseURL}api/Quality`;
  }

  private get committeesUrl(): string {
    return `${this.config.baseURL}api/Committees`;
  }

  // ==========================================
  // Batches  (GET /api/Quality/all-batches)
  // ==========================================

  getBatches(query: BatchesQuery): Observable<PagedResult<QualityBatch>> {
    let params = this.pageParams(query);

    if (query.governorateCode) {
      params = params.set('GovernorateCode', query.governorateCode);
    }

    if (query.subjectCode) {
      params = params.set('SubjectCode', query.subjectCode);
    }

    if (query.ascending !== null && query.ascending !== undefined) {
      params = params.set('Ascending', query.ascending);
    }

    return this.http
      .get<ApiResponse<PagedDto<BatchDto> | BatchDto[]>>(`${this.url}/all-batches`, { params })
      .pipe(
        map(res =>
          this.toPage<BatchDto, QualityBatch>(
            this.unwrap(res),
            query,
            b => this.mapBatch(b),
            (b, term) =>
              `${b.subject} ${b.governorate} ${b.round} ${b.stage} ${b.id}`.toLowerCase().includes(term)
          )
        )
      );
  }

  // ==========================================
  // Committees  (GET /api/Quality/batches/{batchId}/printing-completed-committees)
  // ==========================================

  getBatchCommittees(batchId: number, query: PageQuery): Observable<PagedResult<QualityCommittee>> {
    const params = this.pageParams(query);

    return this.http
      .get<ApiResponse<PagedDto<CommitteeDto> | CommitteeDto[]>>(
        `${this.url}/batches/${batchId}/printing-completed-committees`,
        { params }
      )
      .pipe(
        map(res =>
          this.toPage<CommitteeDto, QualityCommittee>(
            this.unwrap(res),
            query,
            c => this.mapCommittee(c),
            (c, term) =>
              c.committeeNumber.toLowerCase().includes(term) || c.schoolName.toLowerCase().includes(term)
          )
        )
      );
  }

  // ==========================================
  // Envelopes  (GET /api/Committees/{id}/envelopes) - بدون pagination
  // ==========================================

  getCommitteeEnvelopes(committeeId: number): Observable<CommitteeEnvelopes> {
    return this.http
      .get<ApiResponse<CommitteeEnvelopesDto>>(`${this.committeesUrl}/${committeeId}/envelopes`)
      .pipe(
        map(res => {
          const data = this.unwrap(res);

          return {
            committeeId: data?.committeeId ?? committeeId,
            committeeNumber: String(data?.committeeNumber ?? committeeId),
            requiredEnvelopes: (data?.requiredEnvelopes ?? []).map(e => String(e).trim()),
            bonusEnvelopes: (data?.bonusEnvelopes ?? []).map(e => String(e).trim())
          };
        })
      );
  }

  // ==========================================
  // Complete  (PUT /api/Quality/committees/{id}/complete-quality)
  // ==========================================

  completeCommittee(committeeId: number): Observable<void> {
    return this.http
      .put<ApiResponse<CompleteQualityDto>>(`${this.url}/committees/${committeeId}/complete-quality`, {})
      .pipe(map(res => void this.unwrap(res)));
  }

  // ==========================================
  // Helpers
  // ==========================================

  private pageParams(query: PageQuery): HttpParams {
    let params = new HttpParams()
      .set('PageNumber', query.pageNumber)
      .set('PageSize', query.pageSize);

    const term = query.searchTerm?.trim();

    if (term) {
      params = params.set('SearchTerm', term);
    }

    return params;
  }

  /**
   * لو الباك رجّع paged object بنستخدمه زي ما هو،
   * ولو رجّع array بنعمل البحث والتقسيم محلياً.
   */
  private toPage<D, M>(
    payload: PagedDto<D> | D[] | null | undefined,
    query: PageQuery,
    mapFn: (d: D) => M,
    matches: (m: M, term: string) => boolean
  ): PagedResult<M> {
    if (Array.isArray(payload)) {
      const term = (query.searchTerm ?? '').trim().toLowerCase();
      const all = payload.map(mapFn).filter(m => !term || matches(m, term));
      const totalPages = Math.max(1, Math.ceil(all.length / query.pageSize));
      const page = Math.min(query.pageNumber, totalPages);
      const start = (page - 1) * query.pageSize;

      return {
        items: all.slice(start, start + query.pageSize),
        currentPage: page,
        totalPages,
        totalCount: all.length,
        pageSize: query.pageSize
      };
    }

    const items = (payload?.data ?? []).map(mapFn);
    const pageSize = payload?.pageSize || query.pageSize;
    const totalCount = payload?.totalCount ?? items.length;

    return {
      items,
      currentPage: payload?.currentPage || query.pageNumber,
      totalPages: payload?.totalPages || Math.max(1, Math.ceil(totalCount / pageSize)),
      totalCount,
      pageSize
    };
  }

  private mapBatch(b: BatchDto): QualityBatch {
    return {
      id: b.id,
      year: b.year ?? null,
      subjectCode: (b.subjectCode ?? '').trim(),
      subject: (b.subjectName ?? '').trim(),
      governorateCode: (b.governorateCode ?? '').trim(),
      governorate: (b.governorateName ?? '').trim(),
      round: (b.roundName ?? '').trim(),
      stage: (b.educationalStageName ?? '').trim(),
      totalCommittees: b.totalCommittees ?? 0,
      booklets: b.numberOfBooklets ?? 0,
      status: (b.status ?? '').trim()
    };
  }

  private mapCommittee(c: CommitteeDto): QualityCommittee {
    return {
      id: c.committeeId,
      committeeNumber: String(c.committeeNumber ?? c.committeeId),
      schoolName: (c.schoolName ?? '').trim(),
      batchId: c.batchId,
      year: c.year ?? null,
      governorate: (c.governorateName ?? '').trim(),
      round: (c.roundName ?? '').trim(),
      subject: (c.subjectName ?? '').trim(),
      requiredBooklets: c.requiredBookletCount ?? 0,
      bonusBooklets: c.bonusBookletCount ?? 0,
      requiredEnvelopeCount: c.requiredEnvelopeCount ?? 0,
      bonusEnvelopeCount: c.bonusEnvelopeCount ?? 0,
      boxCount: c.boxCount ?? 0
    };
  }

  /** يرمي error برسالة السيرفر لو success = false */
  private unwrap<T>(res: ApiResponse<T>): T {
    if (res && res.success === false) {
      throw new Error(res.message || 'حدث خطأ غير متوقع');
    }

    return res?.data;
  }
}