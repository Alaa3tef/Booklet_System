import { HttpClient, HttpParams } from '@angular/common/http';
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

/** GET api/Planning/delivery-orders/governorates */
export interface GovernorateDeliveryReadiness {
  governorateId: number;
  governorateName: string | null;
  canCreate: boolean;
  totalBatches: number;
  storedBatches: number;
  totalCommittees: number;
  totalBoxes: number;
  blockingReasons: string[] | null;
}

export interface DeliveryOrderReadiness extends GovernorateDeliveryReadiness {
  year: number;
  roundId: number;
  roundName: string;
  educationalStageId: number;
  educationalStageName: string;
}

export interface DeliveryOrdersGovernoratesQuery {
  year?: number;
  roundId?: number;
  educationalStageId?: number;
  onlyEligible?: boolean;
}

export interface CreateDeliveryOrderRequest {
  year: number;
  roundId: number;
  educationalStageId: number;
  governorateId: number;
  deliveryDate: string;
}

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);
  private readonly baseUrl = `${this.appConfig.baseURL}api/Planning`;

  getBatchesForApprove(governorateId?: number, subjectId?: number): Observable<ApiResponse<PlanningBatch[]>> {
    let params = new HttpParams();
    if (governorateId != null && governorateId > 0) {
      params = params.set('GovernorateId', governorateId.toString());
    }
    if (subjectId != null && subjectId > 0) {
      params = params.set('SubjectId', subjectId.toString());
    }
    return this.http.get<ApiResponse<PlanningBatch[]>>(`${this.baseUrl}/batches/for-approve`, { params });
  }

  getBatchDetails(batchId: number): Observable<ApiResponse<BatchDetails>> {
    return this.http.get<ApiResponse<BatchDetails>>(`${this.baseUrl}/batches/${batchId}`);
  }

  sendBatchesToPreQuality(batchIds: number[]): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.baseUrl}/batches/send-to-pre-quality`,
      { batchIds }
    );
  }

  getDeliveryOrdersGovernorates(query: DeliveryOrdersGovernoratesQuery): Observable<ApiResponse<GovernorateDeliveryReadiness[]>> {
    // let params = new HttpParams();
    // if (query.year != null && query.year > 0) {
    //   params = params.set('Year', query.year.toString());
    // }
    // if (query.roundId != null && query.roundId > 0) {
    //   params = params.set('RoundId', query.roundId.toString());
    // }
    // if (query.educationalStageId != null && query.educationalStageId > 0) {
    //   params = params.set('EducationalStageId', query.educationalStageId.toString());
    // }
    // if (query.onlyEligible != null) {
    //   params = params.set('OnlyEligible', String(query.onlyEligible));
    // }
    return this.http.get<ApiResponse<GovernorateDeliveryReadiness[]>>(`${this.baseUrl}/delivery-orders/governorates`);
  }

  getDeliveryOrderReadiness(governorateId: number): Observable<ApiResponse<DeliveryOrderReadiness>> {
    const params = new HttpParams().set('GovernorateId', governorateId.toString());
    return this.http.get<ApiResponse<DeliveryOrderReadiness>>(
      `${this.baseUrl}/delivery-orders/readiness`,
      { params }
    );
  }

  createDeliveryOrder(request: CreateDeliveryOrderRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/delivery-orders`, request);
  }

}
