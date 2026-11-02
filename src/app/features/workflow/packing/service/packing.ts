// core/services/packing.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import { PackingBatchFilters, PageQuery, PagedResult, PackingBatch, ApiResponse, PackingCommittee, ClaimedCommittee, PackRequest, PackOutcome, PackResult, ReleasedCommittee } from '../model/packing.model';


// عدّلي الـ base url حسب الـ environment عندك (مثال: `${environment.apiUrl}/Packing`)
const API_URL = '/api/Packing';

// أسماء باراميترات الـ pagination (عدّليها لو الباك سماها بشكل مختلف)
const PAGE_NUMBER_KEY = 'PageNumber';
const PAGE_SIZE_KEY = 'PageSize';

// ✅ true = بيانات تجريبية لمعاينة الشكل بدون باك. خليها false لما الـ API يشتغل.
const USE_MOCK = true;
const MOCK_DELAY = 500;

@Injectable({ providedIn: 'root' })
export class PackingService {
  private readonly http = inject(HttpClient);

  /** GET /api/Packing/batches (المواد) - مع pagination */
  getBatches(
    filters: PackingBatchFilters,
    page: PageQuery
  ): Observable<PagedResult<PackingBatch>> {
    if (USE_MOCK) {
      return of(this.mockBatches(filters, page)).pipe(delay(MOCK_DELAY));
    }

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
      .get<ApiResponse<PackingBatch[]>>(`${API_URL}/batches`, { params })
      .pipe(map(res => this.toPaged(res)));
  }

  /** GET /api/Packing/batches/{batchId}/committees (اللجان) - مع pagination */
  getCommittees(
    batchId: number,
    page: PageQuery
  ): Observable<PagedResult<PackingCommittee>> {
    if (USE_MOCK) {
      return of(this.mockCommittees(page)).pipe(delay(MOCK_DELAY));
    }

    return this.http
      .get<ApiResponse<PackingCommittee[]>>(
        `${API_URL}/batches/${batchId}/committees`,
        { params: this.pageParams(page) }
      )
      .pipe(map(res => this.toPaged(res)));
  }

  /** PUT /api/Packing/batches/{batchId}/committees/{committeeId}/claim (حجز اللجنة + الصناديق والأظرف) */
  claimCommittee(batchId: number, committeeId: number): Observable<ClaimedCommittee> {
    if (USE_MOCK) {
      return of(this.mockClaim(batchId, committeeId)).pipe(delay(MOCK_DELAY));
    }

    return this.http
      .put<ApiResponse<ClaimedCommittee>>(
        `${API_URL}/batches/${batchId}/committees/${committeeId}/claim`,
        {}
      )
      .pipe(map(res => this.unwrap(res)));
  }

