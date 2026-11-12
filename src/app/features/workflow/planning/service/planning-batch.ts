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

export interface PagedQuery {
  pageNumber?: number;
  pageSize?: number;
  isPaged?: boolean;
  searchTerm?: string;
  ascending?: boolean;
}

export interface BatchesForApproveQuery extends PagedQuery {
  governorateId?: number;
  subjectId?: number;
}

export type BatchDetailsQuery = PagedQuery;

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

export interface PagedResult<T> {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  succeeded?: boolean;
  messages?: string[];
  data: T[];
}

/** GET api/Planning/delivery-orders/governorates */
export interface GovernorateDeliveryReadiness {
  governorateId: number;
  governorateName: string | null;
  deliveryOrderId?: number | null;
  canCreate: boolean;
  totalBatches: number;
  storedBatches: number;
  totalCommittees: number;
  totalBoxes: number;
  blockingReasons: string[] | null;
}

export interface CreatedDeliveryOrder {
  deliveryOrderId: number;
  year: number;
  roundId: number;
  roundName: string;
  educationalStageId: number;
  educationalStageName: string;
  governorateId: number;
  governorateName: string;
  scopeType: string;
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
  governorateId?: number;
  onlyEligible?: boolean;
  searchTerm?: string;
  sortBy?: string;
  ascending?: boolean;
  pageNumber?: number;
  pageSize?: number;
  pageSizeOrAll?: number;
  isPaged?: boolean;
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

  private applyPaging(params: HttpParams, q?: PagedQuery): HttpParams {
    if (!q) return params;
    if (q.pageNumber != null && q.pageNumber > 0) params = params.set('PageNumber', q.pageNumber.toString());
    if (q.pageSize != null && q.pageSize > 0) params = params.set('PageSize', q.pageSize.toString());
    if (q.isPaged != null) params = params.set('IsPaged', String(q.isPaged));
    if (q.searchTerm?.trim()) params = params.set('SearchTerm', q.searchTerm.trim());
    if (q.ascending != null) params = params.set('Ascending', String(q.ascending));
    return params;
  }

  getBatchesForApprove(governorateId?: number, subjectId?: number, paging?: PagedQuery): Observable<ApiResponse<PlanningBatch[]>> {
    let params = new HttpParams();
    if (governorateId != null && governorateId > 0) {
      params = params.set('GovernorateId', governorateId.toString());
    }
    if (subjectId != null && subjectId > 0) {
      params = params.set('SubjectId', subjectId.toString());
    }
    params = this.applyPaging(params, paging);
    return this.http.get<ApiResponse<PlanningBatch[]>>(`${this.baseUrl}/batches/for-approve`, { params });
  }

  getBatchDetails(batchId: number, query?: BatchDetailsQuery): Observable<ApiResponse<BatchDetails>> {
    const params = this.applyPaging(new HttpParams(), query);
    return this.http.get<ApiResponse<BatchDetails>>(`${this.baseUrl}/batches/${batchId}`, { params });
  }

  sendBatchesToPreQuality(batchIds: number[]): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.baseUrl}/batches/send-to-pre-quality`,
      { batchIds }
    );
  }

  /**
   * GET api/Planning/delivery-orders/governorates
   * دايمًا IsPaged=true (الباك بيرجع الصفحة الحالية بس)
   */
  getDeliveryOrdersGovernorates(query: DeliveryOrdersGovernoratesQuery): Observable<ApiResponse<PagedResult<GovernorateDeliveryReadiness>>> {
    let params = new HttpParams();

    if (query.year != null && query.year > 0) params = params.set('Year', query.year.toString());
    if (query.roundId != null && query.roundId > 0) params = params.set('RoundId', query.roundId.toString());
    if (query.educationalStageId != null && query.educationalStageId > 0) {
      params = params.set('EducationalStageId', query.educationalStageId.toString());
    }
    if (query.governorateId != null && query.governorateId > 0) {
      params = params.set('GovernorateId', query.governorateId.toString());
    }
    if (query.onlyEligible != null) params = params.set('OnlyEligible', String(query.onlyEligible));
    if (query.searchTerm?.trim()) params = params.set('SearchTerm', query.searchTerm.trim());
    if (query.sortBy?.trim()) params = params.set('SortBy', query.sortBy.trim());
    if (query.ascending != null) params = params.set('Ascending', String(query.ascending));
    if (query.pageNumber != null && query.pageNumber > 0) params = params.set('PageNumber', query.pageNumber.toString());
    if (query.pageSize != null && query.pageSize > 0) params = params.set('PageSize', query.pageSize.toString());
    if (query.pageSizeOrAll != null && query.pageSizeOrAll > 0) params = params.set('PageSizeOrAll', query.pageSizeOrAll.toString());
    params = params.set('IsPaged', String(query.isPaged ?? true));

    return this.http.get<ApiResponse<PagedResult<GovernorateDeliveryReadiness>>>(
      `${this.baseUrl}/delivery-orders/governorates`,
      { params }
    );
  }

  getDeliveryOrderReadiness(governorateId: number): Observable<ApiResponse<DeliveryOrderReadiness>> {
    const params = new HttpParams().set('GovernorateId', governorateId.toString());
    return this.http.get<ApiResponse<DeliveryOrderReadiness>>(
      `${this.baseUrl}/delivery-orders/readiness`,
      { params }
    );
  }

  createDeliveryOrder(request: CreateDeliveryOrderRequest): Observable<ApiResponse<CreatedDeliveryOrder>> {
    return this.http.post<ApiResponse<CreatedDeliveryOrder>>(`${this.baseUrl}/delivery-orders`, request);
  }

  /** GET api/Planning/delivery-orders/{id}/locations-pdf */
  getDeliveryOrderLocationsPdf(deliveryOrderId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/delivery-orders/${deliveryOrderId}/locations-pdf`, {
      responseType: 'blob'
    });
  }
}
