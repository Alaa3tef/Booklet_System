
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../shared/services/app-config.service';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
  errors: string[];
}

export interface PagedData<T> {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  meta: string;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  messages: string[];
  succeeded: boolean;
  data: T[];
}

export interface EducationalStageLookup {
  id: number;
  code: string;
  name: string;
  scope?: string;
  isActive: boolean;
}

export interface CommitteeTypeLookup {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface EduStageCommitteeType {
  id: number;
  educationalStageId: number;
  educationalStageName: string;
  committeeTypeId: number;
  committeeTypeName: string;
  bonusType: number;
  bonus: number;
  bookletsPerEnvelope: number;
  envelopesPerBox: number;
  isActive: boolean;
  isDeleted: boolean;
  dateCreated: string;
  createdBy?: string;
  lastModifiedDate?: string;
  lastModifiedBy?: string;
}

/**
 * IDs are required in both operations.
 * Add: IDs come from the form.
 * Edit: IDs come from the original record and cannot be changed.
 */
export interface EduStageCommitteeTypeRequest {
  educationalStageId: number;
  committeeTypeId: number;
  bonusType: number;
  bonus: number;
  bookletsPerEnvelope: number;
  envelopesPerBox: number;
}

export interface EduStageCommitteeTypeFilters {
  educationalStageId?: number | null;
  committeeTypeId?: number | null;
  isActive?: boolean | null;
  searchTerm?: string;
  ascending?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EduStageCommitteeTypesService {

  private http = inject(HttpClient);
    appConfig = inject(AppConfigService);

   baseUrl = `${this.appConfig.baseURL}api/`;

  // ==========y================================
  // GET EduStageCommitteeTypes
  // ==========================================

  getAll(
    pageNumber: number,
    pageSize: number,
    filters: EduStageCommitteeTypeFilters = {}
  ): Observable<ApiResponse<PagedData<EduStageCommitteeType>>> {

    let params = new HttpParams()
      .set('PageNumber', pageNumber)
      .set('PageSize', pageSize)
      .set('IsPaged', true)
      .set('Ascending', filters.ascending ?? true);

    if (filters.educationalStageId != null) {
      params = params.set(
        'EducationalStageId',
        filters.educationalStageId
      );
    }

    if (filters.committeeTypeId != null) {
      params = params.set(
        'CommitteeTypeId',
        filters.committeeTypeId
      );
    }

    if (filters.isActive != null) {
      params = params.set('IsActive', filters.isActive);
    }

    if (filters.searchTerm?.trim()) {
      params = params.set('SearchTerm', filters.searchTerm.trim());
    }

    return this.http.get<
      ApiResponse<PagedData<EduStageCommitteeType>>
    >(`${this.baseUrl}EduStageCommitteeTypes`, { params });
  }

  // ==========================================
  // GET By ID
  // ==========================================

  getById(
    id: number
  ): Observable<ApiResponse<EduStageCommitteeType>> {

    return this.http.get<ApiResponse<EduStageCommitteeType>>(
      `${this.baseUrl}EduStageCommitteeTypes/${id}`
    );
  }

  // ==========================================
  // POST Add / Edit
  // ==========================================

  save(
    request: EduStageCommitteeTypeRequest
  ): Observable<ApiResponse<any>> {

    return this.http.post<ApiResponse<any>>(
      `${this.baseUrl}EduStageCommitteeTypes`,
      request
    );
  }

  // ==========================================
  // GET Educational Stages
  // ==========================================

  getEducationalStages(): Observable<
    ApiResponse<PagedData<EducationalStageLookup>>
  > {

    const params = new HttpParams()
      .set('PageNumber', 1)
      .set('PageSizeOrAll', -1)
      .set('IsPaged', false)
      .set('Ascending', true);

    return this.http.get<
      ApiResponse<PagedData<EducationalStageLookup>>
    >(`${this.baseUrl}EducationalStages`, { params });
  }

  // ==========================================
  // GET Committee Types
  // ==========================================

  getCommitteeTypes(): Observable<
    ApiResponse<PagedData<CommitteeTypeLookup>>
  > {

    const params = new HttpParams()
      .set('PageNumber', 1)
      .set('PageSizeOrAll', -1)
      .set('IsPaged', false)
      .set('Ascending', true);

    return this.http.get<
      ApiResponse<PagedData<CommitteeTypeLookup>>
    >(`${this.baseUrl}CommitteeTypes`, { params });
  }

}
