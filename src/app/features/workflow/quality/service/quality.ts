// core/services/quality.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { AppConfigService } from '../../../../shared/services/app-config.service';

// ==========================================
// API wrapper
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
// Raw DTO (نفس شكل الـ response)
// ==========================================

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
  requiredEnvelopes: string[];
  bonusEnvelopes: string[];
}

// ==========================================
// Models
// ==========================================

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
  /** أكواد الأظرف الأساسية المتوقعة */
  requiredEnvelopes: string[];
  /** أكواد الأظرف الإضافية المتوقعة */
  bonusEnvelopes: string[];
}

export interface QualityCommitteesFilter {
  governorateCode?: string | null;
  subjectCode?: string | null;
}

@Injectable({ providedIn: 'root' })
export class QualityService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  /** لو baseURL مش بيحتوي على /api ضيفيها هنا */
  private get url(): string {
    return `${this.config.baseURL}/Quality`;
  }

  /**
   * GET /api/Quality/committees?GovernorateCode=29&SubjectCode=01
   * بيبعت بس الـ parameters اللي اتحددت.
   */
  getCommittees(filter: QualityCommitteesFilter = {}): Observable<QualityCommittee[]> {
    let params = new HttpParams();

    if (filter.governorateCode) {
      params = params.set('GovernorateCode', filter.governorateCode);
    }

    if (filter.subjectCode) {
      params = params.set('SubjectCode', filter.subjectCode);
    }

    return this.http
      .get<ApiResponse<CommitteeDto[]>>(`${this.url}/committees`, { params })
      .pipe(
        map(res => this.unwrap(res) ?? []),
        map(list =>
          list.map(
            (c): QualityCommittee => ({
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
              requiredEnvelopeCount: c.requiredEnvelopeCount ?? c.requiredEnvelopes?.length ?? 0,
              bonusEnvelopeCount: c.bonusEnvelopeCount ?? c.bonusEnvelopes?.length ?? 0,
              boxCount: c.boxCount ?? 0,
              requiredEnvelopes: (c.requiredEnvelopes ?? []).map(e => String(e).trim()),
              bonusEnvelopes: (c.bonusEnvelopes ?? []).map(e => String(e).trim())
            })
          )
        )
      );
  }

  /** PUT /api/Quality/committees/{id}/complete */
  completeCommittee(committeeId: number): Observable<void> {
    return this.http
      .put<ApiResponse<unknown>>(`${this.url}/committees/${committeeId}/complete`, {})
      .pipe(map(res => void this.unwrap(res)));
  }

  /** يرمي error برسالة السيرفر لو success = false */
  private unwrap<T>(res: ApiResponse<T>): T {
    if (res && res.success === false) {
      throw new Error(res.message || 'حدث خطأ غير متوقع');
    }

    return res?.data;
  }
}