// core/services/printing.service.ts
import { HttpClient } from '@angular/common/http';
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
// Raw DTOs (نفس شكل الـ response)
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
// Models (اللي بتستخدمها الـ component)
// ==========================================

/** دفعة = مادة + محافظة */
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

/** PUT /api/Printing/batches/{batchId}/print */
export interface PrintBatchRequest {
  committeeIds: number[];
}

@Injectable({ providedIn: 'root' })
export class PrintingService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  /** لو baseURL مش بيحتوي على /api ضيفيها هنا */
  private get url(): string {
    return `${this.config.baseURL}api/Printing`;
  }

  /** GET /api/Printing/batches */
  getBatches(): Observable<PrintingBatch[]> {
    return this.http
      .get<ApiResponse<BatchDto[]>>(`${this.url}/batches`)
      .pipe(
        map(res => this.unwrap(res) ?? []),
        map(list =>
          list.map(
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
        )
      );
  }

  /** GET /api/Printing/batches/{batchId}/committees */
  getCommittees(batchId: number): Observable<PrintingCommittee[]> {
    return this.http
      .get<ApiResponse<CommitteeDto[]>>(`${this.url}/batches/${batchId}/committees`)
      .pipe(
        map(res => this.unwrap(res) ?? []),
        map(list =>
          list.map(
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
        )
      );
  }

  /** PUT /api/Printing/batches/{batchId}/print  body: { committeeIds: [...] } */
  printCommittees(batchId: number, committeeIds: number[]): Observable<void> {
    const body: PrintBatchRequest = { committeeIds };

    return this.http
      .put<ApiResponse<unknown>>(`${this.url}/batches/${batchId}/print`, body)
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