import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../../shared/services/app-config.service';



export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
  errors: string[] | null;
  count?: number;
}

/** GET api/Planning/batches/for-approve */
export interface PlanningBatch {
  batchId: number;
  batchName: string;
  year: number;
  roundId: number;
  roundName: string;
  totalCommittees: number;
  statusId: number;
  statusNameAr: string;
  nextStatusNameAr: string;
}

export interface BatchCommittee {
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

/** GET api/Planning/batches/{id} */
export interface BatchDetails {
  batchId: number;
  sourceFileName: string;
  year: number;
  roundCode: string;
  roundName: string;
  governorateCode: string;
  governorateName: string;
  educationalStageCode: string;
  educationalStageName: string;
  subjectCode: string;
  subjectName: string;
  importedAt: string;
  importedById: number;
  totalCommittees: number;
  totalRequiredBooklets: number;
  totalBonusBooklets: number;
  totalRequiredEnvelopes: number;
  totalBonusEnvelopes: number;
  totalBoxes: number;
  committees: BatchCommittee[];
}

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly baseUrl = `${this.appConfig.baseURL}api/Planning`;

  getBatchesForApprove(): Observable<ApiResponse<PlanningBatch[]>> {
    return this.http.get<ApiResponse<PlanningBatch[]>>(`${this.baseUrl}/batches/for-approve`);
  }

  getBatchDetails(batchId: number): Observable<ApiResponse<BatchDetails>> {
    return this.http.get<ApiResponse<BatchDetails>>(`${this.baseUrl}/batches/${batchId}`);
  }
}