  /** PUT /api/Packing/committees/{committeeId}/pack (تأكيد التغليف) */
  packCommittee(committeeId: number, body: PackRequest): Observable<PackOutcome> {
    if (USE_MOCK) {
      const data: PackResult = {
        committeeId,
        committeeNumber: String(100 + committeeId),
        status: 'تم التغليف',
        boxes: body.boxes.map((box:any, i:any) => ({
          boxId: box.boxId,
          sequenceNo: i + 1,
          qrCode: box.qrCode,
          status: 'Packed'
        })),
        problems: []
      };

      return of({ success: true, message: 'تم', data }).pipe(delay(MOCK_DELAY));
    }

    return this.http
      .put<ApiResponse<PackResult>>(`${API_URL}/committees/${committeeId}/pack`, body)
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

  /** PUT /api/Packing/committees/{committeeId}/release (تحرير اللجنة) */
  releaseCommittee(committeeId: number): Observable<ReleasedCommittee> {
    if (USE_MOCK) {
      return of({
        committeeId,
        committeeNumber: String(100 + committeeId),
        requiredBookletCount: 0,
        bonusBookletCount: 0,
        requiredEnvelopeCount: 0,
        bonusEnvelopeCount: 0,
        boxCount: 0
      }).pipe(delay(MOCK_DELAY));
    }

    return this.http
      .put<ApiResponse<ReleasedCommittee>>(
        `${API_URL}/committees/${committeeId}/release`,
        {}
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

  private toPaged<T>(res: ApiResponse<T[]>): PagedResult<T> {
    const items = this.unwrap(res) ?? [];

    return { items, total: res.count ?? items.length };
  }

  private errorText(res: ApiResponse<unknown> | null | undefined): string {
    return res?.errors?.[0] || res?.message || 'حدث خطأ غير متوقع';
  }

  // =====================================================
  // Mock data (للمعاينة فقط - امسحيها لما الـ API يشتغل)
  // =====================================================

  private slice<T>(all: T[], page: PageQuery): PagedResult<T> {
    const start = (page.pageNumber - 1) * page.pageSize;

    return { items: all.slice(start, start + page.pageSize), total: all.length };
  }

  private mockBatches(filters: PackingBatchFilters, page: PageQuery): PagedResult<PackingBatch> {
    const subjects = ['اللغة العربية', 'الرياضيات', 'العلوم', 'اللغة الإنجليزية', 'الدراسات الاجتماعية'];
    const governorates = ['القاهرة', 'الجيزة', 'المنوفية', 'الإسكندرية'];

    const all: PackingBatch[] = Array.from({ length: 14 }, (_, i) => ({
      batchId: i + 1,
      label: `دفعة ${i + 1} - ${subjects[i % subjects.length]}`,
      governorateName: governorates[i % governorates.length],
      subjectName: subjects[i % subjects.length],
      year: 2026,
      roundName: i % 3 === 0 ? 'الدور الثاني' : 'الدور الأول',
      status: i % 5 === 4 ? 'مكتمل' : 'قيد التغليف',
      pendingCommitteeCount: i % 5 === 4 ? 0 : 3 + (i % 7)
    }));

    return this.slice(all, page);
  }

  private mockCommittees(page: PageQuery): PagedResult<PackingCommittee> {
    const all: PackingCommittee[] = Array.from({ length: 15 }, (_, i) => ({
      committeeId: i + 1,
      committeeNumber: String(101 + i),
      requiredBookletCount: 120 + i,
      bonusBookletCount: 10,
      requiredEnvelopeCount: 12,
      bonusEnvelopeCount: 2,
      boxCount: 3
    }));

    return this.slice(all, page);
  }

  /**
   * أكواد التجربة (اكتبيها في خانة المسح واضغطي Enter):
   *   صندوق:  BOX-{committeeId}-{رقم الصندوق}          مثال: BOX-1-1
   *   ظرف:    ENV-{committeeId}-{الصندوق}-{رقم}        مثال: ENV-1-1-01
   *   احتياطي: RES-{committeeId}-{الصندوق}-{رقم}       مثال: RES-1-1-01
   */
  private mockClaim(batchId: number, committeeId: number): ClaimedCommittee {
    const pad = (n: number) => String(n).padStart(2, '0');

    return {
      batchId,
      batchLabel: `دفعة ${batchId}`,
      committeeId,
      committeeNumber: String(100 + committeeId),
      status: 'Claimed',
      assignedToUserId: 1,
      assignedAt: new Date().toISOString(),
      boxCount: 3,
      boxes: [1, 2, 3].map(seq => ({
        boxId: committeeId * 10 + seq,
        sequenceNo: seq,
        qrCode: `BOX-${committeeId}-${seq}`,
        expectedEnvelopeCount: 12,
        mainEnvelopes: Array.from({ length: 12 }, (_, n) => `ENV-${committeeId}-${seq}-${pad(n + 1)}`),
        reserveEnvelopes: Array.from({ length: 2 }, (_, n) => `RES-${committeeId}-${seq}-${pad(n + 1)}`)
      }))
    };
  }
}