// service/packing.ts
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ApiResponse,
  ClaimedCommittee,
  CommitteeBox,
  CommitteeBoxes,
  PackOutcome,
  PackRequest,
  PackResult,
  PackingBatch,
  PackingBatchFilters,
  PackingCommittee,
  PageQuery,
  PagedResult,
  ReleasedCommittee
} from '../model/packing.model';
import { AppConfigService } from '../../../../shared/services/app-config.service';

// عدّلي الـ base url حسب الـ environment عندك (مثال: `${environment.apiUrl}/Packing`)

const PAGE_NUMBER_KEY = 'PageNumber';
const PAGE_SIZE_KEY = 'PageSize';

// بنطلب JSON صراحةً عشان الباك ما يرجعش text/plain
const JSON_HEADERS = new HttpHeaders({ Accept: 'application/json' });

@Injectable({ providedIn: 'root' })
export class PackingService {
  private readonly http = inject(HttpClient);
    private readonly config = inject(AppConfigService);
   API_URL = `${this.config.baseURL}api/Packing`;
 COMMITTEES_URL =`${this.config.baseURL}api/Committees`;

  /** GET /api/Packing/batches - مع pagination */
  getBatches(
    filters: PackingBatchFilters,
    page: PageQuery
  ): Observable<PagedResult<PackingBatch>> {
    let params = this.pageParams(page);

    if (filters.governorateId != null) {
      params = params.set('GovernorateId', filters.governorateId);
    }
    if (filters.subjectId != null) {
      params = params.set('SubjectId', filters.subjectId);
    }
    if (filters.roundId != null) {
      params = params.set('RoundId', filters.roundId);
    }
    if (filters.year != null) {
      params = params.set('Year', filters.year);
    }
    if (filters.search?.trim()) {
      params = params.set('Search', filters.search.trim());
    }

    return this.http
      .get<ApiResponse<any>>(`${this.API_URL}/batches`, { params, headers: JSON_HEADERS })
      .pipe(map(res => this.toPaged<PackingBatch>(res)));
  }

  /** GET /api/Packing/batches/{batchId}/committees - مع pagination */
 getCommittees(
    batchId: number,
    page: PageQuery,
    searchTerm?: string | null
  ): Observable<PagedResult<PackingCommittee>> {
    let params = this.pageParams(page);
 
    if (searchTerm?.trim()) {
      params = params.set('SearchTerm', searchTerm.trim());
    }
 
    return this.http
      .get<ApiResponse<any>>(`${this.API_URL}/batches/${batchId}/committees`, {
        params,
        headers: JSON_HEADERS
      })
      .pipe(map(res => this.toPaged<PackingCommittee>(res)));
  }

  /** GET /api/Committees/{id}/envelopes-with-boxes → الصناديق وجواها الأظرف */
  getCommitteeBoxes(committeeId: number): Observable<CommitteeBoxes> {
    return this.http
      .get<ApiResponse<any>>(`${this.COMMITTEES_URL}/${committeeId}/envelopes-with-boxes`, {
        headers: JSON_HEADERS
      })
      .pipe(map(res => this.normalizeBoxes(this.unwrap(res))));
  }

  /** PUT /api/Packing/committees/{committeeId}/pack */
  packCommittee(committeeId: number, body: PackRequest): Observable<PackOutcome> {
    return this.http
      .put<ApiResponse<PackResult>>(`${this.API_URL}/committees/${committeeId}/pack`, body, {
        headers: JSON_HEADERS
      })
      .pipe(
        map(res => {
          // لو فيه data (حتى مع problems) بنرجعها عشان نعرض المشاكل
          if (!res?.success && !res?.data) {
            throw new Error(this.errorText(res));
          }

          return {
            success: !!res.success,
            message: res.message,
            data: res.data ?? null
          };
        })
      );
  }

  // =====================================================
  // غير مستخدمين حاليًا (جاهزين لو احتجتيهم بعدين)
  // =====================================================

  /** PUT /api/Packing/batches/{batchId}/committees/{committeeId}/claim */
  claimCommittee(batchId: number, committeeId: number): Observable<ClaimedCommittee> {
    return this.http
      .put<ApiResponse<ClaimedCommittee>>(
        `${this.API_URL}/batches/${batchId}/committees/${committeeId}/claim`,
        {},
        { headers: JSON_HEADERS }
      )
      .pipe(map(res => this.unwrap(res)));
  }

  /** PUT /api/Packing/committees/{committeeId}/release */
  releaseCommittee(committeeId: number): Observable<ReleasedCommittee> {
    return this.http
      .put<ApiResponse<ReleasedCommittee>>(
        `${this.API_URL}/committees/${committeeId}/release`,
        {},
        { headers: JSON_HEADERS }
      )
      .pipe(map(res => this.unwrap(res)));
  }

  // =====================================================
  // Helpers
  // =====================================================

  private pageParams(page: PageQuery): HttpParams {
    return new HttpParams()
      .set(PAGE_NUMBER_KEY, page.pageNumber)
      .set(PAGE_SIZE_KEY, page.pageSize);
  }

  private unwrap(res: ApiResponse<any>): any {
    if (!res?.success) {
      throw new Error(this.errorText(res));
    }

    return res.data;
  }

  /**
   * الرد: { success, data: { currentPage, totalPages, totalCount, ..., data: [...] } }
   * بندعم كمان الشكل القديم (data = array مباشرة).
   */
  private toPaged<T>(res: ApiResponse<any>): PagedResult<T> {
    const data = this.unwrap(res);

    if (Array.isArray(data)) {
      return { items: data, total: res.count ?? res.totalCount ?? data.length };
    }

    const items: T[] = data?.data ?? data?.items ?? [];

    return { items, total: data?.totalCount ?? res.count ?? items.length };
  }

  private errorText(res: ApiResponse<unknown> | null | undefined): string {
    return res?.errors?.[0] || res?.message || 'حدث خطأ غير متوقع';
  }

  // ---------- تطبيع شكل الصناديق (نقطة التعديل الوحيدة لو أسماء الحقول اختلفت) ----------

  private normalizeBoxes(raw: any): CommitteeBoxes {
    const boxes: CommitteeBox[] = (raw?.boxes ?? [])
      .map((box: any, index: number) => {
        const required = this.serials(
          box.requiredEnvelopes ?? box.mainEnvelopes ?? box.envelopes
        );

        return {
          boxId: box.boxId,
          sequenceNo: box.sequenceNo ?? index + 1,
          qrCode: String(box.qrCode ?? '').trim(),
          expectedEnvelopeCount: box.expectedEnvelopeCount ?? required.length,
          requiredEnvelopes: required,
          bonusEnvelopes: this.serials(box.bonusEnvelopes ?? box.reserveEnvelopes)
        };
      })
      .sort((a: CommitteeBox, b: CommitteeBox) => a.sequenceNo - b.sequenceNo);

    return {
      committeeId: raw?.committeeId,
      committeeNumber: String(raw?.committeeNumber ?? ''),
      boxes
    };
  }

  /** الأظرف ممكن ترجع strings أو objects فيها serial */
  private serials(list: unknown): string[] {
    if (!Array.isArray(list)) {
      return [];
    }

    return list
      .map((item: any) =>
        typeof item === 'string' || typeof item === 'number'
          ? String(item)
          : String(
              item?.serial ??
                item?.serialNumber ??
                item?.envelopeSerial ??
                item?.qrCode ??
                item?.code ??
                ''
            )
      )
      .map(serial => serial.trim())
      .filter(Boolean);
  }
}